// Team Dashboard (admin only). Per-team Alpha/Bravo/Charlie analytics built from
// the same sitrep rows as SITREP Insights (reuses sitrep-dashboard.js helpers).

let teamDashboardRows = [];
let teamDashboardLoaded = false;

async function loadTeamDashboard(force) {
    try {
        await loadSitrepDashboard(force);
        teamDashboardRows = sitrepRows;
        teamDashboardLoaded = true;
        renderTeamDashboard();
    } catch (err) {
        console.error("Failed to load team dashboard:", err);
        setText("teamCompareBody", '<tr><td colspan="7" class="text-center text-danger py-4">Failed to load: ' + esc(err.message || err) + '</td></tr>');
    }
}

function renderTeamDashboard() {
    const rows = teamFilteredRows();
    renderTeamCompare();
    renderTeamStats(rows);
    renderTeamMonthly(rows);
    renderTeamCoverage(rows);
    renderTeamResponderMonth();
}

function renderTeamResponderMonth() {
    const el = document.getElementById("teamResponderMonth");
    if (!el) return;
    const from = document.getElementById("teamDateFrom") ? document.getElementById("teamDateFrom").value : "";
    const to = document.getElementById("teamDateTo") ? document.getElementById("teamDateTo").value : "";
    const fmt = d => {
        const m = String(d || "").match(/^(\d{4})-(\d{2})-(\d{2})$/);
        if (!m) return "";
        return MONTH_LABELS[Number(m[2]) - 1] + " " + Number(m[3]) + ", " + m[1];
    };
    if (!from && !to) {
        el.innerText = "All months";
        return;
    }
    const f = fmt(from);
    const t = fmt(to);
    if (from && to && from === to) {
        el.innerText = f;
        return;
    }
    el.innerText = [f, t].filter(Boolean).join(" – ") || "All months";
}

function teamFilteredRows() {
    const sel = document.getElementById("teamDashboardTeam");
    const team = sel ? sel.value : "";
    const from = document.getElementById("teamDateFrom") ? document.getElementById("teamDateFrom").value : "";
    const to = document.getElementById("teamDateTo") ? document.getElementById("teamDateTo").value : "";
    return teamDashboardRows.filter(r => {
        const d = String(r["Call Date"] || "");
        if (team && String(r["Assigned Team"] || "").trim() !== team) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
    });
}

function teamStatsOf(team) {
    const from = document.getElementById("teamDateFrom") ? document.getElementById("teamDateFrom").value : "";
    const to = document.getElementById("teamDateTo") ? document.getElementById("teamDateTo").value : "";
    const rows = teamDashboardRows.filter(r => {
        const d = String(r["Call Date"] || "");
        if (String(r["Assigned Team"] || "").trim() !== team) return false;
        if (from && d < from) return false;
        if (to && d > to) return false;
        return true;
    });
    return {
        team,
        total: rows.length,
        month: rows.filter(r => String(r["Call Date"] || "").startsWith(sitrepMonthKey())).length,
        fatal: rows.filter(r => String(r["Victim Status"] || "").toLowerCase().includes("demised")).length,
        patients: rows.reduce((s, r) => s + countPatients(r), 0),
        da: avgMinutes(rows.map(r => minutesBetween(r["Dispatched Time"], r["Arrival at Scene"]))),
        sh: avgMinutes(rows.map(r => minutesBetween(r["Take Off from Scene"], r["Arrival at Hospital"])))
    };
}

function renderTeamCompare() {
    const tbody = document.getElementById("teamCompareBody");
    if (!tbody) return;
    const stats = Object.keys(SITREP_TEAMS).map(teamStatsOf);
    const total = stats.reduce((s, t) => s + t.total, 0);
    tbody.innerHTML = stats.map(t => `
        <tr>
            <td><strong>${esc(t.team)}</strong></td>
            <td>${t.total}${total ? " (" + Math.round((t.total / total) * 100) + "%)" : ""}</td>
            <td>${t.month}</td>
            <td>${t.fatal}</td>
            <td>${t.patients}</td>
            <td>${fmtMinutes(t.da)}</td>
            <td>${fmtMinutes(t.sh)}</td>
        </tr>`).join("");
}

function renderTeamStats(rows) {
    setText("teamStatTotal", rows.length);
    setText("teamStatMonth", rows.filter(r => String(r["Call Date"] || "").startsWith(sitrepMonthKey())).length);
    setText("teamStatPatients", rows.reduce((s, r) => s + countPatients(r), 0));
    setText("teamStatFatal", rows.filter(r => String(r["Victim Status"] || "").toLowerCase().includes("demised")).length);
}

function renderTeamMonthly(rows) {
    const map = {};
    rows.forEach(r => {
        const k = String(r["Call Date"] || "").slice(0, 7);
        if (k) map[k] = (map[k] || 0) + 1;
    });
    const keys = Object.keys(map).sort();
    buildChart("teamMonthlyChart", {
        type: "line",
        data: {
            labels: keys.map(k => {
                const p = k.split("-");
                return MONTH_LABELS[Number(p[1]) - 1] + " " + p[0];
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

function flattenFieldCount(rows, field) {
    const map = {};
    rows.forEach(r => splitJoined(r[field]).forEach(n => map[n] = (map[n] || 0) + 1));
    return Object.entries(map).sort((a, b) => b[1] - a[1]);
}

function renderTeamCoverage(rows) {
    const sic = topWithOthers(countBy(rows, "Shift-In-Charge (SIC)"), 8);
    const op = topWithOthers(countBy(rows, "Operator in Charge"), 8);
    const resp = topWithOthers(flattenFieldCount(rows, "Responders"), 8);
    const drv = topWithOthers(flattenFieldCount(rows, "Drivers"), 8);

    buildChart("teamSicChart", {
        type: "bar",
        data: {
            labels: sic.map(e => e[0]),
            datasets: [{ label: "Shifts", data: sic.map(e => e[1]), backgroundColor: "#0d6efd" }]
        },
        options: { ...baseOpts(), indexAxis: "y" }
    });
    buildChart("teamOperatorChart", {
        type: "bar",
        data: {
            labels: op.map(e => e[0]),
            datasets: [{ label: "Calls", data: op.map(e => e[1]), backgroundColor: "#20c997" }]
        },
        options: { ...baseOpts(), indexAxis: "y" }
    });
    buildChart("teamResponderChart", {
        type: "bar",
        data: {
            labels: resp.map(e => e[0]),
            datasets: [{ label: "Deployments", data: resp.map(e => e[1]), backgroundColor: "#6f42c1" }]
        },
        options: { ...baseOpts(), indexAxis: "y" }
    });
    buildChart("teamDriverChart", {
        type: "bar",
        data: {
            labels: drv.map(e => e[0]),
            datasets: [{ label: "Deployments", data: drv.map(e => e[1]), backgroundColor: "#fd7e14" }]
        },
        options: { ...baseOpts(), indexAxis: "y" }
    });
}

document.addEventListener("DOMContentLoaded", function () {
    const sel = document.getElementById("teamDashboardTeam");
    if (sel) sel.addEventListener("change", renderTeamDashboard);
    ["teamDateFrom", "teamDateTo"].forEach(id => {
        const el = document.getElementById(id);
        if (el) el.addEventListener("change", renderTeamDashboard);
    });
});
