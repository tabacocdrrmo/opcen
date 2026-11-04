/**
 * Aggregation for the public SITREP board.
 *
 * This is a deliberate port of the client-side logic in
 * opcen/js/sitrep-dashboard.js: the cause keyword table, the barangay alias
 * list, tagSitrep() and the counting helpers. The admin dashboard keeps its own
 * copy because it runs in the browser against the full rows; the public
 * function must never send a row to a client, so the tagging happens here.
 *
 * If the keyword lists or barangay aliases change, change both files.
 *
 * The payload type below is the whole public contract. No name, contact number,
 * address, narrative, photo id or responder log is ever part of it, and this
 * module has no access to the responder log in the first place.
 */

export type SitrepRow = Record<string, unknown>;

export interface PublicEntry {
    name: string;
    count: number;
}

export interface PublicMonthly {
    /** "YYYY-MM", local (Asia/Manila) month. */
    month: string;
    count: number;
}

/**
 * One period's figures. The display ships year-to-date and this-month side by
 * side, so switching range is a re-render rather than another round trip.
 */
export interface PublicSlice {
    natures: PublicEntry[];
    causes: PublicEntry[];
    barangays: PublicEntry[];
    /** 24 buckets, index = hour of call time. */
    hourly: number[];
    /** 7 buckets, index = day of week (0 = Sunday). */
    weekday: number[];
}

export interface PublicPayload {
    ok: true;
    /**
     * Shape version. Bumped whenever a field changes meaning, so a cache row
     * written by an older deploy is ignored instead of half-read.
     */
    v: 2;
    generatedAt: string;
    year: number;
    /** 1-12, the local month the payload was built for. */
    month: number;
    totals: {
        year: number;
        month: number;
        today: number;
        patientsMonth: number;
        patientsToday: number;
    };
    /** Most frequent nature this month, for the display's quick-report tile. */
    topNatureMonth: PublicEntry | null;
    /**
     * Year to date and this month. Every group is present in full — the display
     * lists scroll. Only sensitive causes are merged, never the long tail.
     */
    slices: {
        year: PublicSlice;
        month: PublicSlice;
    };
    /** Rolling 12 months, oldest first. Leading months before recording began are omitted. */
    monthly: PublicMonthly[];
}

/* ------------------------------------------------------------------ *
 * Cause keywords (ported verbatim from sitrep-dashboard.js)
 * ------------------------------------------------------------------ */

