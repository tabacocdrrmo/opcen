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
    supabaseClient.auth.signOut();
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
        const { data: accounts, error: acctErr } = await supabaseClient
            .from("accounts")
            .select("*,employees(*)")
            .order("id", { ascending: true });
        if (acctErr) throw acctErr;

        employees = (accounts || [])
            .filter(a => a.employees)
            .map(a => {
                const e = a.employees;
                return {
                    accountId: a.id,
                    employeeId: e.id,
                    employee_id: e.employee_id || "",
                    first_name: e.first_name || "",
                    last_name: e.last_name || "",
                    gender: e.gender || "",
                    date_of_birth: e.date_of_birth || "",
                    marital_status: e.marital_status || "",
                    blood_type: e.blood_type || "",
                    address: e.address || "",
                    contact_number: e.contact_number || "",
                    email: e.email || "",
                    position: e.position || "",
                    employment_type: e.employment_type || "",
                    status: e.status || "Active",
                    eligibility: e.eligibility || "",
                    date_of_joining: e.date_of_joining || "",
                    educational_attainment: e.educational_attainment || "",
                    profile_picture: e.profile_picture || "",
                    educational_institution: e.educational_institution || "",
                    educational_course: e.educational_course || "",
                    role: a.role || "staff",
                    username: a.username
                };
            });

        await restoreExpiredLeaves();
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
            <td data-label="Name" class="fw-medium">${escapeHtml(name)}</td>
            <td data-label="Employee ID">${escapeHtml(emp.employee_id)}</td>
            <td data-label="Position" class="d-none d-md-table-cell">${escapeHtml(emp.position)}</td>
            <td data-label="Emp. Type" class="d-none d-lg-table-cell">${escapeHtml(emp.employment_type)}</td>
            <td data-label="Status">${statusBadge}</td>
            <td data-label="Role" class="d-none d-sm-table-cell">${roleBadge}</td>
            <td data-label="Actions" class="text-end">
                <div class="d-flex gap-1 justify-content-end">
                    <button class="btn btn-outline-primary btn-sm py-0" onclick="openStatusModal(${emp.employeeId}, '${escapeHtml(name)}', '${emp.status}')" title="Change Status">
                        <i class="fa-solid fa-flag"></i>
                    </button>
                    <button class="btn btn-outline-warning btn-sm py-0" onclick="openRoleModal(${emp.employeeId}, '${escapeHtml(name)}', '${emp.role}')" title="Change Role">
                        <i class="fa-solid fa-shield"></i>
                    </button>
                    <button class="btn btn-outline-info btn-sm py-0" onclick="openViewModal(${emp.employeeId})" title="View Details">
                        <i class="fa-solid fa-eye"></i>
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
        : status === "On Leave" ? "bg-info text-dark"
        : status === "Resigned" ? "bg-warning text-dark"
        : status === "Terminated" ? "bg-danger"
        : "bg-secondary";
    return `<span class="badge ${cls}">${escapeHtml(status)}</span>`;
}

function updateStats(data) {
    document.getElementById("statTotal").innerText = data.length;
    document.getElementById("statActive").innerText = data.filter(e => e.status === "Active").length;
    document.getElementById("statOnLeave").innerText = data.filter(e => e.status === "On Leave").length;
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
        const { error: statusErr } = await supabaseClient
            .from("employees")
            .update({ status: newStatus })
            .eq("id", targetEmployeeId);
        if (statusErr) throw statusErr;
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
        const empRecord = employees.find(e => e.employeeId === targetAccountEmployeeId);
        if (!empRecord) return;
        const { error: roleErr } = await supabaseClient
            .from("accounts")
            .update({ role: newRole })
            .eq("employee_id", targetAccountEmployeeId);
        if (roleErr) throw roleErr;
        empRecord.role = newRole;
        refreshTable();
        bootstrap.Modal.getInstance(document.getElementById("roleModal")).hide();
    } catch (err) {
        alert("Error updating role: " + err.message);
    }
}

