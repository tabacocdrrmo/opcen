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
// CREW PORTAL - LOGIN (redirects to crew-portal.html)
// ==========================================
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

        if (acct.password_hash !== passIn) {
            return alert("Invalid credentials.");
        }

        sessionStorage.setItem("crewSession", JSON.stringify({
            username: userIn,
            employeeDbId: acct.employee_id,
            role: acct.role || "staff"
        }));

        const redirect = acct.role === "admin" ? "admin.html" : "crew-portal.html";
        window.location.href = redirect;
    } catch (err) {
        console.error("Login error:", err);
        alert("Database connection error: " + err.message);
    }
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
