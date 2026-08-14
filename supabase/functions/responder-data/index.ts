import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

const normalizeName = (s: string): string =>
  (s || "").toLowerCase().replace(/\s+/g, " ").replace(/\./g, "").trim();

// Lenient match: both the employee's first and last name appear as tokens in the
// responder/PCR name, regardless of middle initial differences.
function nameMatches(name: string, first: string, last: string): boolean {
  const n = normalizeName(name);
  if (!n || !first || !last) return false;
  const tokens = n.split(" ").filter(Boolean);
  return tokens.includes(normalizeName(first)) && tokens.includes(normalizeName(last));
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

    // "data" action: return the caller's own responder-log rows and the sitreps
    // they participated in, filtered server-side.
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

    const sitData = await fetchAppsScript(apiUrl + "?action=sitreps");
    const allSitreps: any[] = (sitData && sitData.rows) || [];
    const sitreps = allSitreps.filter((r: any) =>
      sitrepNumbers.has(String((r && r["SITREP #"]) || "").trim().toLowerCase())
    );

    return json({ ok: true, log, sitreps });
  } catch (err) {
    return json({ error: (err && (err as Error).message) || "Responder data failed." }, 500);
  }
});
