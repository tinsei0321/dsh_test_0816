/**
 * Pure derivation of the document tab's inventory from the conversation
 * snapshot: every path the session read, mutated, or discovered through a
 * path search, with the latest read window, the mutation hunks in session
 * order, and a synthesized full-file view for a created file that was never
 * read back. Everything is derived from the public runtime snapshot (the
 * legacy node list plus the running-call list) — no chat-definition internals,
 * no subscriptions. The function is a pure selector input the panel memoizes.
 * @module
 */
/**
 * Display label: the path relativized to the workspace root when it sits
 * under it (`.` for the root itself, the raw path otherwise).
 * @param path - absolute or display-ready file path.
 * @param cwd - the workspace root to relativize against; absent keeps the path.
 * @returns the display label.
 */
export function displayPath(path, cwd) {
    if (cwd === undefined || cwd === '')
        return path;
    const root = cwd.replace(/[/\\]+$/, '');
    const normalized = path.replaceAll('\\', '/');
    const rooted = root.replaceAll('\\', '/');
    if (normalized === rooted)
        return '.';
    return normalized.startsWith(`${rooted}/`) ? normalized.slice(rooted.length + 1) : path;
}
/** Read-line shape of the render intent maps structurally onto the primitive's line. */
function toReadLines(lines) {
    return lines.map(line => ({ number: line.number, text: line.text }));
}
/** Split whole text into numbered lines, keeping the read window's shape. */
function toLinesFromText(text) {
    const raw = text.split('\n');
    // A trailing newline produces one empty final element that is not a line.
    const lines = raw.length > 1 && raw[raw.length - 1] === '' ? raw.slice(0, -1) : raw;
    return lines.map((line, index) => ({ number: index + 1, text: line }));
}
/** Record one hunk and, for a whole-file change, the candidate full content. */
function recordChange(entry, hunk, index) {
    const change = { path: hunk.path, oldText: hunk.oldText, newText: hunk.newText };
    entry.changes.push(change);
    // A create (or an overwrite without a before-image) carries the whole file;
    // it becomes the reader content, replaced only by a later read or create.
    if (hunk.oldText === null) {
        const lines = toLinesFromText(hunk.newText);
        entry.content = { lines, totalLines: lines.length };
    }
    entry.lastIndex = index;
}
/** Fold one settled result view into the entry it names. */
function foldResultView(result, entry, index) {
    if (result.card === 'read') {
        entry.content = {
            lines: toReadLines(result.lines),
            totalLines: result.totalLines,
            ...(result.lang === undefined ? {} : { lang: result.lang }),
        };
        entry.lastIndex = index;
        return;
    }
    if (result.card === 'diff') {
        // A diff result may name several files; only the hunks that belong to
        // THIS entry fold into it (the visitor dispatches per named path).
        for (const hunk of result.diffs) {
            if (hunk.path === entry.path)
                recordChange(entry, hunk, index);
        }
        return;
    }
    if (result.card === 'search' && result.shape === 'paths') {
        entry.discovered = true;
        entry.lastIndex = index;
    }
}
/**
 * Visit one call block (root and its nested children) at the given session
 * position, folding every path it names into the inventory.
 * @param block - running or settled call.
 * @param index - session position (running calls trail the settled nodes).
 * @param byPath - (path) => the entry for that path.
 */
function visitBlock(block, index, byPath) {
    if ('kind' in block) {
        // Narrowed to ToolResultNode: the running form carries no `kind`.
        if (block.resultView !== null) {
            // A settled call's result is authoritative; fold every named path.
            for (const path of pathsOf(block.resultView)) {
                foldResultView(block.resultView, byPath(path), index);
            }
        }
    }
    else if (block.callView?.card === 'diff') {
        for (const hunk of block.callView.diffs)
            recordChange(byPath(hunk.path), hunk, index);
    }
    for (const child of block.subCalls)
        visitBlock(child, index, byPath);
}
/** The paths one settled result view names (an entry may cover several files). */
function pathsOf(result) {
    if (result.card === 'read')
        return [result.path];
    if (result.card === 'diff')
        return result.diffs.map(hunk => hunk.path);
    if (result.card === 'search' && result.shape === 'paths')
        return result.paths;
    return [];
}
/**
 * Derive the document inventory for one session snapshot: settled tool
 * results in session order (the top-level node list mirrors the chat
 * definitions), then the still-running calls trailing behind.
 * @param snapshot - current conversation snapshot.
 * @returns entries sorted by last activity (newest first; path as the stable tiebreak).
 */
export function deriveDocuments(snapshot) {
    const inventory = new Map();
    const byPath = (path) => {
        const existing = inventory.get(path);
        if (existing !== undefined)
            return existing;
        const entry = { path, content: null, changes: [], discovered: false, lastIndex: -1 };
        inventory.set(path, entry);
        return entry;
    };
    let index = 0;
    for (const node of snapshot.nodes) {
        if (node.kind === 'tool-result')
            visitBlock(node, index, byPath);
        index += 1;
    }
    for (const call of snapshot.runningCalls) {
        visitBlock(call, index, byPath);
        index += 1;
    }
    const entries = [];
    for (const entry of inventory.values()) {
        entries.push({
            path: entry.path,
            content: entry.content,
            changes: entry.changes,
            discoveredOnly: entry.content === null && entry.changes.length === 0 && entry.discovered,
            lastIndex: entry.lastIndex,
        });
    }
    entries.sort((a, b) => (b.lastIndex - a.lastIndex) || (a.path < b.path ? -1 : a.path > b.path ? 1 : 0));
    return entries;
}
//# sourceMappingURL=documents.js.map