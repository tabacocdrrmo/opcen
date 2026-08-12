function getFormData() {
    try {
        const raw = sessionStorage.getItem("employeeFormData");
        return raw ? JSON.parse(raw) : null;
    } catch {
        return null;
    }
}

function esc(v) {
    if (v === null || v === undefined) return "—";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(String(v)));
    return div.innerHTML || "—";
}

function formatDate(v) {
    if (!v) return "—";
    const d = new Date(v);
    if (isNaN(d)) return v;
    return d.toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });
}

function setText(id, value) {
    const el = document.getElementById(id);
    if (el) el.innerText = value;
}

document.addEventListener("DOMContentLoaded", function () {
    const data = getFormData();
    sessionStorage.removeItem("employeeFormData");

    if (!data) {
        document.getElementById("dFullName").innerText = "No employee data provided.";
        return;
    }

    const fullName = [data.first_name, data.middle_name, data.last_name].filter(Boolean).join(" ") || "—";
    const today = new Date().toLocaleDateString("en-US", { year: "numeric", month: "long", day: "numeric" });

    const photoEl = document.getElementById("dPhoto");
    if (data.profile_picture) {
        photoEl.src = data.profile_picture;
        photoEl.style.display = "block";
    }

    setText("dFullName", esc(fullName));
    setText("dGender", esc(data.gender));
    setText("dDob", esc(formatDate(data.date_of_birth)));
    setText("dMarital", esc(data.marital_status));
    setText("dBlood", esc(data.blood_type));
    setText("dAddress", esc(data.address));
    setText("dContact", esc(data.contact_number));
    setText("dEmail", esc(data.email));

    setText("dPosition", esc(data.position));
    setText("dEmpType", esc(data.employment_type));
    setText("dEligibility", esc(data.eligibility));
    setText("dJoined", esc(formatDate(data.date_of_joining)));
    setText("dEducAttain", esc(data.educational_attainment));
    setText("dEducInst", esc(data.educational_institution));
    setText("dEducCourse", esc(data.educational_course));

    setText("dContactPerson", esc(data.contact_person));
    setText("dContactRel", esc(data.emergency_rel));
    setText("dContactNo2", esc(data.emergency_no));

    setText("dGenerated", today + " " + new Date().toLocaleTimeString("en-US", { hour: "numeric", minute: "2-digit" }));
});

function goBack() {
    if (document.referrer) {
        window.location.href = document.referrer;
    } else {
        window.location.href = "crew-portal.html";
    }
}
