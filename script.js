const fallbackImageSrc = "assets/img_placeholder.jpg";

function applyImageFallbacks() {
    document.querySelectorAll("img").forEach((img) => {
        if (img.getAttribute("data-fallback-applied") === "true") return;

        if (!img.getAttribute("src")) {
            img.setAttribute("src", fallbackImageSrc);
            img.setAttribute("data-fallback-applied", "true");
            return;
        }

        if (img.complete && img.naturalWidth === 0) {
            img.setAttribute("src", fallbackImageSrc);
            img.setAttribute("data-fallback-applied", "true");
            return;
        }

        img.addEventListener("error", function handleImageError() {
            if (this.getAttribute("data-fallback-applied") === "true") return;
            this.setAttribute("data-fallback-applied", "true");
            this.setAttribute("src", fallbackImageSrc);
            this.removeAttribute("onerror");
        }, { once: true });
    });
}

window.addEventListener("load", applyImageFallbacks);

document.addEventListener("contextmenu", function(e) { e.preventDefault(); });
document.addEventListener("keydown", function(e) {
    if (e.key === "F12" || (e.ctrlKey && e.shiftKey && (e.key === "I" || e.key === "J")) || (e.ctrlKey && e.key === "U")) {
        e.preventDefault();
    }
});

function toggleMenu(event) {
    if (event) event.stopPropagation();
    document.getElementById("navMenu").classList.toggle("show");
}
function closeMenu() {
    document.getElementById("navMenu").classList.remove("show");
}
document.addEventListener("click", function(event) {
    const navMenu = document.getElementById("navMenu");
    const menuToggle = document.querySelector(".menu-toggle");
    if (navMenu && !navMenu.contains(event.target) && !menuToggle.contains(event.target)) {
        closeMenu();
    }
});

// SUPABASE REST API HELPERS
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

// ==========================================
// CREW PORTAL - DATABASE BACKED
// ==========================================
let currentActiveUser = null;
let currentEmployeeDbId = null;

