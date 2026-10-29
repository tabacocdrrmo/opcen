/* ---------------------------------------------------------------------------
   Sign-in for the CDRRMO Operations Center.

   The username is mapped to the internal address Supabase Auth holds for the
   account, the password is checked by Supabase, and the account row decides
   where the browser goes next: the admin panel or the crew portal.
   --------------------------------------------------------------------------- */

(function () {
    "use strict";

    var form = document.getElementById("loginForm");
    var usernameInput = document.getElementById("username");
    var passwordInput = document.getElementById("password");
    var revealButton = document.getElementById("reveal");
    var submitButton = document.getElementById("submit");
    var submitLabel = document.getElementById("submitLabel");
    var errorBox = document.getElementById("error");
    var errorText = document.getElementById("errorText");

    var MESSAGES = {
        username: "Enter your username.",
        password: "Enter your password.",
        credentials: "That username and password do not match. Check both and try again.",
        account: "This sign-in has no personnel record attached. Contact an administrator.",
        service: "The sign-in service is unavailable. Reload the page and try again.",
        network: "Sign-in could not be completed. Check your connection and try again."
    };

    function usernameToEmail(username) {
        return username
            .normalize("NFD").replace(/[\u0300-\u036f]/g, "")
            .replace(/[^a-zA-Z0-9._-]/g, "_")
            .toLowerCase() + "@placeholder.com";
    }

    function showError(message) {
        errorText.textContent = message;
        errorBox.hidden = false;
    }

    function clearError() {
        errorText.textContent = "";
        errorBox.hidden = true;
    }

    function setBusy(busy) {
        submitButton.disabled = busy;
        submitButton.classList.toggle("is-loading", busy);
        submitLabel.textContent = busy ? "Signing in" : "Sign in";
        form.setAttribute("aria-busy", busy ? "true" : "false");
    }

    function markInvalid(input) {
        input.setAttribute("aria-invalid", "true");
        input.focus();
    }

    function clearInvalid(input) {
        input.removeAttribute("aria-invalid");
    }

    async function signIn(username, password) {
        var auth = await supabaseClient.auth.signInWithPassword({
            email: usernameToEmail(username),
            password: password
        });

        if (auth.error) {
            var rejected = auth.error.status === 400 ||
                /invalid login credentials/i.test(auth.error.message || "");
            throw new Error(rejected ? "credentials" : "network");
        }

        var account = await supabaseClient
            .from("accounts")
            .select("*, employees(*)")
            .eq("auth_user_id", auth.data.user.id)
            .single();

        if (account.error || !account.data) {
            throw new Error("account");
        }

        var record = account.data;

        sessionStorage.setItem("crewSession", JSON.stringify({
            username: username,
            employeeDbId: record.employee_id,
            role: record.role || "staff"
        }));

        window.location.href = record.role === "admin" ? "admin.html" : "crew-portal.html";
    }

    form.addEventListener("submit", async function (event) {
        event.preventDefault();
        clearError();

        var username = usernameInput.value.trim();
        var password = passwordInput.value;

        clearInvalid(usernameInput);
        clearInvalid(passwordInput);

        if (!username) {
            showError(MESSAGES.username);
            markInvalid(usernameInput);
            return;
        }

        if (!password) {
            showError(MESSAGES.password);
            markInvalid(passwordInput);
            return;
        }

        if (typeof supabaseClient === "undefined") {
            showError(MESSAGES.service);
            return;
        }

        setBusy(true);

        try {
            await signIn(username, password);
        } catch (error) {
            var key = error && error.message;
            showError(MESSAGES[key] || MESSAGES.network);
            setBusy(false);
            passwordInput.select();
        }
    });

    revealButton.addEventListener("click", function () {
        var isVisible = passwordInput.type === "text";
        passwordInput.type = isVisible ? "password" : "text";
        revealButton.setAttribute("aria-pressed", isVisible ? "false" : "true");
        revealButton.setAttribute("aria-label", isVisible ? "Show password" : "Hide password");
        revealButton.querySelector("i").className = isVisible ? "fa-solid fa-eye" : "fa-solid fa-eye-slash";
        passwordInput.focus({ preventScroll: true });
    });

    [usernameInput, passwordInput].forEach(function (input) {
        input.addEventListener("input", function () {
            clearInvalid(input);
            if (!errorBox.hidden) clearError();
        });
    });

    // A keyboard is useful on a desktop and intrusive on a phone, so the field
    // only takes focus when the pointer is a mouse or trackpad.
    if (window.matchMedia("(min-width: 1001px) and (pointer: fine)").matches) {
        usernameInput.focus({ preventScroll: true });
    }
})();
