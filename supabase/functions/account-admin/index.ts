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

    // Finds an existing auth user by email, including unconfirmed leftovers from
    // an earlier sign-up attempt.
    const findUserByEmail = async (email: string) => {
      const target = email.toLowerCase();
      for (let page = 1; page <= 20; page += 1) {
        const { data, error } = await adminClient.auth.admin.listUsers({ page, perPage: 100 });
        if (error) throw error;
        const users = data?.users || [];
        const found = users.find((u) => (u.email || "").toLowerCase() === target);
        if (found) return found;
        if (users.length < 100) return null;
      }
      return null;
    };

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
      if (!password) return json({ error: "A password is required." }, 400);
      if (!role || !["admin", "operator", "staff"].includes(role)) {
        return json({ error: "Invalid role" }, 400);
      }

      const { data: existing } = await adminClient
        .from("accounts")
        .select("id")
        .eq("username", username)
        .maybeSingle();
      if (existing) return json({ error: `The username "${username}" is already taken.` }, 409);

      // A login may already exist for this email without an accounts row, e.g. an
      // unconfirmed user left behind by an earlier failed sign-up. Reuse it
      // instead of failing, but never take over a login that is already linked
      // to another account.
      let authUser = await findUserByEmail(email);
      if (authUser) {
        const { data: linked } = await adminClient
          .from("accounts")
          .select("id,username")
          .eq("auth_user_id", authUser.id)
          .maybeSingle();
        if (linked) {
          return json(
            { error: `That email already belongs to the account "${linked.username}".` },
            409,
          );
        }

        const { data: updated, error: updateErr } = await adminClient.auth.admin
          .updateUserById(authUser.id, { password, email_confirm: true });
        if (updateErr || !updated?.user) {
          return json({ error: (updateErr && updateErr.message) || "Failed to set the password" }, 400);
        }
        authUser = updated.user;
      } else {
        const { data: created, error: createErr } = await adminClient.auth.admin.createUser({
          email,
          password,
          email_confirm: true,
        });
        if (createErr || !created?.user) {
          return json({ error: (createErr && createErr.message) || "Failed to create login" }, 400);
        }
        authUser = created.user;
      }

      const { data: account, error: insertErr } = await adminClient
        .from("accounts")
        .insert({ auth_user_id: authUser.id, username, employee_id: employeeId, role })
        .select()
        .single();
      if (insertErr) {
        // Only remove the login when this call created it, so a reused orphan
        // login is never destroyed.
        if (!await findUserByEmail(email)) throw insertErr;
        await adminClient.auth.admin.deleteUser(authUser.id);
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

    // Self-service onboarding: a signed-in user without an employee record
    // creates their own row and links it to their account in one step. The
    // browser is not allowed to insert into employees directly, because that
    // would let anyone write a row for an employee id they do not own.
    //
    // Employment fields that only an admin should set (rank, status, dates) are
    // dropped here on purpose: the admin panel assigns those after onboarding.
    if (action === "self-register") {
      const { data: callerAccount, error: callerAcctErr } = await adminClient
        .from("accounts")
        .select("id,employee_id")
        .eq("auth_user_id", callerUser.id)
        .maybeSingle();
      if (callerAcctErr) throw callerAcctErr;
      if (!callerAccount) return json({ error: "Account not found" }, 404);
      if (callerAccount.employee_id) {
        return json({ error: "Your account is already linked to an employee record." }, 409);
      }

      const emp = (body.employee || {}) as Record<string, unknown>;
      const employeeNumber = String(emp.employee_id || "").trim();
      if (!employeeNumber) return json({ error: "Employee ID is required." }, 400);

      const { data: dupe } = await adminClient
        .from("employees")
        .select("id")
        .eq("employee_id", employeeNumber)
        .maybeSingle();
      if (dupe) {
        return json({ error: `An employee with Employee ID "${employeeNumber}" already exists.` }, 409);
      }

      const row: Record<string, unknown> = {
        employee_id: employeeNumber,
        first_name: emp.first_name ?? null,
        middle_name: emp.middle_name ?? null,
        last_name: emp.last_name ?? null,
        gender: emp.gender ?? null,
        date_of_birth: emp.date_of_birth ?? null,
        marital_status: emp.marital_status ?? null,
        blood_type: emp.blood_type ?? null,
        address: emp.address ?? null,
        contact_number: emp.contact_number ?? null,
        email: emp.email ?? null,
        educational_attainment: emp.educational_attainment ?? null,
        educational_institution: emp.educational_institution ?? null,
        educational_course: emp.educational_course ?? null,
      };

      const { data: inserted, error: insertErr } = await adminClient
        .from("employees")
        .insert(row)
        .select()
        .single();
      if (insertErr) return json({ error: insertErr.message }, 400);

      const { data: linked, error: linkErr } = await adminClient
        .from("accounts")
        .update({ employee_id: inserted.id })
        .eq("auth_user_id", callerUser.id)
        .select()
        .single();
      if (linkErr) {
        await adminClient.from("employees").delete().eq("id", inserted.id);
        return json({ error: linkErr.message }, 500);
      }

      return json({ ok: true, employee: inserted, account: linked });
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