async function exportEmployees() {
    try {
        const [allLeaveRes, allAccountsRes, allEmergencyRes] = await Promise.all([
            supabaseClient.from("leave_requests").select("employee_id,status").eq("status", "Approved"),
            supabaseClient.from("accounts").select("*,employees(*)").order("id", { ascending: true }),
            supabaseClient.from("emergency_contacts").select("employee_id,contact_person,relationship,contact_number")
        ]);
        if (allLeaveRes.error) throw allLeaveRes.error;
        if (allAccountsRes.error) throw allAccountsRes.error;
        if (allEmergencyRes.error) throw allEmergencyRes.error;
        const allLeave = allLeaveRes.data || [];
        const allAccounts = allAccountsRes.data || [];
        const allEmergency = allEmergencyRes.data || [];

        const approvedCounts = {};
        (allLeave || []).forEach(l => {
            approvedCounts[l.employee_id] = (approvedCounts[l.employee_id] || 0) + 1;
        });

        const emergencyMap = {};
        (allEmergency || []).forEach(ec => {
            emergencyMap[ec.employee_id] = ec;
        });

        const rows = allAccounts
            .filter(a => a.employees)
            .map(a => {
                const e = a.employees;
                const ec = emergencyMap[e.id] || {};
                return {
                    employee_id: e.employee_id || "",
                    first_name: e.first_name || "",
                    last_name: e.last_name || "",
                    gender: e.gender || "",
                    date_of_birth: e.date_of_birth || "",
                    marital_status: e.marital_status || "",
                    blood_type: e.blood_type || "",
                    address: e.address || "",
                    contact_number: e.contact_number || "",
                    email: e.email || "",
                    position: e.position || "",
                    employment_type: e.employment_type || "",
                    status: e.status || "Active",
                    eligibility: e.eligibility || "",
                    date_of_joining: e.date_of_joining || "",
                    educational_attainment: e.educational_attainment || "",
                    educational_institution: e.educational_institution || "",
                    educational_course: e.educational_course || "",
                    role: a.role || "staff",
                    username: a.username || "",
                    ec_contact_person: ec.contact_person || "",
                    ec_relationship: ec.relationship || "",
                    ec_contact_number: ec.contact_number || "",
                    approved_leaves: approvedCounts[e.id] || 0
                };
            });

        const fields = [
            "employee_id","first_name","last_name","gender","date_of_birth","marital_status","blood_type",
            "address","contact_number","email",
            "position","employment_type","status","eligibility","date_of_joining","educational_attainment","educational_institution","educational_course",
            "role","username",
            "ec_contact_person","ec_relationship","ec_contact_number",
            "approved_leaves"
        ];
        const headers = [
            "Employee ID","First Name","Last Name","Gender","Date of Birth","Marital Status","Blood Type",
            "Address","Contact Number","Email",
            "Position","Employment Type","Status","Eligibility","Date of Joining","Educational Attainment","Institution / University","Course / Major",
            "Role","Username",
            "Emergency Contact Person","Emergency Relationship","Emergency Contact Number",
            "Approved Leaves"
        ];
        const csvContent = [headers.join(","), ...rows.map(r =>
            fields.map(f => `"${(r[f] ?? "").toString().replace(/"/g,'""')}"`).join(",")
        )].join("\n");

        const blob = new Blob(["\uFEFF" + csvContent], { type: "text/csv;charset=utf-8;" });
        const a = document.createElement("a");
        a.href = URL.createObjectURL(blob);
        const now = new Date();
        const ts = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0") + "-" + String(now.getDate()).padStart(2,"0") + "_" + String(now.getHours()).padStart(2,"0") + "-" + String(now.getMinutes()).padStart(2,"0") + "-" + String(now.getSeconds()).padStart(2,"0");
        a.download = ts + "_employees_export.csv";
        a.click();
        URL.revokeObjectURL(a.href);
    } catch (err) {
        alert("Export failed: " + err.message);
    }
}

