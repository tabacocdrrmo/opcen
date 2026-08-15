// SITREP Insights dashboard (admin only). All sitrep rows come through the
// authenticated sitrep-data edge function, so the Apps Script sheet stays
// token-protected. Causes are derived from English keywords found in the free
// text columns (Remarks, Initial Impression, Injuries, Nature of Incident).

const CAUSE_KEYWORDS = {
    "Alcohol-related": ["alcohol", "drunk", "intoxicated", "drinking", "liquor"],
    "Animal on road": ["hit a dog", "hit an animal", "hit a stray", "ran over a dog", "ran over an animal", "dog got hit", "animal collision"],
    "Dog/Animal bite": ["dog bite", "animal bite", "bite"],
    "Hit-and-run": ["hit and run", "hit-and-run", "hit & run"],
    "Reckless/overspeeding": ["reckless", "overspeeding", "speeding"],
    "Motorcycle involved": ["motorcycle", "motorbike"],
    "Pedestrian involved": ["pedestrian", "hit a person", "hit a man", "hit a woman"],
    "Drowning": ["drown", "drowning"],
    "Heat stroke": ["heat stroke", "heatstroke"],
    "Cardiac/medical": ["cardiac", "heart attack", "stroke"],
    "Fire-related": ["fire", "burning", "smoke"],
    "Physical altercation": ["fight", "assault", "stabbed", "altercation"]
};

const PRECAUTIONS = {
    "Alcohol-related": [
        "Strengthen late-night patrols near bars, karaoke and drinking spots.",
        "Add manpower on Fri-Sun evenings, when alcohol incidents peak.",
        "Coordinate with barangay tanods on rowdy establishments."
    ],
    "Animal on road": [
        "Issue lighting and signage advisories on stretches with frequent animal hits.",
        "Brief dawn and dusk patrols to slow down in open road sections.",
        "Coordinate with barangay officials on loose/stray animal reports."
    ],
    "Dog/Animal bite": [
        "Advise immediate anti-rabies referral for bite victims.",
        "Coordinate with the City Veterinary Office on stray dog sightings.",
        "Include bite first aid (wash, no covering) in responder refreshers."
    ],
    "Hit-and-run": [
        "Advise units to secure witnesses and dashcam footage on scene.",
        "Remind responders to note plate numbers and vehicle descriptions.",
        "Coordinate with police for early CCTV/barangay camera retrieval."
    ],
    "Reckless/overspeeding": [
        "Request speed-enforcement support from police on high-incident roads.",
        "Add visible signage/bumps at identified fast-stretch hotspots.",
        "Conduct driver-safety reminders with motorist groups."
    ],
    "Motorcycle involved": [
        "Reinforce helmet and protective-gear reminders.",
        "Target rider-safety advisories at identified peak hours.",
        "Coordinate with transport groups for visibility campaigns."
    ],
    "Pedestrian involved": [
        "Enhance lighting and crosswalk visibility at high-hit crossings.",
        "Brief drivers on pedestrian priority near schools and markets.",
        "Coordinate sidewalk/barrier improvements with the engineering office."
    ],
    "Drowning": [
        "Pre-season coastal and river watch before holidays.",
        "Verify lifeguard presence, floats and rescue lines at known swimming spots.",
        "Remind responders on water-rescue gear readiness."
    ],
    "Heat stroke": [
        "Air advisories on hydration for outdoor workers.",
        "Schedule responders for early-morning hydration and rest breaks.",
        "Ensure cold packs and IV fluids stocked in peak heat months."
    ],
    "Cardiac/medical": [
        "Hold regular CPR and AED refresher training.",
        "Confirm cardiac/medical kit stock on all marked units.",
        "Coordinate rapid referral routes to the nearest hospital."
    ],
    "Fire-related": [
        "Pre-season fire-safety inspections on informal settlements.",
        "Check extinguisher placement in markets and public buildings.",
        "Coordinate evacuation drills and crowd control with the fire bureau."
    ],
    "Physical altercation": [
        "Deploy peacekeeping teams to known hot spots on weekends.",
        "Coordinate with police and barangay for conflict de-escalation.",
        "Remind responders to request police back-up on assault scenes."
    ]
};

