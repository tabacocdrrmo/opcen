let currentActiveUser = null;
let currentEmployeeDbId = null;
let profileData = null;
let pendingProfileFile = null;

function getSession() {
    const raw = sessionStorage.getItem("crewSession");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function togglePassword(inputId, btn) {
    const input = document.getElementById(inputId);
    const icon = btn.querySelector("i");
    if (input.type === "password") {
        input.type = "text";
        icon.className = "fa-solid fa-eye-slash";
    } else {
        input.type = "password";
        icon.className = "fa-solid fa-eye";
    }
}

function setSession(username, employeeDbId) {
    sessionStorage.setItem("crewSession", JSON.stringify({ username, employeeDbId }));
}

function clearSession() {
    sessionStorage.removeItem("crewSession");
}

document.addEventListener("DOMContentLoaded", async function () {
    const session = getSession();
    if (!session) {
        window.location.href = "index.html";
        return;
    }

    currentActiveUser = session.username;
    currentEmployeeDbId = session.employeeDbId;

    if (session.role === "admin") {
        const link = document.getElementById("adminNavLink");
        if (link) link.classList.remove("d-none");
    }

    emailjs.init("PunzKpQ532XeW-W_m");

    try {
        const { data: acct, error: acctErr } = await supabaseClient
            .from("accounts")
            .select("*,employees(*)")
            .eq("employee_id", session.employeeDbId)
            .single();

        if (acctErr || !acct) {
            alert("Account not found. Please log in again.");
            clearSession();
            window.location.href = "index.html";
            return;
        }

        const emp = acct.employees;

        let contact = {};
        try {
            const { data: contacts } = await supabaseClient
                .from("emergency_contacts")
                .select("*")
                .eq("employee_id", acct.employee_id);
            if (contacts && contacts.length > 0) contact = contacts[0];
        } catch (_) {}

        profileData = {
            username: acct.username,
            employee_id: emp.employee_id || "",
            position: emp.position || "",
            first_name: emp.first_name || "",
            middle_name: emp.middle_name || "",
            last_name: emp.last_name || "",
            gender: emp.gender || "",
            date_of_birth: emp.date_of_birth || "",
            address: emp.address || "",
            contact_number: emp.contact_number || "",
            email: emp.email || "",
            blood_type: emp.blood_type || "",
            employment_type: emp.employment_type || "",
            eligibility: emp.eligibility || "",
            date_of_joining: emp.date_of_joining || "",
            status: emp.status || "Active",
            marital_status: emp.marital_status || "",
            educational_attainment: emp.educational_attainment || "",
            educational_institution: emp.educational_institution || "",
            educational_course: emp.educational_course || "",
            profile_picture: emp.profile_picture || "",
            contact_person: contact.contact_person || "",
            emergency_rel: contact.relationship || "",
            emergency_no: contact.contact_number || ""
        };

        loadProfileView(profileData);

        loadResponderLog();
    } catch (err) {
        console.error("Load error:", err);
        alert("Failed to load profile: " + err.message);
    }
});

function loadProfileView(data) {
    document.getElementById("userDisplay").innerText = data.username;

    document.getElementById("profileUsername").innerText = data.username;
    document.getElementById("accountEmail").innerText = data.email;

    document.getElementById("profilePreview").src = data.profile_picture || "assets/images/img_placeholder.jpg";
    document.getElementById("displayFullName").innerText = [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" ") || "—";
    document.getElementById("displayPosition").innerText = data.position || "—";
    document.getElementById("displayEmployeeId").innerText = data.employee_id || "—";
    document.getElementById("displayEmpType").innerText = data.employment_type || "—";

    const badge = document.getElementById("displayStatusBadge");
    badge.innerText = data.status || "—";
    badge.className = "badge fs-6 mt-2";
    if (data.status === "Active") badge.classList.add("bg-success");
    else if (data.status === "On Leave") badge.classList.add("bg-onleave");
    else if (data.status === "Resigned") badge.classList.add("bg-warning", "text-dark");
    else if (data.status === "Terminated") badge.classList.add("bg-danger");
    else badge.classList.add("bg-secondary");

    document.getElementById("displayFirstName").innerText = data.first_name || "—";
    document.getElementById("displayMiddleName").innerText = data.middle_name || "—";
    document.getElementById("displayLastName").innerText = data.last_name || "—";
    document.getElementById("displayGender").innerText = data.gender || "—";
    document.getElementById("displayDob").innerText = data.date_of_birth || "—";
    document.getElementById("displayMarital").innerText = data.marital_status || "—";
    document.getElementById("displayBloodType").innerText = data.blood_type || "—";
    document.getElementById("displayAddress").innerText = data.address || "—";
    document.getElementById("displayContactNo").innerText = data.contact_number || "—";
    document.getElementById("displayEmail").innerText = data.email || "—";

    document.getElementById("displayEmpId2").innerText = data.employee_id || "—";
    document.getElementById("displayPosition2").innerText = data.position || "—";
    document.getElementById("displayEmpType2").innerText = data.employment_type || "—";
    document.getElementById("displayEligibility").innerText = data.eligibility || "—";
    document.getElementById("displayDateJoined").innerText = data.date_of_joining || "—";
    document.getElementById("displayStatus").innerText = data.status || "—";
    document.getElementById("displayEducAttain").innerText = data.educational_attainment || "—";
    document.getElementById("displayEducInstitution").innerText = data.educational_institution || "—";
    document.getElementById("displayEducCourse").innerText = data.educational_course || "—";

    document.getElementById("displayContactPerson").innerText = data.contact_person || "—";
    document.getElementById("displayEmergencyRel").innerText = data.emergency_rel || "—";
    document.getElementById("displayEmergencyNo").innerText = data.emergency_no || "—";
}

document.getElementById("leaveModal").addEventListener("show.bs.modal", function () {
    const today = new Date().toISOString().split("T")[0];
    document.getElementById("leaveStart").setAttribute("min", today);
    document.getElementById("leaveEnd").setAttribute("min", today);
});

document.getElementById("editProfileModal").addEventListener("show.bs.modal", function () {
    if (!profileData) return;

    document.getElementById("firstName").value = profileData.first_name;
    document.getElementById("middleName").value = profileData.middle_name;
    document.getElementById("lastName").value = profileData.last_name;
    document.getElementById("gender").value = profileData.gender;
    document.getElementById("dob").value = profileData.date_of_birth;
    document.getElementById("maritalStatus").value = profileData.marital_status;
    document.getElementById("address").value = profileData.address;
    document.getElementById("contactNo").value = profileData.contact_number;
    document.getElementById("email").value = profileData.email;
    document.getElementById("bloodtype").value = profileData.blood_type;

    document.getElementById("employeeId").value = profileData.employee_id;
    document.getElementById("position").value = profileData.position;
    document.getElementById("empType").value = profileData.employment_type;
    document.getElementById("eligibility").value = profileData.eligibility;
    document.getElementById("dateOfJoining").value = profileData.date_of_joining;
    document.getElementById("empStatus").value = profileData.status;
    document.getElementById("educAttain").value = profileData.educational_attainment;
    document.getElementById("educInstitution").value = profileData.educational_institution || "";
    document.getElementById("educCourse").value = profileData.educational_course || "";
    toggleEduExtra();

    document.getElementById("contactPerson").value = profileData.contact_person;
    document.getElementById("emergencyRel").value = profileData.emergency_rel;
    document.getElementById("emergencyNo").value = profileData.emergency_no;

    document.getElementById("editProfilePreview").src = profileData.profile_picture || "assets/images/img_placeholder.jpg";
});

function toggleEduExtra() {
    const val = document.getElementById("educAttain").value;
    const showInst = val === "High School Graduate" || val === "College Graduate" || val === "Master's Degree" || val === "Doctoral Degree";
    const showCourse = val === "College Graduate" || val === "Master's Degree" || val === "Doctoral Degree";
    document.querySelectorAll(".edu-extra-institution").forEach(el => el.style.display = showInst ? "block" : "none");
    document.querySelectorAll(".edu-extra-course").forEach(el => el.style.display = showCourse ? "block" : "none");
}

document.getElementById("educAttain").addEventListener("change", toggleEduExtra);

function previewImage(event) {
    const file = event.target.files[0];
    if (!file) return;
    pendingProfileFile = file;
    const img = document.getElementById("editProfilePreview");
    if (img) img.src = URL.createObjectURL(file);
}

async function changePassword() {
    const currentPass = document.getElementById("currentPassword").value;
    const newPass = document.getElementById("newPassword").value;
    const confirmPass = document.getElementById("confirmPassword").value;

    if (!currentPass) return alert("Please enter your current password.");
    if (!newPass) return alert("Please enter a new password.");
    if (!confirmPass) return alert("Please confirm your new password.");
    if (newPass !== confirmPass) return alert("New password and confirmation do not match.");
    if (!currentEmployeeDbId) return alert("Save your profile first before changing the password.");

    try {
        const { data: authSession } = await supabaseClient.auth.getSession();
        const userEmail = authSession?.session?.user?.email;
        if (!userEmail) return alert("Not authenticated.");

        const { error: signInErr } = await supabaseClient.auth.signInWithPassword({
            email: userEmail,
            password: currentPass
        });
        if (signInErr) return alert("Current password is incorrect.");

        const { error: updateErr } = await supabaseClient.auth.updateUser({
            password: newPass
        });
        if (updateErr) throw updateErr;

        alert("Password updated successfully.");
        document.getElementById("currentPassword").value = "";
        document.getElementById("newPassword").value = "";
        document.getElementById("confirmPassword").value = "";
        const pModal = bootstrap.Modal.getInstance(document.getElementById("passwordModal"));
        if (pModal) pModal.hide();
    } catch (err) {
        alert("Error updating password: " + err.message);
    }
}

async function uploadProfileImage(file, employeeId) {
    const ext = file.name.split('.').pop().toLowerCase() || 'jpg';
    const fileName = `${employeeId}_${Date.now()}.${ext}`;
    const { data, error } = await supabaseClient.storage
        .from('profile-pictures')
        .upload(fileName, file, { upsert: true });
    if (error) throw new Error(`Upload failed: ${error.message}`);
    const { data: urlData } = supabaseClient.storage
        .from('profile-pictures')
        .getPublicUrl(fileName);
    return urlData.publicUrl;
}

async function saveAndCompileProfile() {
    try {
        const firstName = document.getElementById("firstName").value.trim();
        const middleName = document.getElementById("middleName").value.trim();
        const lastName = document.getElementById("lastName").value.trim();
        if (!firstName || !middleName || !lastName) return alert("Please enter your first, middle, and last name.");

        const empData = {
            employee_id: document.getElementById("employeeId").value,
            position: document.getElementById("position").value,
            first_name: firstName,
            middle_name: middleName,
            last_name: lastName,
            gender: document.getElementById("gender").value,
            date_of_birth: document.getElementById("dob").value || null,
            address: document.getElementById("address").value,
            contact_number: document.getElementById("contactNo").value,
            email: document.getElementById("email").value,
            blood_type: document.getElementById("bloodtype").value || null,
            employment_type: document.getElementById("empType").value,
            eligibility: document.getElementById("eligibility").value,
            date_of_joining: document.getElementById("dateOfJoining").value || null,
            marital_status: document.getElementById("maritalStatus").value,
            status: document.getElementById("empStatus").value,
            educational_attainment: document.getElementById("educAttain").value,
            educational_institution: document.getElementById("educInstitution").value,
            educational_course: document.getElementById("educCourse").value,
        };

        const contactData = {
            contact_person: document.getElementById("contactPerson").value,
            relationship: document.getElementById("emergencyRel").value,
            contact_number: document.getElementById("emergencyNo").value
        };

        let empId = currentEmployeeDbId;

        if (empId) {
            const { error: empErr } = await supabaseClient
                .from("employees")
                .update(empData)
                .eq("id", empId);
            if (empErr) throw empErr;

            const { data: existing } = await supabaseClient
                .from("emergency_contacts")
                .select("id")
                .eq("employee_id", empId);

            if (existing && existing.length > 0) {
                const { error: contactErr } = await supabaseClient
                    .from("emergency_contacts")
                    .update(contactData)
                    .eq("employee_id", empId);
                if (contactErr) throw contactErr;
            } else if (contactData.contact_person) {
                const { error: contactErr } = await supabaseClient
                    .from("emergency_contacts")
                    .insert({ ...contactData, employee_id: empId });
                if (contactErr) throw contactErr;
            }
        } else {
            const { data: inserted, error: empErr } = await supabaseClient
                .from("employees")
                .insert(empData)
                .select();
            if (empErr || !inserted || inserted.length === 0) throw new Error(empErr?.message || "Failed to create employee record.");
            empId = inserted[0].id;
            currentEmployeeDbId = empId;

            const { data: authData } = await supabaseClient.auth.getSession();
            const { error: acctErr } = await supabaseClient
                .from("accounts")
                .update({ employee_id: empId })
                .eq("auth_user_id", authData.session?.user?.id);
            if (acctErr) throw acctErr;

            setSession(currentActiveUser, empId);

            if (contactData.contact_person) {
                const { error: contactErr } = await supabaseClient
                    .from("emergency_contacts")
                    .insert({ ...contactData, employee_id: empId });
                if (contactErr) throw contactErr;
            }
        }

        if (pendingProfileFile) {
            try {
                const imageUrl = await uploadProfileImage(pendingProfileFile, empId);
                const { error: picErr } = await supabaseClient
                    .from("employees")
                    .update({ profile_picture: imageUrl })
                    .eq("id", empId);
                if (picErr) throw picErr;
                empData.profile_picture = imageUrl;
            } catch (uploadErr) {
                console.error("Image upload failed:", uploadErr);
                alert("Profile saved but image upload failed: " + uploadErr.message + "\n\nYou can try uploading again from the edit profile page.");
            }
            pendingProfileFile = null;
        }

        profileData = {
            username: currentActiveUser,
            employee_id: empData.employee_id,
            position: empData.position,
            first_name: empData.first_name,
            middle_name: empData.middle_name,
            last_name: empData.last_name,
            gender: empData.gender,
            date_of_birth: empData.date_of_birth,
            address: empData.address,
            contact_number: empData.contact_number,
            email: empData.email,
            blood_type: empData.blood_type,
            employment_type: empData.employment_type,
            eligibility: empData.eligibility,
            date_of_joining: empData.date_of_joining,
            status: empData.status,
            marital_status: empData.marital_status,
            educational_attainment: empData.educational_attainment,
            educational_institution: empData.educational_institution,
            educational_course: empData.educational_course,
            profile_picture: empData.profile_picture || profileData.profile_picture,
            contact_person: contactData.contact_person,
            emergency_rel: contactData.relationship,
            emergency_no: contactData.contact_number
        };

        loadProfileView(profileData);

        const modalEl = document.getElementById("editProfileModal");
        const editModal = bootstrap.Modal.getInstance(modalEl);
        if (editModal) editModal.hide();

        alert("Profile saved successfully.");
    } catch (err) {
        console.error("Save error:", err);
        alert("Database error: " + err.message);
    }
}

function openEmployeeForm() {
    if (!profileData) return alert("Save your profile first before viewing the form.");
    sessionStorage.setItem("employeeFormData", JSON.stringify(profileData));
    window.open("employee-form.html", "_blank");
}

function switchCrewTab(tab) {
    document.querySelectorAll("#crewTabs .nav-link").forEach(el => el.classList.remove("active"));
    document.querySelector(`#crewTabs .nav-link[data-tab="${tab}"]`).classList.add("active");
    document.getElementById("tab-profile").classList.toggle("d-none", tab !== "profile");
    document.getElementById("tab-leave").classList.toggle("d-none", tab !== "leave");
    document.getElementById("tab-responder").classList.toggle("d-none", tab !== "responder");
    if (tab === "leave") loadLeaveHistory();
    if (tab === "responder") loadResponderLog();
}

function escapeHtml(str) {
    return String(str ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

let responderLogRows = [];
let sitrepRows = null;
let logCache = null;
let logLoading = false;
let pcrFilterActive = false;
let pcrSitreps = null;
let logPage = 1;
const LOG_PAGE_SIZE = 10;

const normId = s => String(s || "").trim().toLowerCase();

function formatResponderDate(callDate) {
    let out = callDate || "";
    if (out) {
        const d = new Date(out);
        out = isNaN(d.getTime()) ? out : d.toLocaleDateString();
    }
    return out;
}

function normalizeName(s) {
    return (s || "").toLowerCase().replace(/\s+/g, " ").replace(/\./g, "").trim();
}

// Lenient fallback: matches when both the employee's first and last name appear
// as tokens in the PCR By cell, regardless of middle name / initial differences.
function nameMatchesEmployee(name, data) {
    const n = normalizeName(name);
    if (!n || !data) return false;
    const first = normalizeName(data.first_name);
    const last = normalizeName(data.last_name);
    if (!first || !last) return false;
    const tokens = n.split(" ").filter(Boolean);
    return tokens.includes(first) && tokens.includes(last);
}

function getEmployeeNameVariants(data) {
    if (!data) return new Set();
    const first = (data.first_name || "").trim();
    const last = (data.last_name || "").trim();
    const middle = (data.middle_name || "").trim();
    const variants = new Set();
    if (first && last) {
        variants.add(normalizeName([first, last].join(" ")));
        if (middle) {
            variants.add(normalizeName([first, middle, last].join(" ")));
            const initial = middle[0];
            variants.add(normalizeName([first, initial + ".", last].join(" ")));
            variants.add(normalizeName([first, initial, last].join(" ")));
        }
    }
    return variants;
}

// All Apps Script access goes through the responder-data edge function, which
// validates the caller's session and returns only their own data. No Apps
// Script URL lives in this file.
async function invokeResponderData(action, extra = {}) {
    const { data, error } = await supabaseClient.functions.invoke("responder-data", {
        body: { action, ...extra }
    });
    if (error) throw new Error(error.message || "Failed to load data");
    return data;
}

async function loadSitrepRows() {
    if (sitrepRows) return sitrepRows;
    const data = await invokeResponderData("data");
    if (!data.ok) throw new Error(data.error || "Failed to load sitreps");
    sitrepRows = data.sitreps || [];
    return sitrepRows;
}

async function countPcrMade(nameVariants, sitrepNumbers) {
    if (!nameVariants || nameVariants.size === 0) return 0;
    try {
        const rows = await loadSitrepRows();
        let count = 0;
        rows.forEach(r => {
            if (sitrepNumbers && !sitrepNumbers.has(normId(r["SITREP #"]))) return;
            String(r["PCR By"] || "").split(";").forEach(s => {
                if (nameVariants.has(normalizeName(s)) || nameMatchesEmployee(s, profileData)) count++;
            });
        });
        return count;
    } catch (err) {
        console.error("Failed to count PCRs:", err);
        return null;
    }
}

async function loadResponderLog() {
    const tbody = document.getElementById("responderLogBody");

    // Session cache: render instantly (counts are refreshed by renderResponderLog).
    if (logCache) {
        responderLogRows = logCache;
        renderResponderLog();
        return;
    }

    tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">Loading responder log...</td></tr>';
    if (logLoading) return;
    logLoading = true;
    try {
        const nameVariants = getEmployeeNameVariants(profileData);
        const data = await invokeResponderData("data");
        responderLogRows = (data.log || []).filter(r =>
            nameVariants.size === 0 || nameVariants.has(normalizeName(r.name || ""))
        );
        if (!sitrepRows) sitrepRows = data.sitreps || [];
        logCache = responderLogRows;

        const natureFilter = document.getElementById("responderNatureFilter");
        natureFilter.innerHTML = '<option value="">All Incident Types</option>';
        const natures = new Set(responderLogRows.map(r => (r.nature || "").trim()).filter(Boolean));
        [...natures].sort().forEach(n => {
            natureFilter.insertAdjacentHTML("beforeend", `<option value="${escapeHtml(n)}">${escapeHtml(n)}</option>`);
        });

        if (!data.ok || responderLogRows.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No responder log entries found for your account.</td></tr>';
            const pagination = document.getElementById("responderLogPagination");
            if (pagination) pagination.innerHTML = "";
            document.getElementById("respStatSitreps").innerText = "0";
            document.getElementById("respStatPcr").innerText = "0";
            return;
        }

        // renderResponderLog updates both stat cards. The log and sitreps data
        // both arrive in the single edge-function response above (the edge
        // function fetches them sequentially, avoiding concurrent cold starts).
        renderResponderLog();
    } catch (err) {
        console.error("Failed to load responder log:", err);
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-danger py-3">Failed to load responder log. ' +
            '<button type="button" class="btn btn-sm btn-outline-danger ms-2" onclick="loadResponderLog()"><i class="fa-solid fa-rotate"></i> Retry</button></td></tr>';
    } finally {
        logLoading = false;
    }
}

function getFilteredResponderLog() {
    const query = document.getElementById("responderSearch").value.trim().toLowerCase();
    const nature = document.getElementById("responderNatureFilter").value;
    const dateFrom = document.getElementById("responderDateFrom").value;
    const dateTo = document.getElementById("responderDateTo").value;

    return responderLogRows.filter(r => {
        if (pcrFilterActive && pcrSitreps && !pcrSitreps.has(normId(r.sitrepNo))) return false;
        if (nature && (r.nature || "").trim() !== nature) return false;
        if (dateFrom || dateTo) {
            const d = new Date(r.callDate);
            const day = isNaN(d.getTime()) ? "" : d.toISOString().slice(0, 10);
            if (dateFrom && (!day || day < dateFrom)) return false;
            if (dateTo && (!day || day > dateTo)) return false;
        }
        if (query) {
            const hay = [
                r.sitrepNo, r.recordedAt, formatResponderDate(r.callDate),
                r.nature, r.name, r.role
            ].join(" ").toLowerCase();
            if (!hay.includes(query)) return false;
        }
        return true;
    });
}

// Sort value for a responder-log row. Uses the SITREP # sequence (e.g. 2026-001)
// so "newest" means the most recent report regardless of sheet order.
function logSortValue(r) {
    const m = /^(\d{4})-(\d+)$/.exec(String(r.sitrepNo || "").trim());
    return m ? Number(m[1]) * 100000 + Number(m[2]) : 0;
}

function renderResponderLog() {
    const tbody = document.getElementById("responderLogBody");
    const filtered = getFilteredResponderLog().sort((a, b) => logSortValue(b) - logSortValue(a));
    updateResponderStats(filtered);

    const totalPages = Math.max(1, Math.ceil(filtered.length / LOG_PAGE_SIZE));
    logPage = Math.min(logPage, totalPages);

    const pagination = document.getElementById("responderLogPagination");
    if (pagination) {
        pagination.innerHTML = `
            <button type="button" class="btn btn-outline-secondary btn-sm" onclick="changeLogPage(-1)" ${logPage <= 1 ? "disabled" : ""}>
                <i class="fa-solid fa-chevron-left"></i> Prev
            </button>
            <span class="text-muted">Page ${logPage} of ${totalPages} (${filtered.length} records)</span>
            <button type="button" class="btn btn-outline-secondary btn-sm" onclick="changeLogPage(1)" ${logPage >= totalPages ? "disabled" : ""}>
                Next <i class="fa-solid fa-chevron-right"></i>
            </button>`;
    }

    if (filtered.length === 0) {
        tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No entries match your filters.</td></tr>';
        return;
    }

    const start = (logPage - 1) * LOG_PAGE_SIZE;
    tbody.innerHTML = filtered.slice(start, start + LOG_PAGE_SIZE).map(r => `<tr class="clickable-row" onclick="showSitrepDetail('${escapeHtml(r.sitrepNo)}')" title="View full SITREP detail">
        <td data-label="SITREP #">${escapeHtml(r.sitrepNo)}</td>
        <td data-label="Recorded At">${escapeHtml(r.recordedAt)}</td>
        <td data-label="Call Date">${escapeHtml(formatResponderDate(r.callDate))}</td>
        <td data-label="Nature of Incident">${escapeHtml(r.nature)}</td>
        <td data-label="Name">${escapeHtml(r.name)}</td>
        <td data-label="Role">${escapeHtml(r.role)}</td>
    </tr>`).join("");
}

function changeLogPage(delta) {
    logPage += delta;
    renderResponderLog();
}

let pcrStatToken = 0;

function updateResponderStats(filtered) {
    const sitreps = new Set(filtered.map(r => normId(r.sitrepNo)).filter(Boolean));
    document.getElementById("respStatSitreps").innerText = sitreps.size;

    const token = ++pcrStatToken;
    countPcrMade(getEmployeeNameVariants(profileData), sitreps).then(c => {
        if (token !== pcrStatToken) return;
        document.getElementById("respStatPcr").innerText = c === null ? "—" : c;
    });

    if (!pcrSitreps) {
        buildPcrSitreps(getEmployeeNameVariants(profileData)).then(s => {
            if (s) {
                pcrSitreps = s;
                if (pcrFilterActive) renderResponderLog();
            }
        });
    }
}

async function buildPcrSitreps(nameVariants) {
    try {
        const rows = await loadSitrepRows();
        const set = new Set();
        rows.forEach(r => {
            const matched = String(r["PCR By"] || "").split(";").some(s =>
                nameVariants.has(normalizeName(s)) || nameMatchesEmployee(s, profileData)
            );
            if (matched) set.add(normId(r["SITREP #"]));
        });
        return set;
    } catch (err) {
        console.error("Failed to build PCR sitreps:", err);
        return null;
    }
}

async function togglePcrFilter() {
    if (!pcrSitreps) {
        const s = await buildPcrSitreps(getEmployeeNameVariants(profileData));
        if (!s) return;
        pcrSitreps = s;
    }
    pcrFilterActive = !pcrFilterActive;
    document.getElementById("respPcrCard").classList.toggle("pcr-filter-active", pcrFilterActive);
    const note = document.getElementById("pcrFilterNote");
    if (note) note.classList.toggle("d-none", !pcrFilterActive);
    renderResponderLog();
}

function fmt(v) {
    if (typeof v === "string") {
        const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
        if (m && m[1] === "1899") return m[4] + ":" + m[5];
    }
    if (!(v instanceof Date) || isNaN(v)) return v;
    const p = n => String(n).padStart(2, "0");
    if (v.getFullYear() >= 2000) return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    return `${p(v.getHours())}:${p(v.getMinutes())}`;
}

function splitSlots(s) {
    return String(s ?? "").split(";").map(x => x.trim());
}

function splitJoined(s) {
    return String(s ?? "").split(/;\s*|,\s*|\n/).map(x => x.trim()).filter(Boolean);
}

function photoFallback(img) {
    const wrap = img && img.parentElement;
    const link = img && img.getAttribute("data-link");
    if (wrap) {
        wrap.innerHTML = `<span class="small text-break"><i class="fa-solid fa-image me-1"></i><a href="${escapeHtml(link)}" target="_blank" rel="noopener">${escapeHtml(link)}</a></span>`;
    }
}

async function fetchPhoto(id) {
    try {
        const data = await invokeResponderData("photo", { id });
        if (!data || !data.ok || !data.data) return null;
        return "data:" + data.type + ";base64," + data.data;
    } catch (err) {
        console.error("Failed to load photo:", err);
        return null;
    }
}

function photoThumbnails(photos, id) {
    const links = String(photos || "").split(/\n+/).map(x => x.trim()).filter(Boolean);
    if (!links.length) return "";
    const thumbs = links.map(link => {
        const m = /\/d\/([^/?]+)/.exec(link);
        const photoId = m ? m[1] : "";
        return `<span class="me-2 mb-2">
            <img src="data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7" alt="Incident photo"
                 class="img-thumbnail" style="width:140px;height:105px;object-fit:cover;background:#f1f3f5;"
                 data-link="${escapeHtml(link)}" data-photo-id="${escapeHtml(photoId)}"
                 onload="this.style.background=''" onerror="photoFallback(this)"></span>`;
    }).join("");
    // Photos live in a private Drive folder, so each thumbnail is fetched
    // through the authenticated responder-data edge function after render.
    setTimeout(() => {
        const container = document.getElementById(id);
        if (!container) return;
        container.querySelectorAll("img[data-photo-id]").forEach(img => {
            const pid = img.getAttribute("data-photo-id");
            if (!pid) { photoFallback(img); return; }
            fetchPhoto(pid).then(dataUrl => {
                if (dataUrl) img.src = dataUrl; else photoFallback(img);
            });
        });
    }, 0);
    return `
        <div class="card shadow-sm border-0 mb-3">
            <div class="card-header bg-light py-2 d-flex justify-content-between align-items-center">
                <button type="button" class="btn btn-link p-0 text-decoration-none text-dark fw-bold d-flex align-items-center"
                        data-bs-toggle="collapse" data-bs-target="#${id}" aria-expanded="false">
                    <i class="fa-solid fa-camera me-2 text-dark"></i>Photos
                    <i class="fa-solid fa-chevron-down text-muted small ms-2"></i>
                </button>
            </div>
            <div class="collapse" id="${id}">
                <div class="card-body py-3">
                    <div class="d-flex flex-wrap">${thumbs}</div>
                </div>
            </div>
        </div>`;
}

function renderSitrepDetail(row) {
    const e = escapeHtml;
    const patients = splitSlots(row["Patient"]);
    const ages = splitSlots(row["Age"]);
    const addresses = splitSlots(row["Address"]);
    const injuries = splitSlots(row["Injuries"]);
    const statuses = splitSlots(row["Victim Status"]);
    const impressions = splitSlots(row["Initial Impression"]);
    const dispositions = splitSlots(row["Disposition"]);
    const pcrBy = splitSlots(row["PCR By"]);

    const patientRows = patients.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${e(p)}</td>
            <td>${e(ages[i] || "")}</td>
            <td>${e(addresses[i] || "")}</td>
            <td>${e(injuries[i] || "")}</td>
            <td>${e(statuses[i] || "")}</td>
            <td>${e(impressions[i] || "")}</td>
            <td>${e(dispositions[i] || "")}</td>
            <td>${e(pcrBy[i] || "")}</td>
        </tr>`).join("");

    const br = arr => arr.map(e).join("<br>");
    const tile = (label, value, wide) =>
        `<div class="col-6 ${wide ? "col-md-12" : "col-md-4"}">
            <div class="border rounded-3 p-2 h-100">
                <div class="small text-muted text-uppercase fw-semibold mb-1">${label}</div>
                <div class="small text-break">${value || "—"}</div>
            </div>
        </div>`;
    let sectionId = 0;
    const nextId = () => "sdSec" + (sectionId++);
    const section = (icon, title, inner) => {
        const id = nextId();
        return `
        <div class="card shadow-sm border-0 mb-3">
            <div class="card-header bg-light py-2 d-flex justify-content-between align-items-center">
                <button type="button" class="btn btn-link p-0 text-decoration-none text-dark fw-bold d-flex align-items-center"
                        data-bs-toggle="collapse" data-bs-target="#${id}" aria-expanded="false">
                    <i class="${icon} me-2 text-dark"></i>${title}
                    <i class="fa-solid fa-chevron-down text-muted small ms-2"></i>
                </button>
            </div>
            <div class="collapse" id="${id}">
                <div class="card-body py-3"><div class="row g-2">${inner}</div></div>
            </div>
        </div>`;
    };

    return `
        ${section("fa-solid fa-circle-info", "Incident Details",
            tile("Nature of Incident", e(row["Nature of Incident"])) +
            tile("Assigned Team", e(row["Assigned Team"])) +
            tile("Shift-In-Charge", e(row["Shift-In-Charge (SIC)"])) +
            tile("Operator in Charge", e(row["Operator in Charge"])) +
            tile("Dispatched Resource(s)", splitJoined(row["Dispatched Resources"]).map(e).join(", "), true) +
            tile("Involved Vehicle Type", splitJoined(row["Involved Vehicle Type"]).map(e).join(", "), true) +
            tile("Incident Caller / Informant", e(row["Incident Caller / Informant"])) +
            tile("Contact No.", e(row["Contact No."])))}
        ${section("fa-solid fa-clock", "Call & Response Times",
            tile("Call Date", e(fmt(row["Call Date"]))) +
            tile("Call Time", e(fmt(row["Call Time"]))) +
            tile("Dispatched Time", e(fmt(row["Dispatched Time"]))) +
            tile("Arrival at Scene", e(fmt(row["Arrival at Scene"]))) +
            tile("Take Off from Scene", e(fmt(row["Take Off from Scene"]))) +
            tile("Arrival at Hospital", e(fmt(row["Arrival at Hospital"]))))}
        ${section("fa-solid fa-location-dot", "Location",
            tile("Place / Landmark", e(row["Barangay"])) +
            tile("Municipality", e(row["Municipality"])))}
        ${section("fa-solid fa-kit-medical", "Response & Remarks",
            tile("First Aid Provided", e(row["First Aid Provided"]), true) +
            tile("Remarks", e(row["Remarks"]), true) +
            tile("Driver(s)", br(splitJoined(row["Drivers"])), true) +
            tile("Responder(s)", br(splitJoined(row["Responders"])), true))}
        ${patients.length ? section("fa-solid fa-people-roof", "Patients / Victims", `
                <div class="table-responsive">
                    <table class="table table-sm small table-bordered align-middle mb-0 patients-table">
                        <thead class="table-light">
                            <tr><th>No.</th><th>Patient / Victim</th><th>Age</th><th>Address</th><th>Injuries</th><th>Status</th><th>Impression</th><th>Disposition</th><th>PCR By</th></tr>
                        </thead>
                        <tbody>${patientRows}</tbody>
                    </table>
                </div>`) : ""}
        ${photoThumbnails(row["Photos"], nextId())}`;
}

async function showSitrepDetail(sitrepNo) {
    const modalEl = document.getElementById("sitrepDetailModal");
    const title = document.getElementById("sitrepDetailTitle");
    const body = document.getElementById("sitrepDetailBody");
    if (!modalEl || !body) return;
    title.innerText = "SITREP Detail";
    body.innerHTML = '<p class="text-muted text-center py-4">Loading sitrep detail...</p>';
    try {
        const rows = await loadSitrepRows();
        const row = rows.find(r => String(r["SITREP #"] || "").trim() === String(sitrepNo).trim());
        if (!row) throw new Error("SITREP not found.");
        title.innerText = "SITREP No. " + String(row["SITREP #"]);
        body.innerHTML = renderSitrepDetail(row);
    } catch (err) {
        body.innerHTML = '<p class="text-danger text-center py-4">Failed to load sitrep detail: ' + escapeHtml(err.message || err) + '</p>';
    }
    bootstrap.Modal.getOrCreateInstance(modalEl).show();
}

function resetResponderFilters() {
    document.getElementById("responderSearch").value = "";
    document.getElementById("responderNatureFilter").value = "";
    document.getElementById("responderDateFrom").value = "";
    document.getElementById("responderDateTo").value = "";
    if (pcrFilterActive) {
        pcrFilterActive = false;
        document.getElementById("respPcrCard").classList.remove("pcr-filter-active");
        const note = document.getElementById("pcrFilterNote");
        if (note) note.classList.add("d-none");
    }
    logPage = 1;
    renderResponderLog();
}

async function loadLeaveHistory() {
    if (!currentEmployeeDbId) return;
    try {
        const { data: leaves, error: leavesErr } = await supabaseClient
            .from("leave_requests")
            .select("*")
            .eq("employee_id", currentEmployeeDbId)
            .order("created_at", { ascending: false });
        if (leavesErr) throw leavesErr;
        const tbody = document.getElementById("leaveHistoryBody");
        if (!leaves || leaves.length === 0) {
            tbody.innerHTML = '<tr><td colspan="6" class="text-center text-muted py-3">No leave applications found.</td></tr>';
            return;
        }
        tbody.innerHTML = leaves.map(l => {
            const badgeCls = l.status === "Approved" ? "bg-success"
                : l.status === "Rejected" ? "bg-danger"
                : "bg-warning text-dark";
            const submitted = new Date(l.created_at).toLocaleDateString();
            return `<tr>
                <td data-label="Leave Type">${l.leave_type}</td>
                <td data-label="Start">${l.start_date}</td>
                <td data-label="End">${l.end_date}</td>
                <td data-label="Reason">${l.reason || "—"}</td>
                <td data-label="Status"><span class="badge ${badgeCls}">${l.status}</span></td>
                <td data-label="Submitted">${submitted}</td>
            </tr>`;
        }).join("");
    } catch (err) {
        console.error("Failed to load leave history:", err);
    }
}

async function submitLeaveRequest() {
    const leaveType = document.getElementById("leaveType").value;
    const startDate = document.getElementById("leaveStart").value;
    const endDate = document.getElementById("leaveEnd").value;
    const reason = document.getElementById("leaveReason").value.trim();

    if (!leaveType) return alert("Please select a leave type.");
    if (!startDate) return alert("Please select a start date.");
    if (!endDate) return alert("Please select an end date.");
    if (startDate > endDate) return alert("End date must be after start date.");
    if (!currentEmployeeDbId) return alert("Please save your profile first before applying for leave.");

    try {
        const { error: leaveErr } = await supabaseClient
            .from("leave_requests")
            .insert({
                employee_id: currentEmployeeDbId,
                leave_type: leaveType,
                start_date: startDate,
                end_date: endDate,
                reason: reason || null
            });
        if (leaveErr) throw leaveErr;

        const empName = profileData
            ? [profileData.first_name, profileData.middle_name, profileData.last_name].filter(Boolean).join(" ").trim() || currentActiveUser
            : currentActiveUser;

        emailjs.send("service_mieljzd", "template_nrb6uos", {
            employee: empName,
            leave_type: leaveType,
            start_date: startDate,
            end_date: endDate,
            reason: reason || "N/A"
        }).catch(e => console.warn("Email notification failed:", e));

        document.getElementById("leaveType").value = "";
        document.getElementById("leaveStart").value = "";
        document.getElementById("leaveEnd").value = "";
        document.getElementById("leaveReason").value = "";

        const modal = bootstrap.Modal.getInstance(document.getElementById("leaveModal"));
        if (modal) modal.hide();

        loadLeaveHistory();
        alert("Leave application submitted successfully.");
    } catch (err) {
        alert("Error submitting leave: " + err.message);
    }
}

function handleLogout() {
    supabaseClient.auth.signOut();
    clearSession();
    window.location.href = "index.html";
}
