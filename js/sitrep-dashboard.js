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

async function loadSitrepDashboard(force) {
    if (!force && sitrepLoaded) {
        renderSitrepDashboard();
        return;
    }
    const body = document.getElementById("sitrepTableBody");
    try {
        const { data, error } = await supabaseClient.functions.invoke("sitrep-data", {
            body: { action: "sitreps" }
        });
        if (error) throw error;
        if (!data || !data.ok) throw new Error((data && data.error) || "Failed to load sitreps");
        sitrepRows = data.rows || [];
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

    const collapse = document.getElementById("sitrepTableCollapse");
    if (collapse && typeof bootstrap !== "undefined") {
        bootstrap.Collapse.getOrCreateInstance(collapse, { toggle: false }).show();
        const btn = document.querySelector('[data-bs-target="#sitrepTableCollapse"]');
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
    renderBarangayChart(drill);
    renderHourChart(drill);
    renderWeekdayChart(drill);
    renderMonthlyChart(drill);
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
        return;
    }
    list.innerHTML = top.map(([cause, count], i) => {
        const filterVal = cause === "Unknown / No cause" ? "__unknown" : cause;
        return `<button type="button" class="list-group-item list-group-item-action d-flex justify-content-between align-items-center py-2" onclick='applyCauseFilter(${JSON.stringify(filterVal)})' title="Show sitreps with this cause">
            <span class="small"><span class="badge bg-secondary me-2">${i + 1}</span>${esc(cause)}</span>
            <span class="fw-bold">${count}</span>
        </button>`;
    }).join("");
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
        return `<tr>
            <td>${esc(r["SITREP #"])}</td>
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
        "Patient", "Age", "Address", "Injuries", "Victim Status", "Initial Impression",
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

document.addEventListener("DOMContentLoaded", function () {
    ["sitrepDateFrom", "sitrepDateTo", "sitrepTeamFilter", "sitrepNatureFilter", "sitrepBarangayFilter", "sitrepCauseFilter"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", function () {
            sitrepTableCause = "";
            sitrepPage = 1;
            renderSitrepDashboard();
        });
    });
});