function openCrewPortal() {
    document.getElementById("crewPortalModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
}
function closeCrewPortal() {
    document.getElementById("crewPortalModal").classList.add("hidden");
    document.body.style.overflow = "";
}

async function handleLogin() {
    const userIn = document.getElementById("username").value.trim();
    const passIn = document.getElementById("password").value;

    if (!userIn) return alert("Please enter a username.");

    try {
        const accounts = await dbGet("accounts", {
            select: "*,employees(*)",
            filter: `username=eq.${userIn}`
        });

        if (accounts.length === 0) {
            return alert("Account not found. Contact an administrator.");
        }

        const acct = accounts[0];
        const emp = acct.employees;

        if (acct.password_hash !== passIn) {
            return alert("Invalid credentials.");
        }

        currentActiveUser = userIn;
        currentEmployeeDbId = acct.employee_id;

        let contact = {};
        try {
            const contacts = await dbGet("emergency_contacts", {
                filter: `employee_id=eq.${acct.employee_id}`
            });
            if (contacts.length > 0) contact = contacts[0];
        } catch (_) {}

        loadProfileView({
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
            educational_attainment: emp.educational_attainment || "",
            profile_picture: emp.profile_picture || "",
            contact_person: contact.contact_person || "",
            emergency_rel: contact.relationship || "",
            emergency_no: contact.contact_number || ""
        });
    } catch (err) {
        console.error("Login error:", err);
        alert("Database connection error: " + err.message);
    }
}

function loadProfileView(data) {
    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("profileView").classList.remove("hidden");

    document.getElementById("userDisplay").innerText = data.username;
    document.getElementById("profileUsername").value = data.username;
    document.getElementById("employeeId").value = data.employee_id;
    document.getElementById("position").value = data.position || "";
    document.getElementById("firstName").value = data.first_name;
    document.getElementById("lastName").value = data.last_name;
    document.getElementById("gender").value = data.gender;
    document.getElementById("dob").value = data.date_of_birth;
    document.getElementById("address").value = data.address;
    document.getElementById("contactNo").value = data.contact_number;
    document.getElementById("email").value = data.email;
    document.getElementById("bloodtype").value = data.blood_type;
    document.getElementById("empType").value = data.employment_type;
    document.getElementById("eligibility").value = data.eligibility;
    document.getElementById("dateOfJoining").value = data.date_of_joining;
    document.getElementById("empStatus").value = data.status;
    document.getElementById("educAttain").value = data.educational_attainment;
    document.getElementById("contactPerson").value = data.contact_person;
    document.getElementById("emergencyRel").value = data.emergency_rel;
    document.getElementById("emergencyNo").value = data.emergency_no;

    document.getElementById("profilePreview").src = data.profile_picture || "assets/img_placeholder.jpg";
}

function previewImage(event) {
    const reader = new FileReader();
    reader.onload = function () {
        document.getElementById("profilePreview").src = reader.result;
    };
    if (event.target.files[0]) {
        reader.readAsDataURL(event.target.files[0]);
    }
}

async function changePassword() {
    const newPass = document.getElementById("newPassword").value;
    if (!newPass) return alert("Password cannot be blank.");
    if (!currentEmployeeDbId) return alert("Save your profile first before changing the password.");

    try {
        await dbUpdate("accounts", { password_hash: newPass }, `employee_id=eq.${currentEmployeeDbId}`);
        alert("Password updated successfully.");
        document.getElementById("newPassword").value = "";
    } catch (err) {
        alert("Error updating password: " + err.message);
    }
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
            status: document.getElementById("empStatus").value,
            educational_attainment: document.getElementById("educAttain").value,
            profile_picture: document.getElementById("profilePreview").src
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

            await dbInsert("accounts", {
                employee_id: empId,
                username: currentActiveUser,
                password_hash: "ChangeMe123!"
            });

            if (contactData.contact_person) {
                await dbInsert("emergency_contacts", { ...contactData, employee_id: empId });
            }
        }

        const fields = [
            ["Username", currentActiveUser],
            ["First Name", empData.first_name],
            ["Last Name", empData.last_name],
            ["Gender", empData.gender],
            ["Date of Birth", empData.date_of_birth],
            ["Address", empData.address],
            ["Contact No.", empData.contact_number],
            ["Email", empData.email],
            ["Blood Type", empData.blood_type],
            ["Employee ID", empData.employee_id],
            ["Position", empData.position],
            ["Employment Type", empData.employment_type],
            ["Eligibility", empData.eligibility],
            ["Date of Joining", empData.date_of_joining],
            ["Status", empData.status],
            ["Educational Attainment", empData.educational_attainment],
            ["Emergency Contact Person", contactData.contact_person],
            ["Relationship", contactData.relationship],
            ["Emergency Contact No.", contactData.contact_number]
        ];

        const csvHeader = fields.map(f => f[0]).join(",");
        const csvRow = fields.map(f => `"${(f[1] || "").replace(/"/g, '""')}"`).join(",");
        const csvContent = csvHeader + "\n" + csvRow;

        const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
        const link = document.createElement("a");
        link.href = URL.createObjectURL(blob);
        link.download = "CDRRMO_Record_" + currentActiveUser + ".csv";
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);

        alert("Profile saved to database. Backup CSV downloaded.");
    } catch (err) {
        console.error("Save error:", err);
        alert("Database error: " + err.message);
    }
}

function handleLogout() {
    currentActiveUser = null;
    currentEmployeeDbId = null;
    document.getElementById("password").value = "";
    document.getElementById("profileView").classList.add("hidden");
    document.getElementById("loginView").classList.remove("hidden");
}

let slideIndex = 1;
showSlides(slideIndex);
let slideTimer = setInterval(() => plusSlides(1), 5000);

function plusSlides(n) {
    clearInterval(slideTimer);
    showSlides(slideIndex += n);
    slideTimer = setInterval(() => plusSlides(1), 5000);
}

function showSlides(n) {
    let i;
    let slides = document.getElementsByClassName("mySlides");
    if (n > slides.length) { slideIndex = 1; }
    if (n < 1) { slideIndex = slides.length; }
    for (i = 0; i < slides.length; i++) {
        slides[i].style.display = "none";
    }
    if (slides[slideIndex - 1]) {
        slides[slideIndex - 1].style.display = "block";
    }
}

