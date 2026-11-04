import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import {
    buildPublicPayload,
    type PublicPayload,
    type SitrepRow,
} from "../_shared/sitrep-aggregate.ts";

/**
 * Public, unauthenticated aggregate feed for the website's incident board.
 *
 * Deliberately separate from `sitrep-data`: that function is admin/operator
 * only and returns rows. This one has no row code path at all — it reads the
 * sheet with the server-side token, reduces it with sitrep-aggregate, and
 * replies with counts. No name, contact number, address, narrative, photo id
 * or responder log can leave here, because none of them are copied into the
 * payload.
 *
 * Caching is in two layers:
 *   1. a warm isolate keeps the payload in memory for the TTL;
 *   2. a single-row `sitrep_public_cache` table lets cold isolates share it,
 *      so Apps Script is hit at most once per TTL across the project.
 *
 * If the cache table is missing or unreadable the function still works, just
 * without the cross-isolate layer.
 */

const CACHE_TABLE = "sitrep_public_cache";
const CACHE_ID = 1;
const TTL_MS = 15 * 60 * 1000;
const TTL_SECONDS = TTL_MS / 1000;

const corsHeaders = {
    "Access-Control-Allow-Origin": "*",
    "Access-Control-Allow-Headers": "content-type",
    "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function respond(payload: PublicPayload, maxAge: number): Response {
    return new Response(JSON.stringify(payload), {
        status: 200,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": `public, max-age=${maxAge}`,
            "X-Content-Type-Options": "nosniff",
        },
    });
}

/** Generic failure only. Upstream detail stays in the logs, not the response. */
function fail(status: number): Response {
    return new Response(JSON.stringify({ ok: false, error: "Data temporarily unavailable" }), {
        status,
        headers: {
            ...corsHeaders,
            "Content-Type": "application/json; charset=utf-8",
            "Cache-Control": "no-store",
        },
    });
}

let memory: { at: number; payload: PublicPayload } | null = null;

interface CachedRow {
    payload: PublicPayload;
    at: number;
}

async function readCache(db: ReturnType<typeof createClient>): Promise<CachedRow | null | "unavailable"> {
    const { data, error } = await db
        .from(CACHE_TABLE)
        .select("payload, updated_at")
        .eq("id", CACHE_ID)
        .maybeSingle();
    if (error) return "unavailable";
    if (!data || !data.payload || typeof data.payload !== "object") return null;
    const payload = data.payload as PublicPayload;
    // A row written by an older deploy is not worth half-reading.
    if (payload.ok !== true || payload.v !== 2 || !payload.totals || !payload.slices) return null;
    const at = Date.parse(String(data.updated_at || ""));
    return { payload, at: Number.isFinite(at) ? at : 0 };
}

/**
 * Claims the refresh slot by moving `updated_at` forward. Only one caller can
 * win the conditional update, so a burst of visitors still results in a single
 * Apps Script fetch.
 */
async function claimRefresh(db: ReturnType<typeof createClient>): Promise<boolean> {
    const nowIso = new Date().toISOString();
    const cutoff = new Date(Date.now() - TTL_MS).toISOString();
    const { data, error } = await db
        .from(CACHE_TABLE)
        .update({ updated_at: nowIso })
        .eq("id", CACHE_ID)
        .lt("updated_at", cutoff)
        .select("id");
    if (error) return false;
    return Array.isArray(data) && data.length > 0;
}

async function releaseClaim(db: ReturnType<typeof createClient>): Promise<void> {
    await db
        .from(CACHE_TABLE)
        .update({ updated_at: new Date(0).toISOString() })
        .eq("id", CACHE_ID);
}

async function writeCache(db: ReturnType<typeof createClient>, payload: PublicPayload): Promise<void> {
    await db.from(CACHE_TABLE).upsert({
        id: CACHE_ID,
        payload,
        updated_at: new Date().toISOString(),
    });
}

async function loadFromSheet(apiUrl: string, apiToken: string): Promise<PublicPayload> {
    const url = `${apiUrl}?action=sitreps&token=${encodeURIComponent(apiToken)}`;
    const res = await fetch(url, { headers: { Accept: "application/json" } });
    if (!res.ok) throw new Error("Upstream rejected the request");

    const text = await res.text();
    let data: { ok?: boolean; rows?: unknown };
    try {
        data = JSON.parse(text);
    } catch {
        throw new Error("Upstream returned a non-JSON body");
    }
    if (!data || data.ok !== true || !Array.isArray(data.rows)) {
        throw new Error("Upstream returned no rows");
    }
    return buildPublicPayload(data.rows as SitrepRow[], new Date());
}

Deno.serve(async (req) => {
    if (req.method === "OPTIONS") {
        return new Response("ok", { headers: corsHeaders });
    }
    if (req.method !== "GET" && req.method !== "HEAD") {
        return new Response("Method not allowed", { status: 405, headers: corsHeaders });
    }

    const now = Date.now();
    if (memory && now - memory.at < TTL_MS) {
        return respond(memory.payload, TTL_SECONDS);
    }

    const apiUrl = Deno.env.get("SITREP_API_URL");
    const apiToken = Deno.env.get("SITREP_API_TOKEN");
    if (!apiUrl || !apiToken) return fail(503);

    let db: ReturnType<typeof createClient> | null = null;
    try {
        db = createClient(
            Deno.env.get("SUPABASE_URL")!,
            Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!,
            { auth: { persistSession: false, autoRefreshToken: false } },
        );
    } catch {
        db = null;
    }

    let cacheUsable = db !== null;

    if (db) {
        const cached = await readCache(db);
        if (cached === "unavailable") {
            cacheUsable = false;
        } else if (cached && Date.now() - cached.at < TTL_MS) {
            memory = { at: cached.at, payload: cached.payload };
            return respond(cached.payload, Math.max(60, Math.round((TTL_MS - (Date.now() - cached.at)) / 1000)));
        }
    }

    if (db && cacheUsable) {
        const claimed = await claimRefresh(db);
        if (!claimed) {
            // Another isolate is already refreshing. Serve what is stored, with a
            // short max-age so the browser picks up the new figures soon after.
            const again = await readCache(db);
            if (again !== "unavailable" && again) {
                return respond(again.payload, 60);
            }
            // Empty cache and a lost race: fall through and build it here.
        }
    }

    try {
        const payload = await loadFromSheet(apiUrl, apiToken);
        memory = { at: Date.now(), payload };
        if (db && cacheUsable) await writeCache(db, payload);
        return respond(payload, TTL_SECONDS);
    } catch (err) {
        console.error("sitrep-public failed:", (err as Error)?.message || "unknown error");
        if (db && cacheUsable) await releaseClaim(db);
        if (memory) return respond(memory.payload, 60);
        return fail(503);
    }
});
