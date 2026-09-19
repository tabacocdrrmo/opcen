import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const GENERATIONAL_SUFFIXES = new Set(["i", "ii", "iii", "iv", "v", "jr", "sr"]);

const normalizeName = (s: string): string =>
  (s || "")
    .toLowerCase()
    .replace(/\./g, "")
    .replace(/,/g, " ")
    .replace(/\s+/g, " ")
    .trim()
    .split(" ")
    .filter(Boolean)
    .filter((t) => !GENERATIONAL_SUFFIXES.has(t))
    .join(" ");

// Lenient match: every significant first and last name token appears in the
// responder/PCR name, regardless of middle initial / generational suffix
// (Jr., Sr., II, etc.) / multi-word surname differences.
function nameMatches(name: string, first: string, last: string): boolean {
  const n = normalizeName(name);
  const f = normalizeName(first);
  const l = normalizeName(last);
  if (!n || !f || !l) return false;
  const tokens = n.split(" ").filter(Boolean);
  const firstOk = f.split(" ").every((t) => tokens.includes(t));
  const lastOk = l.split(" ").every((t) => tokens.includes(t));
  return firstOk && lastOk;
}

// In-memory cache of the full SITREP sheet so a request's "data" and
// "teamSummary" calls (and re-opens within the TTL) avoid re-fetching Apps
// Script. It lives only in the function instance's memory -- every response is
// still filtered per caller before reaching the client.
const SITREP_CACHE_TTL_MS = 120000; // 2 minutes
let sitrepCache: { at: number; rows: any[] } | null = null;

async function getAllSitreps(url: string): Promise<any[]> {
  const now = Date.now();
  if (sitrepCache && now - sitrepCache.at < SITREP_CACHE_TTL_MS) {
    return sitrepCache.rows;
  }
  const sitData = await fetchAppsScript(url + "?action=sitreps");
  const rows: any[] = (sitData && sitData.rows) || [];
  sitrepCache = { at: now, rows };
  return rows;
}

