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
    document.getElementById("displayFullName").innerText = (data.first_name + " " + data.last_name).trim() || "—";
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
        const empData = {
            employee_id: document.getElementById("employeeId").value,
            position: document.getElementById("position").value,
            first_name: document.getElementById("firstName").value,
            last_name: document.getElementById("lastName").value,
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

function switchCrewTab(tab) {
    document.querySelectorAll("#crewTabs .nav-link").forEach(el => el.classList.remove("active"));
    document.querySelector(`#crewTabs .nav-link[data-tab="${tab}"]`).classList.add("active");
    document.getElementById("tab-profile").classList.toggle("d-none", tab !== "profile");
    document.getElementById("tab-leave").classList.toggle("d-none", tab !== "leave");
    if (tab === "leave") loadLeaveHistory();
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
            ? (profileData.first_name + " " + profileData.last_name).trim() || currentActiveUser
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