const CAUSE_KEYWORDS: Record<string, Record<string, string[]>> = {
    "Vehicular Accident": {
        "Collision": ["collision", "collided", "crashed", "crash", "crashed into", "crash into", "bump"],
        "Rear-end collision": ["rear-ended", "rear ended", "rear end collision", "hit from behind", "hit from the rear"],
        "Head-on collision": ["head-on", "head on", "head-on collision", "frontal collision", "front collision"],
        "Side collision": ["side collision", "side impact", "sideswiped", "side-swiped", "t-bone", "t bone"],
        "Multiple vehicle collision": ["multiple vehicle", "multiple vehicles", "multiple collision", "pile-up", "pile up", "chain collision", "multi-vehicle"],
        "Hit-and-run": ["hit and run", "hit-and-run", "hit & run", "fled the scene", "fled from the scene", "left the scene", "driver fled", "vehicle fled"],
        "Reckless/overspeeding": ["reckless", "reckless driving", "reckless driver", "overspeeding", "overspeed", "speeding", "excessive speed", "high speed", "driving fast"],
        "Alcohol-related": ["alcohol", "drunk", "intoxicated", "drinking", "liquor", "drunk driving", "under the influence", "alcohol intoxication"],
        "Motorcycle involved": ["motorcycle", "motorbike", "motor cycle", "motorcycle rider", "motorbike rider"],
        "Pedestrian involved": ["pedestrian", "hit a person", "hit a man", "hit a woman", "hit person", "hit pedestrian", "pedestrian hit", "pedestrian struck", "person struck"],
        "Animal on road": ["hit a dog", "hit an animal", "hit a stray", "ran over a dog", "ran over an animal", "dog got hit", "animal collision", "stray dog", "hit dog", "hit cat", "hit a cat", "ran over a cat", "animal on road", "animal crossing", "livestock on road"],
        "Loss of control": ["lost control", "loss of control", "lost control of vehicle", "lost control of motorcycle", "vehicle went out of control", "motorcycle went out of control"],
        "Vehicle rollover": ["rolled over", "rollover", "roll over", "overturned", "overturned vehicle", "vehicle overturned", "motorcycle overturned"],
        "Motorcycle skid": ["motorcycle skid", "motorbike skid", "motorcycle skidded", "motorbike skidded", "skidded", "skid"],
        "Mechanical failure": ["mechanical failure", "mechanical problem", "brake failure", "brake malfunction", "brake problem", "brake loss", "lost its brake", "engine failure", "engine problem", "tire blowout", "flat tire", "tire failure", "steering failure"],
        "Road condition": ["slippery road", "wet road", "rough road", "pothole", "potholes", "road damage", "poor road condition", "muddy road", "road obstruction"],
        "Vehicle vs. property": ["hit a wall", "hit wall", "hit a fence", "hit fence", "hit a post", "hit post", "hit a building", "hit building", "hit a barrier", "hit barrier", "hit a house", "hit house"],
        "Road Accident": [],
    },
    "Medical Emergency": {
        "Cardiac/heart-related": ["cardiac", "heart attack", "heart problem", "cardiac arrest", "chest pain"],
        "Stroke": ["stroke", "suspected stroke", "signs of stroke", "possible stroke"],
        "Difficulty of Breathing": ["difficulty of breathing", "difficulty on breathing", "difficulty breathing", "difficulty in breathing", "shortness of breath", "can't breathe", "cannot breathe", "hard to breathe", "breathing problem", "breathing difficulty", "respiratory problem", "hyperventilation", "hyperventilating", "hypervent", "hyperventilation episode", "asthma", "asthma attack", "asthmatic", "asthmatic attack", "panic attack", "panic attacks"],
        "Seizure": ["seizure", "seizures", "convulsion", "convulsions", "convulsing", "epilepsy", "epileptic", "epileptic seizure", "epileptic attack", "seizure disorder"],
        "Unconsciousness": ["unconscious", "unresponsive", "not responding", "unconscious person", "lost consciousness", "loss of consciousness", "lost of consciousness"],
        "Fainting": ["fainted", "fainting", "passed out", "pass out", "felt faint"],
        "Heat stroke": ["heat stroke", "heatstroke", "heat exhaustion", "heat-related", "overheated", "heat exposure"],
        "High blood pressure": ["high blood pressure", "hypertension", "elevated blood pressure", "high bp", "elevated bp"],
        "Diabetes-related": ["diabetic", "diabetes", "high blood sugar", "low blood sugar", "hypoglycemia", "hyperglycemia"],
        "Fever": ["fever", "high fever", "very high fever"],
        "Poisoning": ["poisoned", "poisoning", "poison", "ingested poison", "chemical poisoning", "toxic ingestion"],
        "Allergic reaction": ["allergic reaction", "allergy", "allergic", "anaphylaxis", "anaphylactic"],
        "Vomiting/Gastrointestinal": ["vomiting", "vomitting", "vomiting blood", "vomitting blood", "diarrhea", "diarrhoea"],
        "Pain": ["pain", "back pain", "abdominal pain", "stomach pain", "chest discomfort", "headache", "sprain ankle"],
        "Wounds": ["wound", "abrasion", "abrasions", "laceration", "lacerations", "open wound", "open wounds", "scraped", "cuts and scratches", "skin wound", "superficial wound", "injuries to the upper and lower extremities", "injuries to the upper", "injuries to the lower", "injuries to extremities", "injuries on the upper and lower extremities", "injuries on the upper", "injuries on the lower"],
        "Pregnancy-related": ["pregnant", "pregnancy", "in labor", "giving birth", "childbirth", "delivery"],
        "Animal bite": ["dog bite", "animal bite", "dog bitten", "animal bitten", "snake bite", "snakebite", "cat bite"],
        "Alcohol-related": ["alcohol", "drunk", "intoxicated", "drinking", "liquor"],
        "Drug-related": ["drug", "drugs", "drug overdose", "overdose", "drug intoxication"],
        "Dizziness": ["dizzy", "dizziness", "lightheaded", "unsteady"],
        "Body Weakness": ["weak", "weakness", "feeble", "exhausted"],
        "Tenderness": ["tender", "tenderness", "sore", "soreness", "painful"],
        "Bleeding": ["nosebleed", "nose bleed", "nose bleeding", "epistaxis", "bleeding", "hemorrhage", "hemorrhaging", "bleeding wound", "uncontrolled bleeding"],
        "Swelling/Inflammation": ["joint swelling", "swelling", "swollen", "swollen joint", "inflammation", "inflamed", "edema"],
        "Skin conditions": ["psoriasis", "skin condition", "skin disease", "skin rash", "rash", "eczema", "dermatitis"],
        "Medical Condition": [],
    },
    "Drowning": {
        "Near drowning": ["near drowning", "almost drowned", "nearly drowned", "rescued from drowning", "rescued from water"],
        "Swimming incident": ["swimming accident", "swimming incident", "swimmer", "swimming"],
        "Boating incident": ["boat accident", "boat incident", "boat capsized", "capsized", "capsized boat", "overturned boat", "boat overturned", "boating accident"],
        "Water-related": ["drowning", "river", "sea", "ocean", "pool", "swimming pool", "creek", "lake", "water"],
        "Accidental drowning": ["accidentally drowned", "accidental drowning", "accidentally fell into water", "fell into the water"],
    },
    "Extrication": {
        "Vehicle entrapment": ["trapped in vwehicle", "trapped inside vehicle", "trapped in car", "trapped inside car", "vehicle entrapment", "car entrapment", "vehicular entrapment", "entrapment"],
        "Structural entrapment": ["trapped under debris", "trapped inside building", "trapped under rubble", "trapped in building", "trapped under structure"],
        "Machinery entrapment": ["trapped in machine", "caught in machine", "machinery accident", "machine accident", "trapped in machinery", "caught in machinery"],
        "Collapsed structure": ["building collapse", "structure collapse", "collapsed building", "collapsed structure", "building collapsed", "structure collapsed", "falling structure", "rubble"],
    },
    "Fire Alarm": {
        "Smoke alarm": ["smoke alarm", "smoke detector", "smoke detected", "detected smoke"],
        "Possible fire": ["possible fire", "suspected fire", "smell of smoke", "smoke coming from", "smoke coming out"],
        "Electrical fire": ["electrical fire", "electrical short", "short circuit", "electrical spark", "electrical sparks", "wiring fire", "electrical burning"],
        "Kitchen fire": ["kitchen fire", "cooking fire", "stove fire", "cooking accident", "oil fire"],
        "Gas-related": ["gas leak", "lpg leak", "lpg", "gas explosion", "gas smell", "leaking gas"],
        "Burning material": ["burning material", "burning garbage", "burning trash", "burning leaves", "burning plastic", "burning grass"],
        "Fire-related": ["fire", "fire alarm", "alarm activated", "alarm triggered", "alarm went off", "alarm sounded"],
    },
    "Physical Violence / Assault": {
        "Physical altercation": ["fight", "fighting", "assault", "attacked", "physical altercation"],
        "Verbal altercation": ["verbal altercation", "verbal argument", "verbal dispute", "argument", "arguing", "quarrel", "quarreling", "shouting", "yelling", "heated argument", "threatened", "threatening"],
        "Stabbing": ["stabbed", "stabbing", "stab wound", "knife attack", "knife wound", "wounded with knife", "stabbed with knife"],
        "Shooting": ["shot", "shooting", "gunshot", "gunshot wound", "shot with gun", "firearm injury"],
        "Blunt-force injury": ["beaten", "beating", "battered", "hit with object", "struck with object", "beaten with object"],
        "Domestic violence": ["domestic violence", "domestic abuse", "husband attacked", "wife attacked", "partner attacked", "family violence", "family dispute"],
        "Sexual assault": ["sexual assault", "sexual abuse", "rape", "attempted rape"],
        "Robbery-related": ["robbery", "robbed", "mugging", "hold-up", "hold up", "snatching"],
    },
    "Self Accident": {
        "Fall": ["fell down", "accidental fall", "accidentally fell", "accidental falls", "sustained a fall", "had a fall"],
        "Fall from height": ["fell from roof", "fell from building", "fell from height", "fell from stairs", "fell off roof", "fell off building", "fell from ladder", "fell off ladder"],
        "Slip/trip": ["slipped", "slipping", "tripped", "trip and fall", "tripped and fell"],
        "Motorcycle accident": ["motorcycle accident", "motorbike accident", "motorcycle crash", "motorbike crash"],
        "Bicycle accident": ["bicycle accident", "bike accident", "bicycle crash", "bicycle fell"],
        "Hit object": ["hit a tree", "hit tree"],
        "Electrical-related": ["electrical accident", "electrocution", "electric shock", "electrical shock", "shocked by electricity", "live wire", "electric wire"],
        "Work-related accident": ["workplace accident", "work accident", "work-related accident", "work related accident", "occupational accident", "workplace injury"],
        "Animal-related": ["livestock", "stray animal", "animal attack"],
        "Accidental Injury": [],
    },
    "Self-Harm": {
        "Suicide attempt": ["suicide attempt", "attempted suicide", "tried to kill self", "attempted to kill self", "suicidal attempt"],
        "Self-inflicted injury": ["self-inflicted", "self inflicted", "injured self", "hurt self", "intentionally injured self"],
        "Cutting": ["cut self", "cutting", "cut himself", "cut herself", "slashed self", "self-cutting"],
        "Hanging/strangulation": ["hanging", "attempted hanging", "strangulation", "attempted strangulation", "strangled self"],
        "Overdose": ["overdose", "took pills", "took medication", "took too many pills", "medication overdose", "drug overdose"],
        "Self-poisoning": ["drank poison", "ingested poison", "took poison", "poison ingestion", "self poisoning", "self-poisoning"],
        "Jumping from height": ["jumped from building", "jumped from bridge", "jumped from height", "jumped off building", "jumped off bridge", "jumped from roof"],
    },
    "Sports-Related Injury": {
        "Sports Injury": ["sports injury", "sports-related", "sports related", "sports accident", "sports-based", "during practice", "during training", "training injury", "gym injury", "workout injury", "exercise injury"],
        "Sport event accident": ["during a game", "during game", "during the game", "during a match", "during the match", "basketball game", "volleyball game", "soccer game", "football game", "badminton game", "basketball", "volleyball", "soccer", "football", "badminton", "court", "court sports"],
        "Sprain/strain": ["sprain", "sprained", "strain", "strained", "twisted ankle", "twisted knee", "rolled ankle", "rolled ankle", "muscle strain", "muscle pull", "pulled muscle"],
        "Fracture": ["fracture", "fractured", "broken bone", "broke his arm", "broke her arm", "broke his leg", "broke her leg", "broken ankle", "broken wrist", "broken hand", "broken leg"],
        "Muscle cramp": ["muscle cramp", "muscle cramps", "leg cramp", "leg cramps", "calf cramp", "charley horse"],
        "Sports fall": ["fell while playing", "fell during the game", "fell during practice", "slipped while playing", "tripped while playing", "collapsed on the court", "collapsed on the field"],
    },
};