async function openViewModal(empId) {
    const body = document.getElementById("viewModalBody");
    body.innerHTML = '<div class="text-center text-muted py-4">Loading...</div>';
    new bootstrap.Modal(document.getElementById("viewModal")).show();

    try {
        const emp = employees.find(e => e.employeeId === empId);
        if (!emp) { body.innerHTML = '<div class="text-danger">Employee not found.</div>'; return; }
        window._currentViewEmployeeName = (emp.first_name + "_" + emp.last_name).replace(/\s+/g,"_").toLowerCase() || "employee";

        const { data: emergency } = await supabaseClient
            .from("emergency_contacts")
            .select("*")
            .eq("employee_id", empId);
        const ec = emergency && emergency.length > 0 ? emergency[0] : {};

        const val = v => escapeHtml(v ?? "—");

        body.innerHTML = `
            <div class="row g-2 small" id="viewModalContent">
                <div class="col-12 text-center mb-3">
                    <img src="${escapeHtml(emp.profile_picture || 'assets/images/img_placeholder.jpg')}" alt="Profile" style="width:100px;height:100px;object-fit:cover;border-radius:50%;border:2px solid #dee2e6;">
                </div>
                <div class="col-12"><div class="fw-bold text-primary" style="font-size:0.95rem">Personal Information</div></div>
                <div class="col-sm-6"><strong>First Name:</strong> ${val(emp.first_name)}</div>
                <div class="col-sm-6"><strong>Last Name:</strong> ${val(emp.last_name)}</div>
                <div class="col-sm-6"><strong>Gender:</strong> ${val(emp.gender)}</div>
                <div class="col-sm-6"><strong>Date of Birth:</strong> ${val(emp.date_of_birth)}</div>
                <div class="col-sm-6"><strong>Marital Status:</strong> ${val(emp.marital_status)}</div>
                <div class="col-sm-6"><strong>Blood Type:</strong> ${val(emp.blood_type)}</div>
                <div class="col-12"><strong>Address:</strong> ${val(emp.address)}</div>
                <div class="col-sm-6"><strong>Contact Number:</strong> ${val(emp.contact_number)}</div>
                <div class="col-sm-6"><strong>Email:</strong> ${val(emp.email)}</div>
                <div class="col-12"><hr class="my-2"></div>

                <div class="col-12"><div class="fw-bold text-primary" style="font-size:0.95rem">Employment Details</div></div>
                <div class="col-sm-4"><strong>Employee ID:</strong> ${val(emp.employee_id)}</div>
                <div class="col-sm-4"><strong>Position:</strong> ${val(emp.position)}</div>
                <div class="col-sm-4"><strong>Employment Type:</strong> ${val(emp.employment_type)}</div>
                <div class="col-sm-4"><strong>Status:</strong> ${val(emp.status)}</div>
                <div class="col-sm-4"><strong>Eligibility:</strong> ${val(emp.eligibility)}</div>
                <div class="col-sm-4"><strong>Date of Joining:</strong> ${val(emp.date_of_joining)}</div>
                <div class="col-12"><strong>Educational Attainment:</strong> ${val(emp.educational_attainment)}</div>
                <div class="col-sm-6"><strong>Institution / University:</strong> ${val(emp.educational_institution)}</div>
                <div class="col-sm-6"><strong>Course / Major:</strong> ${val(emp.educational_course)}</div>
                <div class="col-12"><hr class="my-2"></div>

                <div class="col-12"><div class="fw-bold text-primary" style="font-size:0.95rem">Emergency Contact</div></div>
                <div class="col-sm-4"><strong>Contact Person:</strong> ${val(ec.contact_person)}</div>
                <div class="col-sm-4"><strong>Relationship:</strong> ${val(ec.relationship)}</div>
                <div class="col-sm-4"><strong>Contact Number:</strong> ${val(ec.contact_number)}</div>
                <div class="col-12"><hr class="my-2"></div>

                <div class="col-12"><div class="fw-bold text-primary" style="font-size:0.95rem">Account</div></div>
                <div class="col-sm-4"><strong>Username:</strong> ${val(emp.username)}</div>
                <div class="col-sm-4"><strong>Role:</strong> ${val(emp.role)}</div>
            </div>
        `;
    } catch (err) {
        body.innerHTML = '<div class="text-danger">Error loading details: ' + escapeHtml(err.message) + '</div>';
    }
}