// Barangays of Tabaco City. "Place of Incident" is free text (e.g. "near 7/11 Panal"),
// so we match the known barangay word inside it and count by that name.
const BARANGAYS = [
    { name: "Agnas", keys: ["agnas"] },
    { name: "Bacolod", keys: ["bacolod"] },
    { name: "Bangkilingan", keys: ["bangkilingan", "bankilingan"] },
    { name: "Bantayan", keys: ["bantayan"] },
    { name: "Baranghawon", keys: ["baranghawon"] },
    { name: "Basagan", keys: ["basagan"] },
    { name: "Basud", keys: ["basud"] },
    { name: "Bogñabong", keys: ["bognabong"] },
    { name: "Bombon", keys: ["bombon"] },
    { name: "Bonot", keys: ["bonot"] },
    { name: "Buang", keys: ["buang"] },
    { name: "Buhian", keys: ["buhian"] },
    { name: "Cabagñan", keys: ["cabagnan"] },
    { name: "Cobo", keys: ["cobo"] },
    { name: "Comon", keys: ["comon"] },
    { name: "Cormidal", keys: ["cormidal"] },
    { name: "Divino Rostro", keys: ["divinorostro"] },
    { name: "Fatima", keys: ["fatima"] },
    { name: "Guinobat", keys: ["guinobat"] },
    { name: "Hacienda", keys: ["hacienda"] },
    { name: "Magapo", keys: ["magapo"] },
    { name: "Mariroc", keys: ["mariroc"] },
    { name: "Matagbac", keys: ["matagbac"] },
    { name: "Oras", keys: ["oras"] },
    { name: "Oson", keys: ["oson"] },
    { name: "Panal", keys: ["panal"] },
    { name: "Pawa", keys: ["pawa"] },
    { name: "Pinagbobong", keys: ["pinagbobong"] },
    { name: "Quinale Cabasan", keys: ["quinalecabasan", "quinale"] },
    { name: "Quinastillojan", keys: ["quinastillojan"] },
    { name: "Rawis", keys: ["rawis"] },
    { name: "Sagurong", keys: ["sagurong"] },
    { name: "Salvacion", keys: ["salvacion"] },
    { name: "San Antonio", keys: ["sanantonio"] },
    { name: "San Carlos", keys: ["sancarlos"] },
    { name: "San Isidro", keys: ["sanisidro"] },
    { name: "San Juan", keys: ["sanjuan"] },
    { name: "San Lorenzo", keys: ["sanlorenzo"] },
    { name: "San Ramon", keys: ["sanramon"] },
    { name: "San Roque", keys: ["sanroque"] },
    { name: "Santo Cristo", keys: ["santocristo", "stocristo"] },
    { name: "San Vicente", keys: ["sanvicente"] },
    { name: "Sua-Igot", keys: ["suaigot"] },
    { name: "Tabiguian", keys: ["tabiguian"] },
    { name: "Tagas", keys: ["tagas"] },
    { name: "Tayhi", keys: ["tayhi"] },
    { name: "Visita", keys: ["visita"] }
];

function normalizePlace(value) {
    const raw = String(value || "").trim();
    if (!raw) return "";
    const norm = raw.toLowerCase()
        .replace(/ñ/g, "n")
        .replace(/[^a-z0-9]/g, "");
    for (const b of BARANGAYS) {
        for (const key of b.keys) {
            if (norm.includes(key)) return b.name;
        }
    }
    return raw;
}

const CHART_COLORS = [
    "#0d6efd", "#dc3545", "#198754", "#ffc107", "#6f42c1", "#fd7e14",
    "#20c997", "#0dcaf0", "#d63384", "#6c757d", "#6610f2", "#74c0fc"
];

const WEEKDAY_LABELS = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];
const MONTH_LABELS = ["Jan", "Feb", "Mar", "Apr", "May", "Jun", "Jul", "Aug", "Sep", "Oct", "Nov", "Dec"];

let sitrepRows = [];
let sitrepLog = [];
let sitrepLoaded = false;
let sitrepChartInstances = {};
let sitrepPage = 1;
let sitrepTableCause = "";
const SITREP_PAGE_SIZE = 10;