function escapeRegExp(value: string): string {
    return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

interface CauseRule {
    name: string;
    category: string;
    pattern: RegExp;
}

/**
 * Flattened cause hierarchy, one entry per sub-cause name. A name that appears
 * in two categories (e.g. "Alcohol-related") is merged, exactly as the
 * dashboard's CAUSE_DEFS does, and its keywords are compiled into one regex so
 * tagging a row is a handful of tests rather than a few hundred.
 */
const CAUSE_RULES: CauseRule[] = (() => {
    const merged = new Map<string, { category: string; keywords: string[] }>();
    for (const category of Object.keys(CAUSE_KEYWORDS)) {
        for (const [name, keywords] of Object.entries(CAUSE_KEYWORDS[category])) {
            const existing = merged.get(name);
            if (existing) existing.keywords.push(...keywords);
            else merged.set(name, { category, keywords: [...keywords] });
        }
    }
    const rules: CauseRule[] = [];
    for (const [name, { category, keywords }] of merged) {
        if (keywords.length === 0) continue;
        const alternation = [...new Set(keywords)].map(escapeRegExp).join("|");
        rules.push({ name, category, pattern: new RegExp("\\b(?:" + alternation + ")") });
    }
    return rules;
})();

const CAUSE_CATEGORY = new Map(CAUSE_RULES.map((rule) => [rule.name, rule.category]));

/** Sub-cause names that stay visible in the admin dashboard but are folded into
 *  "Other" on the public board. */
const SENSITIVE_CAUSES = new Set([
    "Suicide attempt",
    "Self-inflicted injury",
    "Cutting",
    "Hanging/strangulation",
    "Overdose",
    "Self-poisoning",
    "Jumping from height",
    "Domestic violence",
    "Sexual assault",
    "Drug-related",
]);

/** Nature values that are sensitive in their own right. */
const SENSITIVE_NATURE = /self[\s-]?harm|sexual|domestic|drug/i;

/* ------------------------------------------------------------------ *
 * Barangays (ported verbatim from sitrep-dashboard.js)
 * ------------------------------------------------------------------ */

const BARANGAYS: { name: string; keys: string[] }[] = [
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
    { name: "Karangahan", keys: ["karangahan"] },
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
    { name: "San Miguel Island", keys: ["agnas", "hacienda", "rawis", "sagurong", "visita", "sanmiguel", "maritime", "maritimeport"] },
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
    { name: "TNHS", keys: ["tnhs"] },
    { name: "Ziga Avenue", keys: ["ziga"] },
];

/* ------------------------------------------------------------------ *
 * Row helpers (ported from sitrep-dashboard.js)
 * ------------------------------------------------------------------ */

function splitCell(value: unknown): string[] {
    return String(value || "").split(";").map((s) => s.trim()).filter(Boolean);
}

function splitJoined(value: unknown): string[] {
    return String(value || "").split(/[;,]/).map((s) => s.trim()).filter(Boolean);
}

function countPatients(row: SitrepRow): number {
    return splitCell(row["Patient"]).length;
}

function placeText(row: SitrepRow): string {
    return String(row["Barangay"] || "").trim() || String(row["Place / Landmark"] || "").trim();
}

/**
 * Barangay names found in a free-text place. Unlike the dashboard this never
 * falls back to the raw text: an unmatched place stays uncounted rather than
 * shipping an address to the browser.
 */
function barangayNames(value: unknown): string[] {
    const raw = String(value || "").trim();
    if (!raw) return [];
    const norm = raw.toLowerCase().replace(/ñ/g, "n").replace(/[^a-z0-9]/g, "");
    const found: string[] = [];
    for (const barangay of BARANGAYS) {
        for (const key of barangay.keys) {
            if (norm.includes(key)) {
                found.push(barangay.name);
                break;
            }
        }
    }
    return found;
}

function tagSitrep(row: SitrepRow): string[] {
    const text = [row["Remarks"], row["Initial Impression"], row["Injuries"], row["Cause of Incident"]]
        .filter(Boolean)
        .join(" ")
        .toLowerCase();

    const tags = new Set<string>();
    for (const rule of CAUSE_RULES) {
        if (rule.pattern.test(text)) tags.add(rule.name);
    }

    const vehicles = splitJoined(row["Involved Vehicle Type"]);
    if (vehicles.length >= 2) tags.add("Collision");
    if (vehicles.some((v) => /motorcycle|motorbike/i.test(v))) tags.add("Motorcycle involved");

    const nature = String(row["Nature of Incident"] || "").trim();
    const isVehicular = nature === "Vehicular Accident" ||
        [...tags].some((t) => CAUSE_CATEGORY.get(t) === "Vehicular Accident");
    if (isVehicular) {
        const rest = [...tags].filter((t) => t !== "Wounds" && t !== "Pain");
        return rest.length ? rest : ["Road Accident"];
    }

    if (tags.size === 0) {
        if (nature === "Physical Violence / Assault") return ["Verbal altercation"];
        if (nature === "Fire Alarm") return ["Fire-related"];
        if (nature === "Medical Emergency") return ["Medical Condition"];
        if (nature === "Self Accident") return ["Accidental Injury"];
        if (nature === "Sports-Related Injury") return ["Sports Injury"];
    }
    return [...tags];
}

/**
 * Hour of the call. Scans the whole cell rather than only its start, because
 * the sheet can hand back either "8:30 AM" or a full ISO datetime; both are
 * common depending on the column type.
 */
function timeHour(value: unknown): number | null {
    const text = String(value || "").trim();
    if (!text) return null;
    const match = /(\d{1,2}):(\d{2})/.exec(text);
    if (!match) return null;

    let hour = Number(match[1]);
    const rest = text.slice(match.index + match[0].length);
    const meridiem = /^\s*([AP])\.?\s*M\b/i.exec(rest);
    if (meridiem) {
        const pm = meridiem[1].toUpperCase() === "P";
        if (pm && hour < 12) hour += 12;
        if (!pm && hour === 12) hour = 0;
    }
    return hour >= 0 && hour <= 23 ? hour : null;
}

function dateDayOfWeek(value: unknown): number | null {
    const match = String(value || "").match(/(\d{4})-(\d{1,2})-(\d{1,2})/);
    if (!match) return null;
    return new Date(Date.UTC(Number(match[1]), Number(match[2]) - 1, Number(match[3]))).getUTCDay();
}

function countBy(rows: SitrepRow[], field: string): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) {
        const key = String(row[field] || "").trim();
        if (!key) continue;
        counts.set(key, (counts.get(key) || 0) + 1);
    }
    return counts;
}

