const DB_HEADERS = {
    'apikey': SUPABASE_ANON_KEY,
    'Authorization': `Bearer ${SUPABASE_ANON_KEY}`,
    'Content-Type': 'application/json',
    'Prefer': 'return=representation'
};

async function dbGet(table, { select = '*', filter = '' } = {}) {
    let url = `${SUPABASE_URL}${table}?select=${encodeURIComponent(select)}`;
    if (filter) url += `&${filter}`;
    const res = await fetch(url, {
        headers: { ...DB_HEADERS, 'Prefer': undefined }
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`GET ${table} (${res.status}): ${text}`);
    }
    return res.json();
}

async function dbInsert(table, data) {
    const res = await fetch(`${SUPABASE_URL}${table}`, {
        method: 'POST',
        headers: DB_HEADERS,
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`INSERT ${table} (${res.status}): ${text}`);
    }
    return res.json();
}

async function dbUpdate(table, data, filter) {
    const res = await fetch(`${SUPABASE_URL}${table}?${filter}`, {
        method: 'PATCH',
        headers: DB_HEADERS,
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`UPDATE ${table} (${res.status}): ${text}`);
    }
    return res.json();
}

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

    try {
        const accounts = await dbGet("accounts", {
            select: "*,employees(*)",
            filter: `employee_id=eq.${session.employeeDbId}`
        });

        if (accounts.length === 0) {
            alert("Account not found. Please log in again.");
            clearSession();
            window.location.href = "index.html";
            return;
        }

        const acct = accounts[0];
        const emp = acct.employees;

        let contact = {};
        try {
            const contacts = await dbGet("emergency_contacts", {
                filter: `employee_id=eq.${acct.employee_id}`
            });
            if (contacts.length > 0) contact = contacts[0];
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

    document.getElementById("displayContactPerson").innerText = data.contact_person || "—";
    document.getElementById("displayEmergencyRel").innerText = data.emergency_rel || "—";
    document.getElementById("displayEmergencyNo").innerText = data.emergency_no || "—";
}

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

    document.getElementById("contactPerson").value = profileData.contact_person;
    document.getElementById("emergencyRel").value = profileData.emergency_rel;
    document.getElementById("emergencyNo").value = profileData.emergency_no;

    document.getElementById("editProfilePreview").src = profileData.profile_picture || "assets/images/img_placeholder.jpg";
});

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
        const accounts = await dbGet("accounts", {
            select: "password_hash",
            filter: `employee_id=eq.${currentEmployeeDbId}`
        });

        if (accounts.length === 0) return alert("Account not found.");
        if (accounts[0].password_hash !== currentPass) return alert("Current password is incorrect.");

        await dbUpdate("accounts", { password_hash: newPass }, `employee_id=eq.${currentEmployeeDbId}`);
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
    const storageUrl = SUPABASE_URL.replace('/rest/v1/', '/storage/v1/');
    const formData = new FormData();
    formData.append('file', file);
    const res = await fetch(`${storageUrl}object/profile-pictures/${fileName}`, {
        method: 'POST',
        headers: {
            'apikey': SUPABASE_ANON_KEY,
            'Authorization': `Bearer ${SUPABASE_ANON_KEY}`
        },
        body: formData
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`Upload failed (${res.status}): ${text}`);
    }
    return `${storageUrl}object/public/profile-pictures/${fileName}`;
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
        };

        const contactData = {
            contact_person: document.getElementById("contactPerson").value,
            relationship: document.getElementById("emergencyRel").value,
            contact_number: document.getElementById("emergencyNo").value
        };

        let empId = currentEmployeeDbId;

        if (empId) {
            await dbUpdate("employees", empData, `id=eq.${empId}`);

            const existing = await dbGet("emergency_contacts", {
                filter: `employee_id=eq.${empId}`
            });

            if (existing.length > 0) {
                await dbUpdate("emergency_contacts", contactData, `employee_id=eq.${empId}`);
            } else if (contactData.contact_person) {
                await dbInsert("emergency_contacts", { ...contactData, employee_id: empId });
            }
        } else {
            const inserted = await dbInsert("employees", empData);
            if (!inserted || inserted.length === 0) throw new Error("Failed to create employee record.");
            empId = inserted[0].id;
            currentEmployeeDbId = empId;
            setSession(currentActiveUser, empId);

            await dbInsert("accounts", {
                employee_id: empId,
                username: currentActiveUser,
                password_hash: "ChangeMe123!"
            });

            if (contactData.contact_person) {
                await dbInsert("emergency_contacts", { ...contactData, employee_id: empId });
            }
        }

        if (pendingProfileFile) {
            try {
                const imageUrl = await uploadProfileImage(pendingProfileFile, empId);
                await dbUpdate("employees", { profile_picture: imageUrl }, `id=eq.${empId}`);
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

function handleLogout() {
    clearSession();
    window.location.href = "index.html";
}