function esc(v) {
    return String(v ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
}

function setText(id, v) {
    const el = document.getElementById(id);
    if (el) el.innerText = v;
}

function uniqueSorted(arr) {
    return [...new Set(arr)].sort();
}

function splitCell(v) {
    return String(v || "").split(";").map(s => s.trim()).filter(Boolean);
}

function countPatients(r) {
    return splitCell(r["Patient"]).length;
}

function tagSitrep(row) {
    const text = [
        row["Remarks"], row["Initial Impression"], row["Injuries"], row["Nature of Incident"]
    ].filter(Boolean).join(" ").toLowerCase();
    const tags = [];
    Object.keys(CAUSE_KEYWORDS).forEach(cause => {
        if (CAUSE_KEYWORDS[cause].some(k => text.includes(k))) tags.push(cause);
    });
    return tags;
}

async function ensureFreshSession() {
    const { data: sess } = await supabaseClient.auth.getSession();
    const s = sess && sess.session;
    if (s && s.expires_at && Date.now() / 1000 > s.expires_at - 120) {
        try { await supabaseClient.auth.refreshSession(); } catch (_) {}
    }
}

async function loadSitrepDashboard(force) {
    if (!force && sitrepLoaded) {
        renderSitrepDashboard();
        return;
    }
    const body = document.getElementById("sitrepTableBody");
    try {
        await ensureFreshSession();
        const { data, error } = await supabaseClient.functions.invoke("sitrep-data", {
            body: { action: "sitreps" }
        });
        if (error) {
            const status = (error.context && error.context.status) || 0;
            if (status === 401 || status === 403) {
                if (typeof handleLogout === "function") { handleLogout(); } else { window.location.href = "index.html"; }
                return;
            }
            throw error;
        }
        if (!data || !data.ok) throw new Error((data && data.error) || "Failed to load sitreps");
        sitrepRows = data.rows || [];
        sitrepLog = data.log || [];
        sitrepLoaded = true;
        populateSitrepFilters();
        renderSitrepDashboard();
    } catch (err) {
        if (body) body.innerHTML = '<tr><td colspan="9" class="text-center text-danger py-4">Failed to load SITREP data: ' + esc(err.message || err) + '</td></tr>';
    }
}

function populateSitrepFilters() {
    const teams = uniqueSorted(sitrepRows.map(r => String(r["Assigned Team"] || "").trim()).filter(Boolean));
    const natures = uniqueSorted(sitrepRows.map(r => String(r["Nature of Incident"] || "").trim()).filter(Boolean));
    const barangays = uniqueSorted(sitrepRows.map(r => normalizePlace(r["Barangay"])).filter(Boolean));
    fillSelect("sitrepTeamFilter", teams, "All Teams");
    fillSelect("sitrepNatureFilter", natures, "All Natures");
    fillSelect("sitrepBarangayFilter", barangays, "All Places");

    const causeEl = document.getElementById("sitrepCauseFilter");
    if (causeEl) {
        const prev = causeEl.value;
        causeEl.innerHTML = '<option value="">All Causes</option>' +
            '<option value="__unknown">Unknown / No cause</option>' +
            Object.keys(CAUSE_KEYWORDS).map(c => `<option>${esc(c)}</option>`).join("");
        if (prev) causeEl.value = prev;
    }
}

function fillSelect(id, values, allLabel) {
    const el = document.getElementById(id);
    if (!el) return;
    const prev = el.value;
    el.innerHTML = `<option value="">${esc(allLabel)}</option>` + values.map(v => `<option>${esc(v)}</option>`).join("");
    if (prev) el.value = prev;
}

function resetSitrepFilters() {
    ["sitrepDateFrom", "sitrepDateTo", "sitrepTeamFilter", "sitrepNatureFilter", "sitrepBarangayFilter", "sitrepCauseFilter"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.value = "";
    });
    sitrepTableCause = "";
    sitrepPage = 1;
    renderSitrepDashboard();
}

// Table-only drill-down: clicking a cause in the top-5 list or the cause chart
// filters only the records table (not the stat cards, charts, or top-5 panel).
function applyCauseFilter(cause) {
    sitrepTableCause = cause || "";
    sitrepPage = 1;
    renderSitrepDashboard();
    expandSitrepCard("sitrepTableCollapse");
}

function expandSitrepCard(cardId) {
    const collapse = document.getElementById(cardId);
    if (collapse && typeof bootstrap !== "undefined") {
        bootstrap.Collapse.getOrCreateInstance(collapse, { toggle: false }).show();
        const btn = document.querySelector('[data-bs-target="#' + cardId + '"]');
        const icon = btn && btn.querySelector("i");
        if (icon) {
            icon.classList.remove("fa-chevron-down");
            icon.classList.add("fa-chevron-up");
        }
    }
}

function clearSitrepTableCause() {
    sitrepTableCause = "";
    sitrepPage = 1;
    renderSitrepDashboard();
}

function matchesCause(r, cause) {
    if (!cause) return true;
    const tags = tagSitrep(r);
    if (cause === "__unknown") return tags.length === 0;
    return tags.indexOf(cause) !== -1;
}

function getFilteredSitreps() {
    const from = document.getElementById("sitrepDateFrom").value;
    const to = document.getElementById("sitrepDateTo").value;
    const team = document.getElementById("sitrepTeamFilter").value;
    const nature = document.getElementById("sitrepNatureFilter").value;
    const barangay = document.getElementById("sitrepBarangayFilter").value;
    const cause = document.getElementById("sitrepCauseFilter").value;

    return sitrepRows.filter(r => {
        const d = String(r["Call Date"] || "");
        if (from && d < from) return false;
        if (to && d > to) return false;
        if (team && String(r["Assigned Team"] || "").trim() !== team) return false;
        if (nature && String(r["Nature of Incident"] || "").trim() !== nature) return false;
        if (barangay && normalizePlace(r["Barangay"]) !== barangay) return false;
        if (!matchesCause(r, cause)) return false;
        return true;
    });
}

function getSitrepTableRows() {
    const rows = getFilteredSitreps();
    return sitrepTableCause ? rows.filter(r => matchesCause(r, sitrepTableCause)) : rows;
}

function renderSitrepDashboard() {
    const filtered = getFilteredSitreps();
    const drill = sitrepTableCause ? filtered.filter(r => matchesCause(r, sitrepTableCause)) : filtered;
    updateSitrepStats(drill, filtered);
    renderCauseChart(filtered);
    renderNatureChart(drill);
    renderNatureTiles(drill);
    renderBarangayChart(drill);
    renderHourChart(drill);
    renderWeekdayChart(drill);
    renderMonthlyChart(drill);
    renderRecommendations(drill);
    renderSitrepTable();
}