/* ------------------------------------------------------------------ *
 * Public payload
 * ------------------------------------------------------------------ */

const MANILA_OFFSET_MS = 8 * 60 * 60 * 1000;

/** Tabaco City is UTC+8 with no daylight saving, so a fixed offset is exact. */
function manilaParts(now: Date): { year: number; month: number; day: number } {
    const local = new Date(now.getTime() + MANILA_OFFSET_MS);
    return {
        year: local.getUTCFullYear(),
        month: local.getUTCMonth() + 1,
        day: local.getUTCDate(),
    };
}

function pad(value: number): string {
    return String(value).padStart(2, "0");
}

function sortedEntries(counts: Map<string, number>): [string, number][] {
    return [...counts.entries()].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
}

/** Nature counts, with sensitive natures folded into "Other". */
function countNatures(rows: SitrepRow[]): Map<string, number> {
    const counts = new Map<string, number>();
    for (const row of rows) {
        let name = String(row["Nature of Incident"] || "").trim();
        if (!name) continue;
        if (SENSITIVE_NATURE.test(name)) name = "Other";
        counts.set(name, (counts.get(name) || 0) + 1);
    }
    return counts;
}

/** Counts one period's rows. `tagsByRow` must already cover every row passed. */
function buildSlice(rows: SitrepRow[], tagsByRow: Map<SitrepRow, string[]>): PublicSlice {
    const natureCounts = countNatures(rows);

    const causeCounts = new Map<string, number>();
    let untagged = 0;
    for (const row of rows) {
        const tags = tagsByRow.get(row) || [];
        if (tags.length === 0) {
            untagged++;
            continue;
        }
        for (const tag of tags) {
            const name = SENSITIVE_CAUSES.has(tag) ? "Other" : tag;
            causeCounts.set(name, (causeCounts.get(name) || 0) + 1);
        }
    }
    if (untagged > 0) causeCounts.set("Unknown / No cause", untagged);

    // Barangays. Rows tagged with a sensitive cause are left out entirely, so a
    // single incident cannot be inferred from a barangay total.
    const placeCounts = new Map<string, number>();
    for (const row of rows) {
        const tags = tagsByRow.get(row) || [];
        if (tags.some((tag) => SENSITIVE_CAUSES.has(tag))) continue;
        for (const name of new Set(barangayNames(placeText(row)))) {
            placeCounts.set(name, (placeCounts.get(name) || 0) + 1);
        }
    }

    // Hour of day and day of week
    const hourly = new Array(24).fill(0);
    const weekday = new Array(7).fill(0);
    for (const row of rows) {
        const hour = timeHour(row["Call Time"]);
        if (hour !== null) hourly[hour]++;
        const dow = dateDayOfWeek(row["Call Date"]);
        if (dow !== null) weekday[dow]++;
    }

    return {
        natures: sortedEntries(natureCounts).map(([name, count]) => ({ name, count })),
        causes: sortedEntries(causeCounts).map(([name, count]) => ({ name, count })),
        barangays: sortedEntries(placeCounts).map(([name, count]) => ({ name, count })),
        hourly,
        weekday,
    };
}

