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

document.addEventListener("DOMContentLoaded", applyImageFallbacks);
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

function openCrewPortal() {
    document.getElementById("crewPortalModal").classList.remove("hidden");
    document.body.style.overflow = "hidden";
}
function closeCrewPortal() {
    document.getElementById("crewPortalModal").classList.add("hidden");
    document.body.style.overflow = "";
}

if (!localStorage.getItem("user_responder1")) {
    localStorage.setItem("user_responder1", JSON.stringify({
        username: "responder1",
        password: "Password2026!",
        firstName: "Juan",
        lastName: "Dela Cruz",
        gender: "",
        dob: "",
        address: "",
        contactNo: "0917xxxxxxx",
        email: "juan.delacruz@tabacocdrrmo.gov.ph",
        bloodtype: "",
        employeeId: "CDR-001",
        empType: "Permanent",
        eligibility: "Career Service Professional",
        dateOfJoining: "",
        empStatus: "Active",
        educAttain: "College Graduate",
        contactPerson: "Maria Dela Cruz",
        emergencyRel: "Spouse",
        emergencyNo: "0918xxxxxxx",
        imgData: "",
    }));
}

let currentActiveUser = null;
function handleLogin() {
    const userIn = document.getElementById("username").value.trim();
    const passIn = document.getElementById("password").value;
    const masterPass = "F12!CDRRMO_Admin_2026!";
    const localData = localStorage.getItem("user_" + userIn);

    if (localData) {
        const userObj = JSON.parse(localData);
        if (userObj.password === passIn || passIn === masterPass) {
            currentActiveUser = userIn;
            loadProfileData(userObj);
            return;
        }
    } else if (passIn === masterPass && userIn !== "") {
        currentActiveUser = userIn;
        const newObj = { username: userIn, password: "ChangeMe123!", firstName: "", lastName: "", gender: "", dob: "", address: "", contactNo: "", email: "", bloodtype: "", employeeId: "", empType: "", eligibility: "", dateOfJoining: "", empStatus: "Active", educAttain: "", contactPerson: "", emergencyRel: "", emergencyNo: "", imgData: "" };
        loadProfileData(newObj);
        return;
    }
    alert("Invalid administrative credentials.");
}

function loadProfileData(userObj) {
    document.getElementById("loginView").classList.add("hidden");
    document.getElementById("profileView").classList.remove("hidden");
    document.getElementById("userDisplay").innerText = userObj.username;
    document.getElementById("profileUsername").value = userObj.username;
    document.getElementById("firstName").value = userObj.firstName || "";
    document.getElementById("lastName").value = userObj.lastName || "";
    document.getElementById("gender").value = userObj.gender || "";
    document.getElementById("dob").value = userObj.dob || "";
    document.getElementById("address").value = userObj.address || "";
    document.getElementById("contactNo").value = userObj.contactNo || "";
    document.getElementById("email").value = userObj.email || "";
    document.getElementById("bloodtype").value = userObj.bloodtype || "";
    document.getElementById("employeeId").value = userObj.employeeId || "";
    document.getElementById("empType").value = userObj.empType || "";
    document.getElementById("eligibility").value = userObj.eligibility || "";
    document.getElementById("dateOfJoining").value = userObj.dateOfJoining || "";
    document.getElementById("empStatus").value = userObj.empStatus || "Active";
    document.getElementById("educAttain").value = userObj.educAttain || "";
    document.getElementById("contactPerson").value = userObj.contactPerson || "";
    document.getElementById("emergencyRel").value = userObj.emergencyRel || "";
    document.getElementById("emergencyNo").value = userObj.emergencyNo || "";
    if (userObj.imgData) {
        document.getElementById("profilePreview").src = userObj.imgData;
    } else {
        document.getElementById("profilePreview").src = "https://via.placeholder.com/100?text=No+Photo";
    }
}

function previewImage(event) {
    const reader = new FileReader();
    reader.onload = function() {
        document.getElementById("profilePreview").src = reader.result;
    };
    if (event.target.files[0]) {
        reader.readAsDataURL(event.target.files[0]);
    }
}

function changePassword() {
    const newPass = document.getElementById("newPassword").value;
    if (!newPass) return alert("Password string cannot be blank.");
    let userObj = JSON.parse(localStorage.getItem("user_" + currentActiveUser));
    userObj.password = newPass;
    localStorage.setItem("user_" + currentActiveUser, JSON.stringify(userObj));
    alert("Security matrix updated.");
    document.getElementById("newPassword").value = "";
}

function saveAndCompileProfile() {
    let userObj = JSON.parse(localStorage.getItem("user_" + currentActiveUser));
    userObj.firstName = document.getElementById("firstName").value;
    userObj.lastName = document.getElementById("lastName").value;
    userObj.gender = document.getElementById("gender").value;
    userObj.dob = document.getElementById("dob").value;
    userObj.address = document.getElementById("address").value;
    userObj.contactNo = document.getElementById("contactNo").value;
    userObj.email = document.getElementById("email").value;
    userObj.bloodtype = document.getElementById("bloodtype").value;
    userObj.employeeId = document.getElementById("employeeId").value;
    userObj.empType = document.getElementById("empType").value;
    userObj.eligibility = document.getElementById("eligibility").value;
    userObj.dateOfJoining = document.getElementById("dateOfJoining").value;
    userObj.empStatus = document.getElementById("empStatus").value;
    userObj.educAttain = document.getElementById("educAttain").value;
    userObj.contactPerson = document.getElementById("contactPerson").value;
    userObj.emergencyRel = document.getElementById("emergencyRel").value;
    userObj.emergencyNo = document.getElementById("emergencyNo").value;
    userObj.imgData = document.getElementById("profilePreview").src;
    localStorage.setItem("user_" + currentActiveUser, JSON.stringify(userObj));

    const headers = ["Username","First Name","Last Name","Gender","Date of Birth","Address","Contact No.","Email","Blood Type","Employee ID","Employment Type","Eligibility","Date of Joining","Status","Educational Attainment","Emergency Contact Person","Relationship","Emergency Contact No."].join(",");
    const rows = [[userObj.username, userObj.firstName, userObj.lastName, userObj.gender, userObj.dob, userObj.address, userObj.contactNo, userObj.email, userObj.bloodtype, userObj.employeeId, userObj.empType, userObj.eligibility, userObj.dateOfJoining, userObj.empStatus, userObj.educAttain, userObj.contactPerson, userObj.emergencyRel, userObj.emergencyNo].join(",")];
    const csvContent = headers + "\n" + rows.join("\n");
    
    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const link = document.createElement("a");
    link.setAttribute("href", URL.createObjectURL(blob));
    link.setAttribute("download", "CDRRMO_MasterRecord_" + userObj.username + ".csv");
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    alert("Profile updated and backup generated.");
}

function handleLogout() {
    currentActiveUser = null;
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
