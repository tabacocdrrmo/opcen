// Employee Dashboard (admin only). Per-employee activity + HR summary. SITREP
// attribution is roster-based: a call counts for an employee when their name
// matches Responders / Drivers / Operator in Charge / SIC / PCR By fields, or
// when they appear in the responder log for that sitrep (covers main-sheet rows
// whose name columns are incomplete).

let empDashboardLoaded = false;

const GENERATIONAL_SUFFIXES = new Set(["i", "ii", "iii", "iv", "v", "jr", "sr"]);

function normalizeName(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/\./g, "")
        .replace(/,/g, " ")
        .replace(/\s+/g, " ")
        .trim()
        .split(" ")
        .filter(Boolean)
        .filter(t => !GENERATIONAL_SUFFIXES.has(t))
        .join(" ");
}

function employeeNameVariants(emp) {
    const first = (emp && emp.first_name || "").trim();
    const last = (emp && emp.last_name || "").trim();
    const middle = (emp && emp.middle_name || "").trim();
    const variants = new Set();
    if (first && last) {
        variants.add(normalizeName(first + " " + last));
        if (middle) {
            variants.add(normalizeName(first + " " + middle + " " + last));
            const initial = middle[0];
            variants.add(normalizeName(first + " " + initial + ". " + last));
            variants.add(normalizeName(first + " " + initial + " " + last));
        }
    }
    return variants;
}

// Lenient fallback: matches when every significant first and last name token
// appears in the candidate, regardless of middle name / initial / generational
// suffix (Jr., Sr., II, etc.) / multi-word surname differences.
function nameTokensMatch(candidate, emp) {
    const first = normalizeName(emp && emp.first_name);
    const last = normalizeName(emp && emp.last_name);
    if (!first || !last) return false;
    const tokens = normalizeName(candidate).split(" ").filter(Boolean);
    const firstOk = first.split(" ").every(t => tokens.includes(t));
    const lastOk = last.split(" ").every(t => tokens.includes(t));
    return firstOk && lastOk;
}

async function loadEmployeeDashboard(force) {
    try {
        if (!employees.length) await reloadEmployees();
        if (force || !empDashboardLoaded) {
            await loadSitrepDashboard(force);
            empDashboardLoaded = true;
        }
        populateEmployeeSelect();
        renderEmployeeDashboard();
    } catch (err) {
        console.error("Failed to load employee dashboard:", err);
        const empty = document.getElementById("empDashboardEmpty");
        if (empty) {
            empty.classList.remove("d-none");
            empty.innerHTML = '<div class="text-danger py-4">Failed to load: ' + esc(err.message || err) + '</div>';
        }
    }
}

function empDisplayName(e) {
    const parts = [e.first_name];
    if (e.middle_name) parts.push(e.middle_name[0] + ".");
    if (e.last_name) parts.push(e.last_name);
    return parts.join(" ") || "—";
}

function populateEmployeeSelect() {
    const sel = document.getElementById("empDashboardSelect");
    if (!sel) return;
    const prev = sel.value;
    const sorted = [...employees].sort((a, b) => empDisplayName(a).localeCompare(empDisplayName(b)));
    sel.innerHTML = '<option value="">-- Select Employee --</option>' +
        sorted.map(e => `<option value="${e.employeeId}">${esc(empDisplayName(e))}${e.position ? " — " + esc(e.position) : ""}</option>`).join("");
    if (prev) sel.value = prev;
}

function empRoleMatched(r, n, emp) {
    const m = { sic: false, operator: false, responder: false, driver: false, pcr: false };
    if (!n) return m;
    const variants = employeeNameVariants(emp);
    const isEmp = x => variants.has(normalizeName(x)) || nameTokensMatch(x, emp);
    if (isEmp(r["Shift-In-Charge (SIC)"])) m.sic = true;
    if (isEmp(r["Operator in Charge"])) m.operator = true;
    if (splitJoined(r["Responders"]).some(x => isEmp(x))) m.responder = true;
    if (splitJoined(r["Drivers"]).some(x => isEmp(x))) m.driver = true;
    if (splitJoined(r["PCR By"]).some(x => isEmp(x))) m.pcr = true;
    return m;
}

