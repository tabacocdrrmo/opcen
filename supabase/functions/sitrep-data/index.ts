import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

// Authenticated proxy for the SITREP app. Only admin/operator accounts may use
// it. All calls to the Apps Script backend carry the SITREP_API_TOKEN so the
// sheet stays closed to anyone who finds the Apps Script URL.
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
    const apiToken = Deno.env.get("SITREP_API_TOKEN");
    if (!apiUrl || !apiToken) {
      return json({ error: "SITREP backend not configured" }, 500);
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
      .select("role")
      .eq("auth_user_id", callerUser.id)
      .maybeSingle();
    if (acctErr) throw acctErr;
    const role = (account && account.role) || "";
    if (role !== "admin" && role !== "operator") {
      return json({ error: "Not authorized" }, 403);
    }

    const body = await req.json().catch(() => ({}));
    const action = body.action || "sitreps";
    const tokenParam = "token=" + encodeURIComponent(apiToken);

    const forward = async (url: string, init?: RequestInit) => {
      const res = await fetch(url, init);
      const text = await res.text();
      let data: unknown;
      try {
        data = JSON.parse(text);
      } catch (_) {
        return json({ error: "Non-JSON response from backend" }, 502);
      }
      return json(data);
    };

    if (action === "submit") {
      const { action: _strip, ...payload } = body;
      return await forward(apiUrl + "?" + tokenParam, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });
    }

    if (action === "photo") {
      const id = String(body.id || "").trim();
      if (!id) return json({ error: "id required" }, 400);
      return await forward(apiUrl + "?action=photo&id=" + encodeURIComponent(id) + "&" + tokenParam);
    }

    // Main sheet rows (the SITREP reports) plus the responder log (one row per
    // driver/responder per sitrep). The log lets the admin dashboards attribute
    // a sitrep to an employee even when the main sheet's name columns are
    // incomplete, and is fetched sequentially to avoid concurrent cold starts.
    const sitrepsRes = await fetch(apiUrl + "?action=sitreps&" + tokenParam);
    const sitrepsText = await sitrepsRes.text();
    let sitrepsData: { ok?: boolean; rows?: unknown; error?: string };
    try {
      sitrepsData = JSON.parse(sitrepsText);
    } catch (_) {
      return json({ error: "Non-JSON response from backend" }, 502);
    }
    if (!sitrepsData.ok) {
      return json({ error: sitrepsData.error || "Failed to load sitreps" }, 502);
    }

    let logData: { ok?: boolean; rows?: unknown } = {};
    try {
      const logRes = await fetch(apiUrl + "?" + tokenParam);
      logData = JSON.parse(await logRes.text());
    } catch (_) {
      logData = {};
    }

    return json({
      ok: true,
      rows: sitrepsData.rows || [],
      log: (logData && logData.ok && logData.rows) || [],
    });
  } catch (err) {
    return json({ error: (err && (err as Error).message) || "Sitrep data failed." }, 500);
  }
});