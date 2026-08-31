export declare const CODEBASE_MAP_PROMPT = "You are enriching the machine-generated codebase map at CODEBASE_MAP.md. The deterministic sections (Project Overview, Directory Structure, Key Files, Module Deep-Dives, Key Interfaces & APIs, Configuration, Freshness) are already built \u2014 do NOT rewrite them. Your job:\n\n1. Read CODEBASE_MAP.md.\n2. For each module in \"Module Deep-Dives\", read the top 1-2 key files and add a \"Data flow / call chains\" bullet: entry point -> core functions -> persistence/IO. One line per chain, file:line references.\n3. Verify \"Key Interfaces & APIs\" against the actual code. Fix any signature that is wrong. Add missing public exports ONLY if a module lists a public API surface in its package.json \"main\"/\"exports\"/\"bin\".\n4. In the Freshness section, replace \"- Enrichment status: PENDING (explorer must run /map again after significant refactors)\" with a one-line note of what you verified and any corrections you made.\n5. Keep the whole document under 10000 tokens. If you must cut, cut Directory Structure depth first, never the Freshness section.\n6. Do NOT create handoff.md. Do NOT create files under .agents/. Edit CODEBASE_MAP.md in place only.";
export interface MapOptions {
    scope?: string;
    agentsDir?: string;
    enrichmentNote?: string | null;
}
export interface FreshnessInfo {
    gitCommit: string;
    dirty: boolean;
    lastRegenerated: string;
    enriched: boolean;
    recordedCommit: string;
}
export declare function build_codebase_map(workspaceRoot: string, options?: MapOptions): string;
export declare function readFreshness(workspaceRoot: string): FreshnessInfo | null;
/**
 * Returns true when the map's recorded git commit differs from HEAD, meaning the
 * deterministic sections are stale and should be regenerated. A dirty working tree
 * alone does NOT make the map stale (the map reflects the last committed state plus
 * any uncommitted changes the Explorer has since verified).
 */
export declare function isMapStale(workspaceRoot: string): boolean;
/**
 * Extract the Explorer's enrichment note from an existing map so it can be
 * preserved across a deterministic regeneration. Returns null if no note exists.
 */
export declare function extractEnrichmentNote(workspaceRoot: string): string | null;
/**
 * Merge a preserved enrichment note back into a freshly-generated map document.
 * Replaces the "Enrichment status: PENDING" line with VERIFIED + the note.
 */
export declare function mergeEnrichment(freshDoc: string, note: string | null): string;
export declare function get_delta_sections(workspaceRoot: string, changedFiles: string[]): string[];