// Distinct sitrep numbers for which the employee appears in the responder log.
function employeeLogSitreps(emp) {
    const set = new Set();
    const variants = employeeNameVariants(emp);
    sitrepLog.forEach(r => {
        if (!r || !r.name) return;
        if (variants.has(normalizeName(r.name)) || nameTokensMatch(r.name, emp)) {
            set.add(String(r.sitrepNo || "").trim().toLowerCase());
        }
    });
    return set;
}

function renderEmployeeDashboard() {
    const sel = document.getElementById("empDashboardSelect");
    const content = document.getElementById("empDashboardContent");
    const empty = document.getElementById("empDashboardEmpty");
    if (!sel || !content || !empty) return;

    const emp = sel.value ? employees.find(e => e.employeeId === Number(sel.value)) : null;
    if (!emp) {
        content.classList.add("d-none");
        empty.classList.remove("d-none");
        empty.innerHTML = '<div class="text-muted text-center py-5"><i class="fa-solid fa-user fa-2x mb-2" style="opacity:.3;"></i><p class="mb-0">Select an employee to see their SITREP activity and HR summary.</p></div>';
        return;
    }
    empty.classList.add("d-none");
    content.classList.remove("d-none");

    const name = empDisplayName(emp);
    const n = normName(name);
    const entry = rosterEntry(name);
    const logSitreps = employeeLogSitreps(emp);
    const matched = n ? sitrepRows.filter(r => {
        const m = empRoleMatched(r, n, emp);
        return m.sic || m.operator || m.responder || m.driver || m.pcr ||
            logSitreps.has(String(r["SITREP #"] || "").trim().toLowerCase());
    }) : [];

    renderEmpHeader(emp, entry);
    renderEmpStats(matched, emp, n);
    renderEmpCharts(matched, n, emp);
    renderEmpTimes(matched);
    loadEmpLeave(emp);
}

function renderEmpHeader(emp, entry) {
    setText("empName", esc(empDisplayName(emp)));
    setText("empPosition", esc(emp.position || "—"));
    setText("empEmploymentType", esc(emp.employment_type || "—"));
    setText("empEligibility", esc(emp.eligibility || "—"));
    setText("empTenure", tenureText(emp.date_of_joining));

    const statusEl = document.getElementById("empStatusBadge");
    if (statusEl) {
        const cls = emp.status === "Active" ? "bg-success"
            : emp.status === "On Leave" ? "bg-info text-dark"
            : emp.status === "Resigned" ? "bg-warning text-dark"
            : "bg-danger";
        statusEl.className = "badge " + cls;
        statusEl.innerText = emp.status || "—";
    }

    const avatar = document.getElementById("empAvatar");
    if (avatar) {
        if (emp.profile_picture) avatar.src = emp.profile_picture;
        else avatar.src = "data:image/svg+xml," + encodeURIComponent('<svg xmlns="http://www.w3.org/2000/svg" width="80" height="80"><rect width="80" height="80" fill="#e9ecef"/><text x="40" y="48" font-size="28" text-anchor="middle" fill="#6c757d">' + "?</text></svg>");
    }

    if (entry) {
        setText("empTeams", entry.teams.size ? [...entry.teams].sort().join(", ") : "—");
        setText("empRoles", entry.roles.size ? [...entry.roles].join(", ") : "—");
        const note = document.getElementById("empRosterNote");
        if (note) note.classList.add("d-none");
    } else {
        setText("empTeams", "—");
        setText("empRoles", "—");
        const note = document.getElementById("empRosterNote");
        if (note) {
            note.classList.remove("d-none");
            note.innerText = "Not in the active response roster — no SITREP activity is linked to this employee.";
        }
    }
}

function tenureText(dateStr) {
    if (!dateStr) return "—";
    const m = String(dateStr).match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!m) return String(dateStr);
    const joined = new Date(+m[1], +m[2] - 1, +m[3]);
    const now = new Date();
    let years = now.getFullYear() - joined.getFullYear();
    let months = now.getMonth() - joined.getMonth();
    if (months < 0) { years--; months += 12; }
    if (years <= 0) return months + " mo";
    return years + " yr " + months + " mo";
}

