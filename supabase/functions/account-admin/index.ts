import { createClient } from "https://esm.sh/@supabase/supabase-js@2";

// Account administration for the staff app.
//
// The accounts table is protected by row level security: clients may only read
// their own row, and there are no client INSERT/UPDATE/DELETE policies at all.
// That makes it impossible for anyone holding the public anon key to grant
// themselves a role. Every write therefore goes through this function, which
// uses the service role key and verifies the caller is an admin first.

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

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
    const anonKey = Deno.env.get("SUPABASE_ANON_KEY")!;
    const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;

    const callerAuth = req.headers.get("Authorization") ?? "";
    const callerClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: callerAuth } },
    });

    const { data: { user: callerUser }, error: callerErr } = await callerClient.auth.getUser();
    if (callerErr || !callerUser) return json({ error: "Not authenticated" }, 401);

    const body = await req.json().catch(() => ({}));
    const action = body.action || "";

    // The admin client is only created once the caller is known to be an admin
    // (or, for set-employee, known to be themselves).
    const adminClient = createClient(supabaseUrl, serviceRoleKey, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    const requireAdmin = async () => {
      const { data: account, error } = await callerClient
        .from("accounts")
        .select("role")
        .eq("auth_user_id", callerUser.id)
        .maybeSingle();
      if (error) throw error;
      if (!account || account.role !== "admin") {
        return json({ error: "Admin access required" }, 403);
      }
      return null;
    };

    // Every account with its employee record, for the admin roster.
    if (action === "list") {
      const denied = await requireAdmin();
      if (denied) return denied;

      const { data, error } = await adminClient
        .from("accounts")
        .select("*,employees(*)")
        .order("id", { ascending: true });
      if (error) throw error;
      return json({ ok: true, accounts: data || [] });
    }

    // Username uniqueness check before creating an account.
    if (action === "username-taken") {
      const denied = await requireAdmin();
      if (denied) return denied;

      const username = String(body.username || "").trim();
      if (!username) return json({ error: "username is required" }, 400);

      const { data, error } = await adminClient
        .from("accounts")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (error) throw error;
      return json({ ok: true, taken: !!data });
    }

    // Creates the login and its accounts row in one step. Uses the admin API so
    // public sign-ups can stay disabled in Supabase Auth.
    if (action === "create-user") {
      const denied = await requireAdmin();
      if (denied) return denied;

      const email = String(body.email || "").trim();
      const password = String(body.password || "");
      const username = String(body.username || "").trim();
      const role = String(body.role || "staff").trim();
      const employeeId = body.employeeId ?? null;

      if (!email || !username) return json({ error: "email and username are required" }, 400);
      if (!role || !["admin", "operator", "staff"].includes(role)) {
        return json({ error: "Invalid role" }, 400);
      }

      const { data: existing } = await adminClient
        .from("accounts")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (existing) return json({ error: `The username "${username}" is already taken.` }, 409);

      const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
        email,
        password,
        email_confirm: true,
      });
      if (createErr || !created?.user) {
        return json({ error: (createErr && createErr.message) || "Failed to create login" }, 400);
      }

      const { data: account, error: insertErr } = await adminClient
        .from("accounts")
        .insert({ auth_user_id: created.user.id, username, employee_id: employeeId, role })
        .select()
        .single();
      if (insertErr) {
        // Do not leave an orphaned login behind if the row insert fails.
        await adminClient.auth.admin.deleteUser(created.user.id);
        throw insertErr;
      }

      return json({ ok: true, account });
    }

    // Changes the username and/or role of an existing account.
    if (action === "update-account") {
      const denied = await requireAdmin();
      if (denied) return denied;

      const accountId = body.accountId;
      const patch: Record<string, unknown> = {};
      if (body.username !== undefined) patch.username = String(body.username).trim();
      if (body.role !== undefined) {
        const role = String(body.role).trim();
        if (!["admin", "operator", "staff"].includes(role)) {
          return json({ error: "Invalid role" }, 400);
        }
        patch.role = role;
      }
      if (!Object.keys(patch).length) return json({ error: "Nothing to update" }, 400);

      const { data, error } = await adminClient
        .from("accounts")
        .update(patch)
        .eq("id", accountId)
        .select()
        .single();
      if (error) throw error;
      return json({ ok: true, account: data });
    }

    // Links the caller's own account to their employee record. Self-service, so
    // it is allowed for any signed-in user but only ever touches their own row.
    if (action === "set-employee") {
      const employeeId = body.employeeId ?? null;
      const { data, error } = await adminClient
        .from("accounts")
        .update({ employee_id: employeeId })
        .eq("auth_user_id", callerUser.id)
        .select()
        .single();
      if (error) throw error;
      return json({ ok: true, account: data });
    }

    return json({ error: "Unknown action" }, 400);
  } catch (err) {
    return json({ error: (err && (err as Error).message) || "Account request failed." }, 500);
  }
});