function updateSitrepStats(rows, topRows) {
    const now = new Date();
    const thisMonth = String(now.getFullYear()) + "-" + String(now.getMonth() + 1).padStart(2, "0");
    let demised = 0;
    rows.forEach(r => {
        if (String(r["Victim Status"] || "").toLowerCase().includes("demised")) demised++;
    });

    setText("sitrepStatTotal", rows.length);
    const monthLabel = now.toLocaleString("en-US", { month: "long", year: "numeric" });
    setText("sitrepMonthLabel", monthLabel);
    setText("sitrepStatMonth", rows.filter(r => String(r["Call Date"] || "").startsWith(thisMonth)).length);
    setText("sitrepStatFatal", demised);

    const source = topRows || rows;
    const causeCounts = {};
    source.forEach(r => tagSitrep(r).forEach(c => causeCounts[c] = (causeCounts[c] || 0) + 1));
    const unknown = source.filter(r => tagSitrep(r).length === 0).length;
    if (unknown > 0) causeCounts["Unknown / No cause"] = unknown;
    renderTopCauses(causeCounts);
}

function renderTopCauses(causeCounts) {
    const list = document.getElementById("topCausesList");
    if (!list) return;

    const natureEl = document.getElementById("sitrepNatureFilter");
    const badge = document.getElementById("topCausesNatureBadge");
    if (badge) badge.innerText = natureEl && natureEl.value ? natureEl.value : "All Natures";

    const top = Object.entries(causeCounts)
        .sort((a, b) => b[1] - a[1] || (a[0] < b[0] ? -1 : 1))
        .slice(0, 5);
    if (!top.length) {
        list.innerHTML = '<div class="list-group-item text-muted text-center py-3 small">No cause data for the current filters.</div>';
    } else {
        list.innerHTML = top.map(([cause, count], i) => {
            const filterVal = cause === "Unknown / No cause" ? "__unknown" : cause;
            return `<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2" onclick='applyCauseFilter(${JSON.stringify(filterVal)})' title="Show sitreps with this cause">
            <span class="small"><span class="badge bg-secondary me-2">${i + 1}</span>${esc(cause)}</span>
            <span class="fw-bold">${count}</span>
        </button>`;
        }).join("");
    }
}
function renderRecommendations(rows, listId, summaryId) {
    const list = document.getElementById(listId || "preventiveList");
    const summaryEl = document.getElementById(summaryId || "preventiveSummary");
    if (!list) return;

    if (!rows.length) {
        list.innerHTML = '<div class="text-muted small text-center py-3">No data for the current filters.</div>';
        if (summaryEl) summaryEl.innerText = "";
        return;
    }

    const counts = {};
    const fatalities = {};
    rows.forEach(r => {
        const demised = String(r["Victim Status"] || "").toLowerCase().includes("demised");
        tagSitrep(r).forEach(c => {
            counts[c] = (counts[c] || 0) + 1;
            if (demised) fatalities[c] = (fatalities[c] || 0) + 1;
        });
    });

    const ranked = Object.keys(counts)
        .map(cause => ({ cause, count: counts[cause], fatal: fatalities[cause] || 0 }))
        .sort((a, b) => (b.fatal > 0) - (a.fatal > 0) || b.count - a.count || (a.cause < b.cause ? -1 : 1));

    const unknownCount = rows.filter(r => tagSitrep(r).length === 0).length;
    const items = ranked.slice(0, 8).map(({ cause, count, fatal }) => {
        const tips = PRECAUTIONS[cause] || ["Review response plans for this cause type."];
        const pct = Math.round((count / rows.length) * 100);
        const fatalBadge = fatal > 0
            ? ` <span class="badge bg-danger ms-1" title="Sitreps with deaths">${fatal} fatal${fatal > 1 ? "s" : ""}</span>`
            : "";
        return `<div class="preventive-item">
            <div class="small fw-semibold">${esc(cause)} <span class="text-muted fw-normal">${count} (${pct}%)</span>${fatalBadge}</div>
            <ul class="small text-muted ps-3 mb-1 mt-1">
                ${tips.map(t => `<li>${esc(t)}</li>`).join("")}
            </ul>
        </div>`;
    });

    if (unknownCount > 0) {
        items.push(`<div class="small text-muted ps-3 mb-1"><i class="fa-solid fa-circle-info me-1"></i>${unknownCount} sitrep${unknownCount > 1 ? "s have" : " has"} no identifiable cause - consider more detailed documentation.</div>`);
    }

    list.innerHTML = items.join("");
    if (summaryEl) summaryEl.innerText = buildPreventiveSummary(rows);
}

function buildPreventiveSummary(rows) {
    const causes = [];
    const places = [];
    const hours = [];
    const days = [];
    const teams = [];
    rows.forEach(r => {
        tagSitrep(r).forEach(c => causes.push(c));
        const p = normalizePlace(r["Barangay"]);
        if (p) places.push(p);
        const h = timeHour(r["Call Time"]);
        if (h != null) hours.push(h);
        const d = dateDayOfWeek(r["Call Date"]);
        if (d != null) days.push(d);
        const t = String(r["Assigned Team"] || "").trim();
        if (t) teams.push(t);
    });

    const parts = [];
    const tc = modeOf(causes);
    const tp = modeOf(places);
    const th = modeOf(hours);
    const td = modeOf(days);
    const tt = modeOf(teams);

    if (tc) parts.push("Leading cause: " + tc + ".");
    if (tp) parts.push("Most affected place: " + tp + ".");
    if (th != null) parts.push("Peak hour: " + hourLabel(th) + ".");
    if (td != null) parts.push("Peak day: " + WEEKDAY_LABELS[td] + ".");
    if (tt) parts.push("Most deployed team: " + tt + ".");
    return parts.join(" ");
}