function renderEmpStats(matched, emp, n) {
    const thisMonth = sitrepMonthKey();
    let sic = 0, operator = 0, pcr = 0, fatal = 0, month = 0;
    matched.forEach(r => {
        const m = empRoleMatched(r, n, emp);
        if (m.sic) sic++;
        if (m.operator) operator++;
        if (m.pcr) pcr++;
        if (String(r["Call Date"] || "").startsWith(thisMonth)) month++;
        if (String(r["Victim Status"] || "").toLowerCase().includes("demised")) fatal++;
    });
    setText("empStatTotal", matched.length);
    setText("empStatSic", sic);
    setText("empStatOperator", operator);
    setText("empStatPcr", pcr);
    setText("empStatMonth", month);
    setText("empStatFatal", fatal);
}

function renderEmpCharts(rows, n, emp) {
    const map = {};
    rows.forEach(r => {
        const k = String(r["Call Date"] || "").slice(0, 7);
        if (k) map[k] = (map[k] || 0) + 1;
    });
    const keys = Object.keys(map).sort();
    buildChart("empMonthlyChart", {
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

    let sicCount = 0, opCount = 0, respCount = 0, drvCount = 0, pcrCount = 0;
    rows.forEach(r => {
        const m = empRoleMatched(r, n, emp);
        if (m.sic) sicCount++;
        if (m.operator) opCount++;
        if (m.responder) respCount++;
        if (m.driver) drvCount++;
        if (m.pcr) pcrCount++;
    });
    const roles = [
        ["SIC", sicCount, "#0d6efd"],
        ["Operator", opCount, "#20c997"],
        ["Responder", respCount, "#6f42c1"],
        ["Driver", drvCount, "#fd7e14"],
        ["PCR", pcrCount, "#d63384"]
    ].filter(x => x[1] > 0);
    buildChart("empRoleChart", {
        type: "bar",
        data: {
            labels: roles.map(r => r[0]),
            datasets: [{ label: "Calls", data: roles.map(r => r[1]), backgroundColor: roles.map(r => r[2]) }]
        },
        options: { ...baseOpts(), indexAxis: "y" }
    });

    const teams = countBy(rows, "Assigned Team");
    buildChart("empTeamChart", {
        type: "bar",
        data: {
            labels: teams.map(e => e[0]),
            datasets: [{ label: "Calls", data: teams.map(e => e[1]), backgroundColor: teams.map((_, i) => CHART_COLORS[i % CHART_COLORS.length]) }]
        },
        options: baseOpts()
    });
}

function renderEmpTimes(rows) {
    setText("empTimeDa", fmtMinutes(avgMinutes(rows.map(r => minutesBetween(r["Dispatched Time"], r["Arrival at Scene"])))));
    setText("empTimeSh", fmtMinutes(avgMinutes(rows.map(r => minutesBetween(r["Take Off from Scene"], r["Arrival at Hospital"])))));
}

async function loadEmpLeave(emp) {
    const tile = document.getElementById("empLeaveTile");
    if (tile) tile.innerText = "…";
    try {
        const { data, error } = await supabaseClient
            .from("leave_requests")
            .select("start_date,end_date,leave_type,status")
            .eq("employee_id", emp.employeeId)
            .eq("status", "Approved");
        if (error) throw error;
        const reqs = data || [];
        let days = 0;
        reqs.forEach(l => {
            const sm = String(l.start_date || "").match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
            const em = String(l.end_date || "").match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
            if (sm && em) {
                const s = new Date(+sm[1], +sm[2] - 1, +sm[3]);
                const e = new Date(+em[1], +em[2] - 1, +em[3]);
                days += Math.max(1, Math.round((e - s) / 86400000) + 1);
            }
        });
        setText("empLeaveTile", reqs.length + " approved (" + days + " days)");
    } catch (err) {
        setText("empLeaveTile", "—");
        console.error("Failed to load leave:", err);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    const sel = document.getElementById("empDashboardSelect");
    if (sel) sel.addEventListener("change", renderEmployeeDashboard);
});