export function buildPublicPayload(rows: SitrepRow[], now: Date = new Date()): PublicPayload {
    const { year, month, day } = manilaParts(now);
    const yearPrefix = String(year);
    const monthPrefix = `${year}-${pad(month)}`;
    const todayPrefix = `${monthPrefix}-${pad(day)}`;

    const yearRows = rows.filter((row) => String(row["Call Date"] || "").startsWith(yearPrefix));
    const monthRows = yearRows.filter((row) => String(row["Call Date"] || "").startsWith(monthPrefix));
    const todayRows = yearRows.filter((row) => String(row["Call Date"] || "").startsWith(todayPrefix));

    // Tag once per row; the cause list and the barangay exclusion both use it.
    // monthRows is a subset of yearRows, so one map serves both slices.
    const tagsByRow = new Map<SitrepRow, string[]>();
    for (const row of yearRows) tagsByRow.set(row, tagSitrep(row));

    const yearSlice = buildSlice(yearRows, tagsByRow);
    const monthSlice = buildSlice(monthRows, tagsByRow);

    // Rolling 12 months ending with the current one, across all loaded years.
    const monthTotals = new Map<string, number>();
    for (const row of rows) {
        const key = String(row["Call Date"] || "").slice(0, 7);
        if (/^\d{4}-\d{2}$/.test(key)) monthTotals.set(key, (monthTotals.get(key) || 0) + 1);
    }
    const monthly: PublicMonthly[] = [];
    for (let back = 11; back >= 0; back--) {
        const cursor = new Date(Date.UTC(year, month - 1 - back, 1));
        const key = `${cursor.getUTCFullYear()}-${pad(cursor.getUTCMonth() + 1)}`;
        monthly.push({ month: key, count: monthTotals.get(key) || 0 });
    }

    // The sheet only goes back so far. Drop leading months with no reports at
    // all, so the trend starts where recording starts: a flat run of zeros at
    // the left edge would read as "no incidents" rather than "not yet recorded".
    // Zeros after the first month with data are real and stay.
    while (monthly.length > 1 && monthly[0].count === 0) monthly.shift();

    return {
        ok: true,
        v: 2,
        generatedAt: now.toISOString(),
        year,
        month,
        totals: {
            year: yearRows.length,
            month: monthRows.length,
            today: todayRows.length,
            patientsMonth: monthRows.reduce((sum, row) => sum + countPatients(row), 0),
            patientsToday: todayRows.reduce((sum, row) => sum + countPatients(row), 0),
        },
        topNatureMonth: monthSlice.natures[0] || null,
        slices: {
            year: yearSlice,
            month: monthSlice,
        },
        monthly,
    };
}
