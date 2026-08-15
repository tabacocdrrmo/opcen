// Shared SITREP roster and helpers for the admin Team / Employee dashboards.
// TEAMS and ALL_ROSTER mirror SITREP/js/main.js so team membership matches the
// live response app without a schema change.

const SITREP_TEAMS = {
    Alpha: {
        sic: ["Ramon D. Rodriguez"],
        operator: ["Luis C. Borlagdan", "Vicente B. Carale Jr."],
        drivers: ["Al C. Asis", "Jomar B. Belo", "Eugenio S. Cao Jr.", "Warren B. Henson", "Antonio B. Buison Jr."],
        responders: [
            "Wynel B. De Mesa", "Vicente B. Carale Jr.", "Jaime V. Buensoceso",
            "Ferdinand P. San Juan", "Roberto S. Villegas", "Shay Marie Luz R. Benavides",
            "Maria Carmela B. Bien", "Romyna B. Bongat", "Claire B. Bobier",
            "Estiffunny S. Celestial", "Julius T. Bariso", "Joseph B. Riosa"
        ]
    },
    Bravo: {
        sic: ["Ambrocio V. Piolino"],
        operator: ["Domingo C. Bron Jr."],
        drivers: ["Ariel C. Bolaños", "Christopher Jeorge B. Lacerna", "Reynaldo B. Belgica Jr.", "Jaime II B. Benosa Jr.", "Segundo B. Ballon Jr."],
        responders: [
            "Jonel B. Bocalbos", "Romulo P. Bolilan Jr.", "Adrian C. Callao",
            "Arnel C. Camata", "Levi Martin B. Madrid", "Joan B. Sayago",
            "Maria Carmela B. Bien", "Romyna B. Bongat", "Claire B. Bobier",
            "Estiffunny S. Celestial", "Julius T. Bariso", "Joseph B. Riosa"
        ]
    },
    Charlie: {
        sic: ["Romar B. Bombon"],
        operator: ["Dennis R. Flores", "Imelda B. Castillo"],
        drivers: ["Jonel A. Buendia", "Angelo B. Baraero", "Marlon B. Belda", "Jophen B. Bragais", "Pablito M. Amortizado Jr."],
        responders: [
            "Herman B. Bonaobra", "Ero B. Obreros", "Noah M. Altavano",
            "Pedro G. Boringot, I", "Francis R. Tañang", "Janine Eve Q. Base",
            "Salvacion Amor B. Campit",
            "Maria Carmela B. Bien", "Romyna B. Bongat", "Claire B. Bobier",
            "Estiffunny S. Celestial", "Julius T. Bariso", "Joseph B. Riosa"
        ]
    }
};

const SITREP_ALL_ROSTER = {
    sic: ["Ramon D. Rodriguez", "Ambrocio V. Piolino", "Romar B. Bombon"],
    operator: ["Imelda B. Castillo", "Luis C. Borlagdan", "Domingo C. Bron Jr.", "Dennis R. Flores", "Vicente B. Carale Jr."],
    drivers: [
        "Al C. Asis", "Jomar B. Belo", "Eugenio S. Cao Jr.", "Warren B. Henson",
        "Antonio B. Buison Jr.", "Ariel C. Bolaños", "Christopher Jeorge B. Lacerna",
        "Reynaldo B. Belgica Jr.", "Jaime II B. Benosa Jr.", "Segundo B. Ballon Jr.",
        "Jonel A. Buendia", "Angelo B. Baraero", "Marlon B. Belda", "Jophen B. Bragais",
        "Pablito M. Amortizado Jr."
    ],
    responders: [
        "Wynel B. De Mesa", "Jonel B. Bocalbos", "Herman B. Bonaobra",
        "Vicente B. Carale Jr.", "Romulo P. Bolilan Jr.", "Ero B. Obreros",
        "Jaime V. Buensoceso", "Adrian C. Callao", "Noah M. Altavano",
        "Ferdinand P. San Juan", "Arnel C. Camata", "Roberto S. Villegas",
        "Levi Martin B. Madrid", "Francis R. Tañang", "Shay Marie Luz R. Benavides",
        "Joan B. Sayago", "Janine Eve Q. Base", "Salvacion Amor B. Campit",
        "Pedro G. Boringot, I",
        "Maria Carmela B. Bien", "Romyna B. Bongat", "Claire B. Bobier",
        "Estiffunny S. Celestial", "Julius T. Bariso", "Joseph B. Riosa"
    ]
};