function timeHour(v) {
    const s = String(v || "").trim();
    const m = s.match(/(\d{1,2}):(\d{2})\s*([AP]M)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const ap = (m[3] || "").toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h;
}

function dateDayOfWeek(v) {
    const m = String(v || "").match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return null;
    return new Date(+m[1], +m[2] - 1, +m[3]).getDay();
}

function modeOf(values) {
    const map = {};
    let best = null;
    let bestN = 0;
    values.forEach(v => {
        map[v] = (map[v] || 0) + 1;
        if (map[v] > bestN) {
            bestN = map[v];
            best = v;
        }
    });
    return best;
}

function hourLabel(h) {
    const ap = h < 12 ? "AM" : "PM";
    const hh = h % 12 === 0 ? 12 : h % 12;
    return hh + ":00 " + ap;
}

function countBy(rows, field) {
    const map = {};
    rows.forEach(r => {
        const k = String(r[field] || "").trim();
        if (!k) return;
        map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function countByPlace(rows) {
    const map = {};
    rows.forEach(r => {
        const k = normalizePlace(r["Barangay"]);
        if (!k) return;
        map[k] = (map[k] || 0) + 1;
    });
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function topWithOthers(entries, n) {
    const top = entries.slice(0, n);
    const rest = entries.slice(n);
    if (rest.length) top.push(["Others", rest.reduce((s, e) => s + e[1], 0)]);
    return top;
}

function buildChart(id, config) {
    if (typeof Chart === "undefined") return;
    if (sitrepChartInstances[id]) sitrepChartInstances[id].destroy();
    const el = document.getElementById(id);
    if (!el) return;
    sitrepChartInstances[id] = new Chart(el.getContext("2d"), config);
}

function baseOpts() {
    return {
        responsive: true,
        maintainAspectRatio: false,
        plugins: { legend: { display: false } },
        scales: {
            x: { beginAtZero: true, ticks: { font: { size: 10 } } },
            y: { beginAtZero: true, ticks: { font: { size: 10 } } }
        }
    };
}

function renderCauseChart(rows) {
    const counts = {};
    rows.forEach(r => tagSitrep(r).forEach(c => counts[c] = (counts[c] || 0) + 1));
    const unknown = rows.filter(r => tagSitrep(r).length === 0).length;
    if (unknown > 0) counts["Unknown / No cause"] = unknown;
    const sorted = Object.entries(counts).sort((a, b) => b[1] - a[1]);
    const causes = sorted.map(e => e[0]);
    buildChart("causeChart", {
        type: "bar",
        data: {
            labels: causes,
            datasets: [{ label: "SITREPs", data: sorted.map(e => e[1]), backgroundColor: causes.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]) }]
        },
        options: {
            ...baseOpts(),
            indexAxis: "y",
            onClick: function (evt, items) {
                if (!items || !items.length) return;
                const cause = causes[items[0].index];
                applyCauseFilter(cause === "Unknown / No cause" ? "__unknown" : cause);
            },
            onHover: function (evt, items) {
                evt.native.target.style.cursor = items && items.length ? "pointer" : "default";
            }
        }
    });
}

function renderNatureChart(rows) {
    const sorted = topWithOthers(countBy(rows, "Nature of Incident"), 10);
    buildChart("natureChart", {
        type: "bar",
        data: {
            labels: sorted.map(e => e[0]),
            datasets: [{ label: "SITREPs", data: sorted.map(e => e[1]), backgroundColor: "#0d6efd" }]
        },
        options: baseOpts()
    });
}

function renderNatureTiles(rows) {
    const ids = ["natureTile1", "natureTile2", "natureTile3", "natureTile4"];
    const colors = ["text-primary", "text-info", "text-warning", "text-success"];
    const counts = countBy(rows, "Nature of Incident");
    ids.forEach((id, i) => {
        const tile = document.getElementById(id);
        if (!tile) return;
        const [nature, count] = counts[i] || [null, 0];
        tile.innerHTML = nature
            ? `<div class="text-muted small text-uppercase">${esc(nature)}</div><div class="fw-bold fs-4 ${colors[i]}">${count}</div>`
            : `<div class="text-muted small text-uppercase">No nature data</div><div class="fw-bold fs-4 ${colors[i]}">0</div>`;
    });
}

function renderBarangayChart(rows) {
    const sorted = topWithOthers(countByPlace(rows), 10);
    buildChart("barangayChart", {
        type: "bar",
        data: {
            labels: sorted.map(e => e[0]),
            datasets: [{ label: "SITREPs", data: sorted.map(e => e[1]), backgroundColor: sorted.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]) }]
        },
        options: { ...baseOpts(), indexAxis: "y" }
    });
}

function renderHourChart(rows) {
    const hours = new Array(24).fill(0);
    rows.forEach(r => {
        const m = /^(\d{1,2}):/.exec(String(r["Call Time"] || "").trim());
        if (m) {
            const h = Number(m[1]);
            if (h >= 0 && h <= 23) hours[h]++;
        }
    });
    buildChart("hourChart", {
        type: "bar",
        data: {
            labels: hours.map((_, i) => String(i).padStart(2, "0")),
            datasets: [{ label: "SITREPs", data: hours, backgroundColor: "#6f42c1" }]
        },
        options: baseOpts()
    });
}

function renderWeekdayChart(rows) {
    const wd = new Array(7).fill(0);
    rows.forEach(r => {
        const d = new Date(String(r["Call Date"] || ""));
        if (!isNaN(d.getTime())) wd[d.getDay()]++;
    });
    buildChart("weekdayChart", {
        type: "bar",
        data: {
            labels: WEEKDAY_LABELS,
            datasets: [{ label: "SITREPs", data: wd, backgroundColor: "#fd7e14" }]
        },
        options: baseOpts()
    });
}

function renderMonthlyChart(rows) {
    const map = {};
    rows.forEach(r => {
        const k = String(r["Call Date"] || "").slice(0, 7);
        if (k) map[k] = (map[k] || 0) + 1;
    });
    const keys = Object.keys(map).sort();
    buildChart("monthlyChart", {
        type: "line",
        data: {
            labels: keys.map(k => {
                const parts = k.split("-");
                return MONTH_LABELS[Number(parts[1]) - 1] + " " + parts[0];
            }),
            datasets: [{
                label: "SITREPs",
                data: keys.map(k => map[k]),
                borderColor: "#198754",
                backgroundColor: "rgba(25,135,84,0.15)",
                fill: true,
                tension: 0.3,
                pointRadius: 3
            }]
        },
        options: baseOpts()
    });
}

function sitrepSortVal(r) {
    const m = /^(\d{4})-(\d+)$/.exec(String(r["SITREP #"] || "").trim());
    return m ? Number(m[1]) * 100000 + Number(m[2]) : 0;
}

function toggleSitrepChevron(btn) {
    const icon = btn && btn.querySelector("i");
    if (icon) icon.classList.toggle("fa-chevron-up");
}

function renderSitrepTable() {
    const body = document.getElementById("sitrepTableBody");
    if (!body) return;
    const rows = getSitrepTableRows().slice().sort((a, b) => sitrepSortVal(b) - sitrepSortVal(a));
    const totalPages = Math.max(1, Math.ceil(rows.length / SITREP_PAGE_SIZE));
    sitrepPage = Math.min(sitrepPage, totalPages);

    const countEl = document.getElementById("sitrepRecordCount");
    if (countEl) countEl.innerText = rows.length ? "(" + rows.length + " record" + (rows.length === 1 ? "" : "s") + ")" : "";

    const chip = document.getElementById("sitrepTableCauseChip");
    if (chip) {
        if (sitrepTableCause) {
            const label = sitrepTableCause === "__unknown" ? "Unknown / No cause" : sitrepTableCause;
            chip.innerHTML = '<span class="badge bg-primary">' + esc(label) + ' <a href="#" onclick="clearSitrepTableCause(); return false;" class="text-white" style="text-decoration:none;" title="Clear cause">&times;</a></span>';
        } else {
            chip.innerHTML = "";
        }
    }

    if (rows.length === 0) {
        body.innerHTML = '<tr><td colspan="9" class="text-center text-muted py-4">No records match the filters.</td></tr>';
        renderSitrepPagination(0, totalPages);
        return;
    }

    const start = (sitrepPage - 1) * SITREP_PAGE_SIZE;
    body.innerHTML = rows.slice(start, start + SITREP_PAGE_SIZE).map(r => {
        const causes = tagSitrep(r);
        return `<tr data-no="${esc(r["SITREP #"])}" style="cursor:pointer;" title="Click to view SITREP details">
            <td class="fw-medium">${esc(r["SITREP #"])}</td>
            <td>${esc(r["Call Date"])}</td>
            <td class="d-none d-md-table-cell">${esc(r["Recorded At"])}</td>
            <td>${esc(r["Nature of Incident"])}</td>
            <td>${esc(r["Assigned Team"])}</td>
            <td class="d-none d-sm-table-cell">${esc(normalizePlace(r["Barangay"]))}</td>
            <td>${countPatients(r)}</td>
            <td class="d-none d-lg-table-cell text-truncate" title="${esc(r["Victim Status"])}">${esc(r["Victim Status"])}</td>
            <td>${causes.length ? causes.map(esc).join(", ") : '<span class="text-muted">&mdash;</span>'}</td>
        </tr>`;
    }).join("");
    renderSitrepPagination(rows.length, totalPages);
}

function renderSitrepPagination(total, totalPages) {
    const el = document.getElementById("sitrepPagination");
    if (!el) return;
    if (totalPages <= 1) {
        el.innerHTML = "";
        return;
    }
    el.innerHTML = `<nav><ul class="pagination pagination-sm justify-content-center mb-0 mt-2">
        <li class="page-item ${sitrepPage <= 1 ? "disabled" : ""}"><a class="page-link" href="#" onclick="changeSitrepPage(-1); return false;">&laquo;</a></li>
        <li class="page-item disabled"><a class="page-link" href="#">Page ${sitrepPage} of ${totalPages} (${total} records)</a></li>
        <li class="page-item ${sitrepPage >= totalPages ? "disabled" : ""}"><a class="page-link" href="#" onclick="changeSitrepPage(1); return false;">&raquo;</a></li>
    </ul></nav>`;
}

function changeSitrepPage(delta) {
    sitrepPage += delta;
    renderSitrepTable();
}

function exportSitrepCsv() {
    if (!sitrepRows.length) return alert("No SITREP data to export.");
    const headers = [
        "SITREP #", "Recorded At", "Call Date", "Call Time", "Nature of Incident",
        "Assigned Team", "Shift-In-Charge (SIC)", "Operator in Charge", "Place of Incident", "Municipality",
        "Patient", "Sex", "Age", "Address", "Injuries", "Victim Status", "Initial Impression",
        "Disposition", "PCR By", "Remarks", "Causes"
    ];
    const rows = getSitrepTableRows().map(r => {
        const vals = headers.slice(0, -1).map(h => h === "Place of Incident" ? normalizePlace(r["Barangay"]) : (r[h] != null ? r[h] : ""));
        vals.push(tagSitrep(r).join("; "));
        return vals;
    });
    const csv = [headers, ...rows].map(row => row.map(csvCell).join(",")).join("\r\n");
    const blob = new Blob(["\ufeff" + csv], { type: "text/csv;charset=utf-8;" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "sitrep_export_" + new Date().toISOString().slice(0, 10) + ".csv";
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
}

function csvCell(v) {
    const s = String(v == null ? "" : v);
    return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

// ---- SITREP detail (report-style modal, mirrors the SITREP View page) ----
function splitSlots(s) {
    return String(s ?? "").split(/;\s*|\n/).map(x => x.trim());
}

function sitrepFmt(v) {
    if (typeof v === "string") {
        const m = /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})/.exec(v);
        if (m && m[1] === "1899") {
            const d = new Date(v);
            if (!isNaN(d.getTime())) {
                const p = n => String(n).padStart(2, "0");
                return p(d.getHours()) + ":" + p(d.getMinutes());
            }
            return m[4] + ":" + m[5];
        }
    }
    if (!(v instanceof Date) || isNaN(v)) return v;
    const p = n => String(n).padStart(2, "0");
    if (v.getFullYear() >= 2000) return `${v.getFullYear()}-${p(v.getMonth() + 1)}-${p(v.getDate())}`;
    return `${p(v.getHours())}:${p(v.getMinutes())}`;
}

async function sitrepPhotoDataUrl(url) {
    if (/^data:/i.test(url)) return Promise.resolve(url);
    const idMatch = /\/d\/([^/]+)/.exec(url || "") ||
        /thumbnail\?id=([^&\s]+)/.exec(url || "") ||
        /[\?&]id=([^&\s]+)/.exec(url || "");
    const id = idMatch && idMatch[1];
    if (!id) return Promise.resolve(null);
    try {
        await ensureFreshSession();
        const { data } = await supabaseClient.functions.invoke("sitrep-data", {
            body: { action: "photo", id }
        });
        if (!data || !data.ok || !data.data) return null;
        return "data:" + data.type + ";base64," + data.data;
    } catch (err) {
        console.log("[sitrep photo] FAIL", String(err));
        return null;
    }
}

function renderSitrepReport(row) {
    const patients = splitSlots(row["Patient"]);
    const sexes = splitSlots(row["Sex"]);
    const ages = splitSlots(row["Age"]);
    const addresses = splitSlots(row["Address"]);
    const injuries = splitSlots(row["Injuries"]);
    const statuses = splitSlots(row["Victim Status"]);
    const impressions = splitSlots(row["Initial Impression"]);
    const dispositions = splitSlots(row["Disposition"]);
    const pcrBy = splitSlots(row["PCR By"]);
    const br = arr => arr.map(esc).join("<br>");

    const patientRows = patients.map((p, i) => `
        <tr>
            <td>${i + 1}</td>
            <td>${esc(p)}</td>
            <td>${esc(sexes[i] || "")}</td>
            <td>${esc(ages[i] || "")}</td>
            <td>${esc(addresses[i] || "")}</td>
            <td>${esc(injuries[i] || "")}</td>
            <td>${esc(statuses[i] || "")}</td>
            <td>${esc(impressions[i] || "")}</td>
            <td>${esc(dispositions[i] || "")}</td>
            <td>${esc(pcrBy[i] || "")}</td>
        </tr>`).join("");

    const photos = String(row["Photos"] || "").split("\n").map(s => s.trim()).filter(Boolean);
    const photoSection = photos.length ? `
        <h3 class="report-title attachments-title">Attachments</h3>
        <div class="report-photos">
            ${photos.map((u, i) => `
                <a href="${esc(u)}" target="_blank" rel="noopener">
                    <img class="saved-photo" data-photo="${esc(u)}" alt="Photo ${i + 1}">
                </a>`).join("")}
        </div>` : "";

    return `
        ${row["SITREP #"] ? `<div class="report-title" style="text-align:right;font-size:13px;margin-bottom:4px;">SITREP No. ${esc(row["SITREP #"])}</div>` : ""}
        <table class="report-table report-table-main">
            <tr><th>Nature of Incident</th><td>${esc(row["Nature of Incident"])}</td>
                <th>Assigned Team</th><td>${esc(row["Assigned Team"])}</td></tr>
            <tr><th>Shift-In-Charge</th><td>${esc(row["Shift-In-Charge (SIC)"])}</td>
                <th>Operator in Charge</th><td>${esc(row["Operator in Charge"])}</td></tr>
            <tr><th>Dispatched Resource(s)</th><td colspan="3">${splitJoined(row["Dispatched Resources"]).map(esc).join(", ")}</td></tr>
            <tr><th>Incident Caller / Informant</th><td>${esc(row["Incident Caller / Informant"])}</td>
                <th>Contact No.</th><td>${esc(row["Contact No."])}</td></tr>
            <tr><th>Call Date</th><td>${esc(sitrepFmt(row["Call Date"]))}</td>
                <th>Call Time</th><td>${esc(sitrepFmt(row["Call Time"]))}</td></tr>
            <tr><th>Dispatched Time</th><td>${esc(sitrepFmt(row["Dispatched Time"]))}</td>
                <th>Arrival at Scene</th><td>${esc(sitrepFmt(row["Arrival at Scene"]))}</td></tr>
            <tr><th>Take Off from Scene</th><td>${esc(sitrepFmt(row["Take Off from Scene"]))}</td>
                <th>Arrival at Hospital</th><td>${esc(sitrepFmt(row["Arrival at Hospital"]))}</td></tr>
            <tr><th>Place / Landmark</th><td>${esc(row["Barangay"])}</td>
                <th>Municipality</th><td>${esc(row["Municipality"])}</td></tr>
            <tr><th colspan="4">Patients / Victims Details</th></tr>
            <tr><td colspan="4">
                <div class="patients-wrap">
                <table class="report-table patients-table">
                    <tr><th style="width:5%">No.</th><th style="width:12%">Name</th><th style="width:5%">Sex</th><th style="width:6%">Age</th><th style="width:12%">Address</th><th style="width:12%">Injuries Description</th><th style="width:11%">Status of Victim</th><th style="width:13%">Initial Impression</th><th style="width:13%">Disposition</th><th style="width:11%">PCR By</th></tr>
                    ${patientRows}
                </table>
                </div>
            </td></tr>
            <tr><th>Involved Vehicle Type</th><td colspan="3">${splitJoined(row["Involved Vehicle Type"]).map(esc).join(", ")}</td></tr>
            <tr><th>First Aid Provided</th><td colspan="3">${esc(row["First Aid Provided"])}</td></tr>
            <tr><th>Remarks</th><td colspan="3">${esc(row["Remarks"])}</td></tr>
            <tr><th>Driver(s)</th><td>${br(splitJoined(row["Drivers"]))}</td>
                <th>Responder(s)</th><td>${br(splitJoined(row["Responders"]))}</td></tr>
        </table>
        ${photoSection}`;
}

function loadSitrepReportPhotos(scope) {
    if (!scope) return;
    scope.querySelectorAll(".report-photos img.saved-photo").forEach(img => {
        sitrepPhotoDataUrl(img.dataset.photo).then(dataUrl => {
            if (!dataUrl) return;
            img.src = dataUrl;
            const link = img.closest("a");
            if (link) link.href = dataUrl;
        });
    });
}

function showSitrepDetail(sitrepNo) {
    const row = getSitrepTableRows().find(r => String(r["SITREP #"]) === String(sitrepNo));
    if (!row) return;
    const box = document.getElementById("sitrepReportContent");
    if (!box) return;
    box.innerHTML = renderSitrepReport(row);
    loadSitrepReportPhotos(box);
    const modal = document.getElementById("sitrepDetailModal");
    if (modal && typeof bootstrap !== "undefined") {
        bootstrap.Modal.getOrCreateInstance(modal).show();
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const tbody = document.getElementById("sitrepTableBody");
    if (tbody) {
        tbody.addEventListener("click", function (e) {
            const tr = e.target.closest("tr[data-no]");
            if (tr) showSitrepDetail(tr.getAttribute("data-no"));
        });
    }
    ["sitrepDateFrom", "sitrepDateTo", "sitrepTeamFilter", "sitrepNatureFilter", "sitrepBarangayFilter", "sitrepCauseFilter"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", function () {
            sitrepTableCause = "";
            sitrepPage = 1;
            renderSitrepDashboard();
        });
    });
});
