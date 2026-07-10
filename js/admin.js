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

async function dbPatch(table, data, filter) {
    const res = await fetch(`${SUPABASE_URL}${table}?${filter}`, {
        method: 'PATCH',
        headers: DB_HEADERS,
        body: JSON.stringify(data)
    });
    if (!res.ok) {
        const text = await res.text();
        throw new Error(`PATCH ${table} (${res.status}): ${text}`);
    }
    return res.json();
}

let employees = [];
let filteredEmployees = [];
let targetEmployeeId = null;
let targetAccountEmployeeId = null;
let currentPage = 1;
const pageSize = 15;

function getSession() {
    const raw = sessionStorage.getItem("crewSession");
    if (!raw) return null;
    try {
        return JSON.parse(raw);
    } catch {
        return null;
    }
}

function clearSession() {
    sessionStorage.removeItem("crewSession");
}

function handleLogout() {
    clearSession();
    window.location.href = "index.html";
}

document.addEventListener("DOMContentLoaded", async function () {
    const session = getSession();
    if (!session || session.role !== "admin") {
        window.location.href = "index.html";
        return;
    }

    document.getElementById("adminUserDisplay").innerText = session.username;

    try {
        const accounts = await dbGet("accounts", {
            select: "*,employees(*)",
            filter: "order=id.asc"
        });

        employees = accounts
            .filter(a => a.employees)
            .map(a => ({
                accountId: a.id,
                employeeId: a.employees.id,
                employee_id: a.employees.employee_id || "",
                first_name: a.employees.first_name || "",
                last_name: a.employees.last_name || "",
                position: a.employees.position || "",
                employment_type: a.employees.employment_type || "",
                status: a.employees.status || "Active",
                role: a.role || "staff",
                username: a.username
            }));

        refreshTable();
        updateStats(employees);
    } catch (err) {
        console.error("Load error:", err);
        document.getElementById("tableBody").innerHTML =
            '<tr><td colspan="7" class="text-center text-danger py-4">Failed to load employees: ' + err.message + '</td></tr>';
    }
});

function getFilteredData() {
    const q = document.getElementById("searchInput").value.toLowerCase().trim();
    if (!q) return employees;
    return employees.filter(e =>
        (e.first_name + " " + e.last_name).toLowerCase().includes(q) ||
        e.employee_id.toLowerCase().includes(q) ||
        e.position.toLowerCase().includes(q) ||
        e.employment_type.toLowerCase().includes(q)
    );
}

function refreshTable() {
    currentPage = 1;
    filteredEmployees = getFilteredData();
    renderTable();
    renderPagination();
}

function renderTable() {
    const tbody = document.getElementById("tableBody");
    const start = (currentPage - 1) * pageSize;
    const page = filteredEmployees.slice(start, start + pageSize);

    if (page.length === 0) {
        tbody.innerHTML = '<tr><td colspan="7" class="text-center text-muted py-4">No employees found.</td></tr>';
        return;
    }

    tbody.innerHTML = page.map(emp => {
        const name = (emp.first_name + " " + emp.last_name).trim() || "—";
        const statusBadge = statusBadgeHtml(emp.status);
        const roleBadge = emp.role === "admin"
            ? '<span class="badge bg-warning text-dark">Admin</span>'
            : '<span class="badge bg-secondary">Staff</span>';

        return `<tr>
            <td class="fw-medium">${escapeHtml(name)}</td>
            <td>${escapeHtml(emp.employee_id)}</td>
            <td class="d-none d-md-table-cell">${escapeHtml(emp.position)}</td>
            <td class="d-none d-lg-table-cell">${escapeHtml(emp.employment_type)}</td>
            <td>${statusBadge}</td>
            <td class="d-none d-sm-table-cell">${roleBadge}</td>
            <td class="text-end">
                <div class="d-flex gap-1 justify-content-end">
                    <button class="btn btn-outline-primary btn-sm py-0" onclick="openStatusModal(${emp.employeeId}, '${escapeHtml(name)}', '${emp.status}')" title="Change Status">
                        <i class="fa-solid fa-flag"></i>
                    </button>
                    <button class="btn btn-outline-warning btn-sm py-0" onclick="openRoleModal(${emp.employeeId}, '${escapeHtml(name)}', '${emp.role}')" title="Change Role">
                        <i class="fa-solid fa-shield"></i>
                    </button>
                </div>
            </td>
        </tr>`;
    }).join("");
}