function exportPdf() {
    const element = document.getElementById("viewModalContent");
    if (!element) return;
    const now = new Date();
    const ts = now.getFullYear() + "-" + String(now.getMonth()+1).padStart(2,"0") + "-" + String(now.getDate()).padStart(2,"0") + "_" + String(now.getHours()).padStart(2,"0") + "-" + String(now.getMinutes()).padStart(2,"0") + "-" + String(now.getSeconds()).padStart(2,"0");
    const name = window._currentViewEmployeeName || "employee";
    const opt = {
        margin: [0.5, 0.5, 0.5, 0.5],
        filename: ts + "_" + name + "_record.pdf",
        image: { type: "jpeg", quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true },
        jsPDF: { unit: "in", format: "letter", orientation: "portrait" }
    };
    html2pdf().set(opt).from(element).save();
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

    if (page === "leave") loadLeaveRequests();

    if (window.innerWidth < 768) toggleSidebar(false);
}

function toggleSidebar(force) {
    const sidebar = document.getElementById("sidebar");
    const backdrop = document.getElementById("sidebarBackdrop");
    const isShowing = sidebar.classList.toggle("show", force ?? undefined);
    backdrop.classList.toggle("show", force ?? undefined);
}

let leaveRequests = [];
let filteredLeaveRequests = [];
let leaveCurrentPage = 1;
const leavePageSize = 20;

async function loadLeaveRequests() {
    try {
        const { data, error } = await supabaseClient
            .from("leave_requests")
            .select("*,employees(first_name,last_name,employee_id)")
            .order("created_at", { ascending: false });
        if (error) throw error;
        leaveRequests = data || [];
        filterLeaveTable();
    } catch (err) {
        console.error("Failed to load leave requests:", err);
        document.getElementById("leaveTableBody").innerHTML =
            '<tr><td colspan="8" class="text-center text-danger py-4">Failed to load: ' + err.message + '</td></tr>';
    }
}

function filterLeaveTable() {
    leaveCurrentPage = 1;
    const q = document.getElementById("leaveSearchInput").value.toLowerCase().trim();
    const status = document.getElementById("leaveStatusFilter").value;
    filteredLeaveRequests = leaveRequests.filter(l => {
        const emp = l.employees || {};
        const name = (emp.first_name + " " + emp.last_name).toLowerCase();
        if (q && !name.includes(q)) return false;
        if (status && l.status !== status) return false;
        return true;
    });
    renderLeaveTable();
    renderLeavePagination();
}

function renderLeavePagination() {
    const totalPages = Math.ceil(filteredLeaveRequests.length / leavePageSize);
    const el = document.getElementById("leavePagination");
    if (!el) return;
    if (totalPages <= 1) {
        el.innerHTML = "";
        return;
    }
    let html = '<nav><ul class="pagination pagination-sm justify-content-center mb-0 mt-0">';
    html += `<li class="page-item ${leaveCurrentPage === 1 ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="goToLeavePage(${leaveCurrentPage - 1}); return false;">«</a></li>`;
    for (let i = 1; i <= totalPages; i++) {
        html += `<li class="page-item ${i === leaveCurrentPage ? 'active' : ''}">
            <a class="page-link" href="#" onclick="goToLeavePage(${i}); return false;">${i}</a></li>`;
    }
    html += `<li class="page-item ${leaveCurrentPage === totalPages ? 'disabled' : ''}">
        <a class="page-link" href="#" onclick="goToLeavePage(${leaveCurrentPage + 1}); return false;">»</a></li>`;
    html += '</ul></nav>';
    el.innerHTML = html;
}

function goToLeavePage(n) {
    const totalPages = Math.ceil(filteredLeaveRequests.length / leavePageSize);
    if (n < 1 || n > totalPages) return;
    leaveCurrentPage = n;
    renderLeaveTable();
    renderLeavePagination();
}