const hazardContainer = document.getElementById("hazardScrollContainer");
const prepSliderFrame = document.getElementById("prepSliderFrame");
let isPaused = false;

prepSliderFrame.innerHTML += prepSliderFrame.innerHTML;

function smoothContinuousScroll() {
    if (!isPaused) {
        prepSliderFrame.scrollLeft += 1;
        if (prepSliderFrame.scrollLeft >= prepSliderFrame.scrollWidth / 2) {
            prepSliderFrame.scrollLeft = 0;
        }
    }
    requestAnimationFrame(smoothContinuousScroll);
}

function scrollPrepSlides(direction) {
    prepSliderFrame.scrollLeft += (direction * 300);
}

hazardContainer.addEventListener("mouseenter", () => { isPaused = true; });
hazardContainer.addEventListener("mouseleave", () => { isPaused = false; });
hazardContainer.addEventListener("touchstart", () => { isPaused = true; }, { passive: true });
hazardContainer.addEventListener("touchend", () => { isPaused = false; }, { passive: true });

requestAnimationFrame(smoothContinuousScroll);

function switchTab(event, tabId) {
    let i, contents, tabs;
    contents = document.getElementsByClassName("board-content");
    for (i = 0; i < contents.length; i++) {
        contents[i].classList.remove("active");
    }
    tabs = document.getElementsByClassName("tab-btn");
    for (i = 0; i < tabs.length; i++) {
        tabs[i].classList.remove("active");
    }
    document.getElementById(tabId).classList.add("active");
    event.currentTarget.classList.add("active");
}

function toggleChatWindow(event) {
    if (event) event.stopPropagation();
    document.getElementById("chatWindow").classList.toggle("hidden");
}
function handleChatKey(event) {
    if (event.key === "Enter") sendUserMessage();
}
function handleChipClick(chipText) {
    appendMessage(chipText, "user");
    processBotReply(chipText);
}
function sendUserMessage() {
    const inputField = document.getElementById("chatInput");
    const textMsg = inputField.value.trim();
    if (!textMsg) return;
    appendMessage(textMsg, "user");
    inputField.value = "";
    processBotReply(textMsg);
}
function appendMessage(text, identity) {
    const body = document.getElementById("chatBody");
    const msgNode = document.createElement("div");
    msgNode.className = `msg ${identity}`;
    msgNode.innerText = text;
    body.appendChild(msgNode);
    body.scrollTop = body.scrollHeight;
}
function processBotReply(userInput) {
    const cleanQuery = userInput.toLowerCase();
    let response = "I am sorry, I am built specifically to track disaster protocols. Try typing words like 'emergency', 'hotline', 'service', 'ambulance', or 'help'.";
    if (cleanQuery.includes('hotline') || cleanQuery.includes('number') || cleanQuery.includes('ambulance') || cleanQuery.includes('call') || cleanQuery.includes('help') || cleanQuery.includes('emergency')) {
        response = "🚨 Tabaco City Primary Emergency Hotline is 0909 224 5858 | 0999 475 8582 | 0939 782 9833";
    } else if (cleanQuery.includes('service')) {
        response = "🛠️ Available Services: Emergency medical response dispatch, hazard paths tracking, and safety training.";
    } else if (cleanQuery.includes('mandate')) {
        response = "🏛️ Our office manages the 4 Thematic Areas: Mitigation, Preparedness, Response, and Rehabilitation.";
    } else if (cleanQuery.includes('leadership') || cleanQuery.includes('mayor')) {
        response = "👤 Structure: Reynaldo B. Bragais (City Mayor) & Gelacio M. Molato Jr. (Head, Tabaco CDRRMO).";
    }
    setTimeout(() => { appendMessage(response, 'bot'); }, 400);
}

function zoomSlide(srcPath) {
    isPaused = true;
    const modal = document.getElementById("imageZoomModal");
    const image = document.getElementById("zoomedImage");
    const btn = document.getElementById("downloadSlideBtn");
    image.src = srcPath;
    btn.href = srcPath;
    modal.style.display = "flex";
}
function closeZoomModal() {
    document.getElementById("imageZoomModal").style.display = "none";
    isPaused = false;
}

document.addEventListener("DOMContentLoaded", function () {
    applyImageFallbacks();
});