function normName(s) {
    return String(s || "").toLowerCase()
        .replace(/ñ/g, "n")
        .replace(/[^a-z0-9]/g, "");
}

function splitJoined(v) {
    return String(v || "").split(/[;,]/).map(s => s.trim()).filter(Boolean);
}

// normalized name -> { name, teams:Set, roles:Set }
const SITREP_ROSTER_MAP = (function () {
    const map = {};
    Object.keys(SITREP_TEAMS).forEach(team => {
        const t = SITREP_TEAMS[team];
        ["sic", "operator", "drivers", "responders"].forEach(role => {
            t[role].forEach(name => {
                const n = normName(name);
                if (!map[n]) map[n] = { name: name, teams: new Set(), roles: new Set() };
                map[n].teams.add(team);
                map[n].roles.add(role === "drivers" ? "Driver" : role === "sic" ? "SIC" : role === "operator" ? "Operator" : "Responder");
            });
        });
    });
    return map;
})();

const ROSTER_GENERATIONAL = new Set(["i", "ii", "iii", "iv", "v", "jr", "sr"]);

// Significant name tokens for lenient roster matching: lowercase, punctuation
// stripped, generational suffixes (Jr., Sr., II, etc.) removed.
function rosterSignificantTokens(s) {
    return String(s || "")
        .toLowerCase()
        .replace(/ñ/g, "n")
        .replace(/\./g, "")
        .replace(/,/g, " ")
        .split(/\s+/)
        .filter(Boolean)
        .filter(t => !ROSTER_GENERATIONAL.has(t));
}

// Roster entries pre-keyed by their significant-token set for the lenient scan.
const SITREP_ROSTER_TOKEN_LIST = (function () {
    const list = [];
    Object.keys(SITREP_ROSTER_MAP).forEach(n => {
        const entry = SITREP_ROSTER_MAP[n];
        list.push({ entry: entry, tokens: new Set(rosterSignificantTokens(entry.name)) });
    });
    return list;
})();

function rosterEntry(name) {
    const n = normName(name);
    if (n && SITREP_ROSTER_MAP[n]) return SITREP_ROSTER_MAP[n];
    const toks = rosterSignificantTokens(name);
    if (toks.length < 2) return null;
    const first = toks[0];
    const last = toks[toks.length - 1];
    for (const item of SITREP_ROSTER_TOKEN_LIST) {
        if (item.tokens.has(first) && item.tokens.has(last)) return item.entry;
    }
    return null;
}

function isRosterName(name) {
    return !!rosterEntry(name);
}

// ---- Response time helpers (SITREP time fields are free text) ----
function parseTimeMin(v) {
    const m = String(v || "").trim().match(/(\d{1,2}):(\d{2})(?::(\d{2}))?\s*([AP]M)?/i);
    if (!m) return null;
    let h = parseInt(m[1], 10);
    const min = parseInt(m[2], 10);
    const ap = (m[4] || "").toUpperCase();
    if (ap === "PM" && h < 12) h += 12;
    if (ap === "AM" && h === 12) h = 0;
    return h * 60 + min;
}

function minutesBetween(t1, t2) {
    const a = parseTimeMin(t1);
    const b = parseTimeMin(t2);
    if (a == null || b == null) return null;
    let diff = b - a;
    if (diff < -720) diff += 1440;
    if (diff < 0) return null;
    return diff;
}

function avgMinutes(values) {
    const nums = values.filter(v => v != null && v >= 0);
    if (!nums.length) return null;
    return Math.round(nums.reduce((s, v) => s + v, 0) / nums.length);
}

function fmtMinutes(mins) {
    return mins == null ? "—" : mins + " min";
}

function sitrepMonthKey() {
    const now = new Date();
    return String(now.getFullYear()) + "-" + String(now.getMonth() + 1).padStart(2, "0");
}