function renderLeaveTable() {
    const tbody = document.getElementById("leaveTableBody");
    const data = filteredLeaveRequests;
    if (!data.length) {
        tbody.innerHTML = '<tr><td colspan="8" class="text-center text-muted py-4">No leave requests found.</td></tr>';
        return;
    }
    const start = (leaveCurrentPage - 1) * leavePageSize;
    const pageData = data.slice(start, start + leavePageSize);
    tbody.innerHTML = pageData.map(l => {
        const emp = l.employees || {};
        const name = (emp.first_name + " " + emp.last_name).trim() || "—";
        const empId = emp.employee_id || "—";
        const badgeCls = l.status === "Approved" ? "bg-success"
            : l.status === "Rejected" ? "bg-danger"
            : "bg-warning text-dark";

        let actions = "";
        if (l.status === "Pending") {
            actions = `<div class="d-flex gap-1 justify-content-end">
                <button class="btn btn-success btn-sm py-0" onclick="approveLeave(${l.id})" title="Approve">
                    <i class="fa-solid fa-check"></i>
                </button>
                <button class="btn btn-danger btn-sm py-0" onclick="rejectLeave(${l.id})" title="Reject">
                    <i class="fa-solid fa-times"></i>
                </button>
            </div>`;
        } else {
            actions = "<span class='text-muted small'>—</span>";
        }

        return `<tr>
            <td data-label="Employee" class="fw-medium">${escapeHtml(name)}</td>
            <td data-label="Employee ID">${escapeHtml(empId)}</td>
            <td data-label="Leave Type">${escapeHtml(l.leave_type)}</td>
            <td data-label="Start" class="d-none d-sm-table-cell">${l.start_date}</td>
            <td data-label="End" class="d-none d-sm-table-cell">${l.end_date}</td>
            <td data-label="Reason" class="d-none d-md-table-cell">${escapeHtml(l.reason || "—")}</td>
            <td data-label="Status"><span class="badge ${badgeCls}">${l.status}</span></td>
            <td data-label="Actions" class="text-end">${actions}</td>
        </tr>`;
    }).join("");
}

async function approveLeave(id) {
    if (!confirm("Approve this leave request?")) return;
    try {
        const req = leaveRequests.find(l => l.id === id);
        if (req) {
            const { error: empErr } = await supabaseClient
                .from("employees")
                .update({ status: "On Leave" })
                .eq("id", req.employee_id);
            if (empErr) throw empErr;
        }
        const { error: leaveErr } = await supabaseClient
            .from("leave_requests")
            .update({ status: "Approved", updated_at: new Date().toISOString() })
            .eq("id", id);
        if (leaveErr) throw leaveErr;
        if (req) req.status = "Approved";
        filterLeaveTable();
    } catch (err) {
        alert("Error approving leave: " + err.message);
    }
}

async function restoreExpiredLeaves() {
    const today = new Date().toISOString().split("T")[0];
    try {
        const { data: expired } = await supabaseClient
            .from("leave_requests")
            .select("employee_id")
            .eq("status", "Approved")
            .lt("end_date", today);
        const empIds = [...new Set((expired || []).map(r => r.employee_id))];
        for (const empId of empIds) {
            const { error: restoreErr } = await supabaseClient
                .from("employees")
                .update({ status: "Active" })
                .eq("id", empId);
            if (restoreErr) console.error("Restore error for emp", empId, restoreErr);
        }
        if (empIds.length) {
            employees.forEach(e => {
                if (empIds.includes(e.employeeId)) e.status = "Active";
            });
            refreshTable();
            updateStats(employees);
        }
    } catch (_) {}
}

async function rejectLeave(id) {
    if (!confirm("Reject this leave request?")) return;
    try {
        const { error: rejectErr } = await supabaseClient
            .from("leave_requests")
            .update({ status: "Rejected", updated_at: new Date().toISOString() })
            .eq("id", id);
        if (rejectErr) throw rejectErr;
        const req = leaveRequests.find(l => l.id === id);
        if (req) req.status = "Rejected";
        filterLeaveTable();
    } catch (err) {
        alert("Error rejecting leave: " + err.message);
    }
}

document.addEventListener("DOMContentLoaded", function () {
    switchPage("employees");
});