// The Apps Script endpoint is flaky on cold start / first request, so retry with
// a backoff and a per-attempt timeout.
async function fetchAppsScript(url: string, attempts = 4): Promise<any> {
  const token = Deno.env.get("SITREP_API_TOKEN");
  if (token) {
    url += (url.includes("?") ? "&" : "?") + "token=" + encodeURIComponent(token);
  }
  let lastErr: unknown;
  for (let i = 0; i < attempts; i++) {
    const ctl = new AbortController();
    const timer = setTimeout(() => ctl.abort(), 25000);
    try {
      const res = await fetch(url, { signal: ctl.signal, redirect: "follow" });
      const data = await res.json();
      if (data && typeof data === "object") return data;
      lastErr = new Error("Non-JSON response (HTTP " + res.status + ")");
    } catch (err) {
      lastErr = err;
    } finally {
      clearTimeout(timer);
    }
    await new Promise((r) => setTimeout(r, 1000 * (i + 1)));
  }
  throw lastErr || new Error("Apps Script endpoint unreachable");
}

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  const json = (body: unknown, status = 200) =>
    new Response(JSON.stringify(body), {
      status,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });

  try {
    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const apiUrl = Deno.env.get("SITREP_API_URL");
    if (!apiUrl) {
      return json({ error: "SITREP_API_URL not configured" }, 500);
    }

    const callerAuth = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, Deno.env.get("SUPABASE_ANON_KEY")!, {
      global: { headers: { Authorization: callerAuth } },
    });

    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) {
      return json({ error: "Not authenticated" }, 401);
    }

    const { data: account, error: acctErr } = await callerClient
      .from("accounts")
      .select("employee_id, employees(first_name, last_name, middle_name)")
      .eq("auth_user_id", callerUser.id)
      .maybeSingle();
    if (acctErr) throw acctErr;
    const emp = account && account.employees;

    // Caller name variants used by both the "data" and "teamSummary" actions.
    const first = (emp && emp.first_name) || "";
    const last = (emp && emp.last_name) || "";
    const middle = (emp && emp.middle_name) || "";
    const variants = new Set<string>();
    if (first && last) {
      variants.add(normalizeName(first + " " + last));
      if (middle) {
        variants.add(normalizeName(first + " " + middle + " " + last));
        const initial = middle[0];
        variants.add(normalizeName(first + " " + initial + ". " + last));
        variants.add(normalizeName(first + " " + initial + " " + last));
      }
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "data";

    if (action === "photo") {
      const id = String(body.id || "").trim();
      if (!id) {
        return json({ error: "id required" }, 400);
      }
      const data = await fetchAppsScript(apiUrl + "?action=photo&id=" + encodeURIComponent(id));
      return json(data);
    }

    // "teamSummary" action: aggregate counts for one team's sitreps (over the
    // optional call-date range). Returns numbers only -- never the raw records
    // of teammates -- so an employee can build the team Summary form.
    if (action === "teamSummary") {
      const team = String(body.team || "").trim();
      if (!team) {
        return json({ error: "team required" }, 400);
      }
      const from = String(body.from || "").trim();
      const to = String(body.to || "").trim();

      const teamMembers = (r: any) =>
        String((r && r["Assigned Team"]) || "")
          .split(/[;,]/)
          .map((s) => s.trim())
          .filter(Boolean)
          .includes(team);

      const pad2 = (n: number) => String(n).padStart(2, "0");
      const callDay = (r: any) => {
        const s = String((r && r["Call Date"]) || "").trim();
        const m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(s);
        if (m) return m[1] + "-" + m[2] + "-" + m[3];
        const d = new Date(s);
        if (isNaN(d.getTime())) return "";
        return d.getFullYear() + "-" + pad2(d.getMonth() + 1) + "-" + pad2(d.getDate());
      };

      const allSitreps = await getAllSitreps(apiUrl);

      // Security: an employee may only view aggregates for teams they actually
      // participate in (from the personnel fields of the shared sheet rows).
      const callerInvolved = (r: any) =>
        ["Responders", "Drivers", "PCR By", "Shift-In-Charge (SIC)", "Operator in Charge"]
          .some((f) =>
            String((r && r[f]) || "").split(/[;,]/).some((s: string) => {
              const n = normalizeName(s);
              return n && (variants.has(n) || nameMatches(n, first, last));
            })
          );
      const callerTeams = new Set<string>();
      allSitreps.filter(callerInvolved).forEach((r) =>
        String((r && r["Assigned Team"]) || "").split(/[;,]/).forEach((t: string) => {
          if (t.trim()) callerTeams.add(t.trim());
        })
      );
      if (!callerTeams.has(team)) {
        return json({ error: "Not authorized" }, 403);
      }

      const rows = allSitreps.filter((r) => {
        if (!teamMembers(r)) return false;
        const day = callDay(r);
        if (from && (!day || day < from)) return false;
        if (to && (!day || day > to)) return false;
        return true;
      });

      const combined = (r: any) =>
        String((r && r["Nature of Incident"]) || "") + " | " +
        String((r && r["Cause of Incident"]) || "");
      const va = rows.filter((r) => /vehicular accident/i.test(combined(r))).length;
      const me = rows.filter((r) => /medical emergency/i.test(combined(r))).length;

      // The crew report lists responders + drivers only; SIC / dispatch
      // operator are excluded so they don't inflate the rescue counts.
      const PERSONNEL_FIELDS = ["Responders", "Drivers"];
      const splitNames = (v: any) =>
        String(v || "").split(/[;,]/).map((s) => String(s).trim()).filter(Boolean);

      const counts: Record<string, { name: string; rescue: number; pcr: number }> = {};
      rows.forEach((r) => {
        const rescueNames = new Set<string>();
        PERSONNEL_FIELDS.forEach((f) => {
          splitNames(r[f]).forEach((t) => {
            const n = normalizeName(t);
            if (n) {
              if (!counts[n]) counts[n] = { name: t, rescue: 0, pcr: 0 };
              rescueNames.add(n);
            }
          });
        });
        splitNames(r["PCR By"]).forEach((t) => {
          const n = normalizeName(t);
          if (n) {
            if (!counts[n]) counts[n] = { name: t, rescue: 0, pcr: 0 };
            counts[n].pcr++;
          }
        });
        rescueNames.forEach((n) => counts[n].rescue++);
      });

      const driverList: { name: string; n: string }[] = [];
      rows.forEach((r) => {
        splitNames(r["Drivers"]).forEach((t) => {
          const n = normalizeName(t);
          if (n && !driverList.some((d) => d.n === n)) driverList.push({ name: t, n });
        });
      });
      const drivers = driverList.map((d) => {
        const c = counts[d.n];
        return { name: d.name, rescue: c ? c.rescue : 0, pcr: c ? c.pcr : 0 };
      });

      return json({
        ok: true,
        team,
        total: rows.length,
        va,
        me,
        responders: Object.values(counts),
        drivers,
      });
    }

    // "data" action: return the caller's own responder-log rows and the sitreps
    // they participated in, filtered server-side.
    const logData = await fetchAppsScript(apiUrl);
    const allLog: any[] = (logData && logData.rows) || [];
    const log = variants.size === 0
      ? []
      : allLog.filter((r: any) => {
          const n = normalizeName(r && r.name);
          return variants.has(n) || nameMatches(n, first, last);
        });

    const sitrepNumbers = new Set(
      log
        .map((r: any) => String((r && r.sitrepNo) || "").trim().toLowerCase())
        .filter(Boolean)
    );

    const allSitreps = await getAllSitreps(apiUrl);
    const sitreps = allSitreps.filter((r: any) =>
      sitrepNumbers.has(String((r && r["SITREP #"]) || "").trim().toLowerCase())
    );

    return json({ ok: true, log, sitreps });
  } catch (err) {
    return json({ error: (err && (err as Error).message) || "Responder data failed." }, 500);
  }
});