function renderPagination() {
    const totalPages = Math.ceil(filteredEmployees.length / pageSize);
    let el = document.getElementById("pagination");
    if (!el) return;

    if (totalPages <= 1) {
        el.innerHTML = "";
        return;
    }

    let html = '<nav><ul class="pagination pagination-sm justify-content-center mb-0 mt-0">';

    html += `<li class="page-item ${currentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="goToPage(${currentPage - 1}); return false;">«</a></li>`;

    for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${i === currentPage ? 'active' : ''}">
            <a class="page-link" href="#" onclick="goToPage(${i}); return false;">${i}</a></li>`;
    }

    html += `<li class="page-item ${currentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="goToPage(${currentPage + 1}); return false;">»</a></li>`;

    html += '</ul></nav>';
    el.innerHTML = html;
}

function goToPage(n) {
    const totalPages = Math.ceil(filteredEmployees.length / pageSize);
    if (n < 1 || n > totalPages) return;
    currentPage = n;
    renderTable();
    renderPagination();
}

function statusBadgeHtml(status) {
    const cls = status === "Active" ? "bg-success"
        : status === "Resigned" ? "bg-warning text-dark"
        : status === "Terminated" ? "bg-danger"
        : "bg-secondary";
    return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function updateStats(data) {
    document.getElementById("statTotal").innerText = data.length;
    document.getElementById("statActive").innerText = data.filter(e => e.status === "Active").length;
    document.getElementById("statResigned").innerText = data.filter(e => e.status === "Resigned").length;
    document.getElementById("statTerminated").innerText = data.filter(e => e.status === "Terminated").length;
}

function filterTable() {
    currentPage = 1;
    filteredEmployees = getFilteredData();
    renderTable();
    renderPagination();
}

function openStatusModal(empId, name, currentStatus) {
    targetEmployeeId = empId;
    document.getElementById("statusEmployeeName").innerText = name;
    document.getElementById("statusSelect").value = currentStatus;
    new bootstrap.Modal(document.getElementById("statusModal")).show();
}

async function confirmStatusChange() {
    const newStatus = document.getElementById("statusSelect").value;
    if (!targetEmployeeId) return;

    try {
        await dbPatch("employees", { status: newStatus }, `id=eq.${targetEmployeeId}`);
        const emp = employees.find(e => e.employeeId === targetEmployeeId);
        if (emp) emp.status = newStatus;
        refreshTable();
        updateStats(employees);
        bootstrap.Modal.getInstance(document.getElementById("statusModal")).hide();
    } catch (err) {
        alert("Error updating status: " + err.message);
    }
}

function openRoleModal(empId, name, currentRole) {
    targetAccountEmployeeId = empId;
    document.getElementById("roleEmployeeName").innerText = name;
    document.getElementById("roleSelect").value = currentRole;
    new bootstrap.Modal(document.getElementById("roleModal")).show();
}

async function confirmRoleChange() {
    const newRole = document.getElementById("roleSelect").value;
    if (!targetAccountEmployeeId) return;

    try {
        await dbPatch("accounts", { role: newRole }, `employee_id=eq.${targetAccountEmployeeId}`);
        const emp = employees.find(e => e.employeeId === targetAccountEmployeeId);
        if (emp) emp.role = newRole;
        refreshTable();
        bootstrap.Modal.getInstance(document.getElementById("roleModal")).hide();
    } catch (err) {
        alert("Error updating role: " + err.message);
    }
}

function escapeHtml(str) {
    if (!str) return "";
    const div = document.createElement("div");
    div.appendChild(document.createTextNode(str));
    return div.innerHTML;
}

function switchPage(page) {
    document.querySelectorAll(".page-section").forEach(el => el.classList.add("d-none"));
    const target = document.getElementById("page-" + page);
    if (target) target.classList.remove("d-none");

    document.querySelectorAll(".sidebar .nav-link").forEach(el => el.classList.remove("active"));
    const link = document.querySelector(`.sidebar .nav-link[data-page="${page}"]`);
    if (link) link.classList.add("active");

    if (window.innerWidth < 768) toggleSidebar(false);
}

function toggleSidebar(force) {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    const isShowing = sidebar.classList.toggle("show", force ?? undefined);
    backdrop.classList.toggle("show", force ?? undefined);
}

document.addEventListener("DOMContentLoaded", function () {
    switchPage("employees");
});
