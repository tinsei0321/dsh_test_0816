import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from "react/jsx-runtime";
// DocumentPanel: the details column's document half, Codex file-viewer style.
// An open-file tab strip on top (each tab focuses/closes through the owner
// currency); under it a two-pane body — the directory-tree sub-pane on the
// left (ui-project registers the tree) and the reader on the right: the
// latest read window (or a created file's whole text) plus the session's
// mutation hunks. The reader toggles between source mode (numbered,
// syntax-highlighted lines), reading mode (rendered Markdown for .md files),
// and render mode (sandboxed HTML for .html artifacts). While the agent runs,
// the panel follows its latest read/edit automatically; a manual tab click
// pauses following until the next turn starts. Pure presenter: all writes go
// through the owner currency (`onOpen`/`onClose`) and the declared viewing
// store (mode + folds).
import { useEffect, useMemo, useRef } from 'react';
import { DiffBlock, MarkdownText, ReadBlock } from '@deepseek-ai/dsh-client-ui-primitives';
import { deriveDocuments, displayPath } from "./documents.js";
import css from './DocumentPanel.module.css';
export { displayPath } from "./documents.js";
/** Whether the reader's reading mode renders Markdown for this path. */
export function isMarkdownPath(path) {
    return /\.(md|markdown)$/i.test(path);
}
/** Whether the reader offers the HTML render mode (Codex artifact preview). */
export function isHtmlPath(path) {
    return /\.(html?)$/i.test(path);
}
/** The full text of a read window or synthesized create, as one string. */
function contentText(content) {
    return content.lines.map(line => line.text).join('\n');
}
/**
 * The reader body for the focused entry under the given mode: source is the
 * numbered read window; reading renders Markdown for .md paths and a plain
 * pre block otherwise; render shows the HTML artifact in a sandboxed iframe.
 * @param props - full panel props (store carries the mode).
 */
function ReaderBody({ path, content, changes, mode, t, }) {
    if (content === null) {
        return _jsx("div", { className: css.empty, children: t('document.notFound') });
    }
    return (_jsxs(_Fragment, { children: [mode === 'source'
                ? (_jsx(ReadBlock, { lines: content.lines, totalLines: content.totalLines, lang: content.lang, maxLines: 40 }))
                : mode === 'render'
                    ? (_jsx("iframe", { className: css.renderFrame, title: t('document.mode.render'), sandbox: "", srcDoc: contentText(content) }))
                    : isMarkdownPath(path)
                        ? (_jsx("div", { className: css.readingMarkdown, children: _jsx(MarkdownText, { text: contentText(content) }) }))
                        : _jsx("pre", { className: css.readingPlain, children: contentText(content) }), changes.length > 0 && (_jsxs("section", { className: css.changes, children: [_jsx("div", { className: css.changesLabel, children: t('document.changes') }), _jsx(DiffBlock, { diffs: changes })] }))] }));
}
/** The document half of the details panel (see module doc). */
export function DocumentPanel({ docs, doc, onOpen, onClose, cwd, useSession, useStore, actions, renderSlot, t, }) {
    const snapshot = useSession((s) => s);
    const viewMode = useStore(s => s.viewMode);
    const entries = useMemo(() => deriveDocuments(snapshot), [snapshot]);
    const latest = entries[0] ?? null;
    const current = doc === null ? null : entries.find(entry => entry.path === doc) ?? null;
    // Auto-follow: while the agent runs, the panel follows its newest
    // read/edit; a manual tab click pauses following until the next turn (the
    // running edge) starts.
    const manualOverride = useRef(false);
    const wasRunning = useRef(snapshot.running);
    useEffect(() => {
        const running = snapshot.running;
        if (running && !wasRunning.current)
            manualOverride.current = false;
        wasRunning.current = running;
        if (running && !manualOverride.current && latest !== null && doc !== latest.path) {
            onOpen(latest.path);
        }
    }, [snapshot, latest, doc, onOpen]);
    return (_jsx("div", { className: css.root, children: entries.length === 0
            ? _jsx("div", { className: css.empty, children: t('document.empty') })
            : (_jsxs(_Fragment, { children: [docs.length > 0 && (_jsxs("div", { className: css.tabRow, children: [_jsx("div", { className: css.tabStrip, role: "tablist", "aria-label": t('document.list'), children: docs.map(path => (_jsxs("div", { className: path === doc ? css.fileTabActive : css.fileTab, children: [_jsx("button", { type: "button", role: "tab", "aria-selected": path === doc, className: css.fileTabButton, title: path, onClick: () => {
                                                manualOverride.current = true;
                                                onOpen(path);
                                            }, children: displayPath(path, cwd) }), _jsx("button", { type: "button", className: css.fileTabClose, "aria-label": t('document.closeTab', { name: displayPath(path, cwd) }), onClick: () => { onClose(path); }, children: _jsx("svg", { viewBox: "0 0 16 16", width: "12", height: "12", "aria-hidden": true, children: _jsx("path", { d: "M4 4l8 8M12 4l-8 8", stroke: "currentColor", strokeWidth: "1.5", strokeLinecap: "round" }) }) })] }, path))) }), docs.length > 1 && (_jsx("button", { type: "button", className: css.closeAll, "aria-label": t('document.closeAll'), onClick: () => {
                                    manualOverride.current = true;
                                    for (const path of [...docs])
                                        onClose(path);
                                }, children: t('document.closeAll') }))] })), _jsxs("div", { className: css.bodyRow, children: [_jsx("div", { className: css.treePane, children: renderSlot('conversation.details.document.tree', {}) }), _jsx("div", { className: css.viewer, children: current === null
                                    ? _jsx("div", { className: css.empty, children: t('document.emptyDoc') })
                                    : (_jsxs(_Fragment, { children: [_jsxs("div", { className: css.docHeader, children: [_jsx("span", { className: css.docPath, title: current.path, children: displayPath(current.path, cwd) }), _jsxs("div", { className: css.modeSwitch, role: "group", "aria-label": t('document.mode.label'), children: [_jsx("button", { type: "button", className: viewMode === 'source' ? css.modeButtonActive : css.modeButton, "aria-pressed": viewMode === 'source', onClick: () => { actions.setViewMode('source'); }, children: t('document.mode.source') }), _jsx("button", { type: "button", className: viewMode === 'reading' ? css.modeButtonActive : css.modeButton, "aria-pressed": viewMode === 'reading', onClick: () => { actions.setViewMode('reading'); }, children: t('document.mode.reading') }), isHtmlPath(current.path) && (_jsx("button", { type: "button", className: viewMode === 'render' ? css.modeButtonActive : css.modeButton, "aria-pressed": viewMode === 'render', onClick: () => { actions.setViewMode('render'); }, children: t('document.mode.render') }))] })] }), _jsx("div", { className: css.docBody, children: _jsx(ReaderBody, { path: current.path, content: current.content, changes: current.changes, mode: viewMode, t: t }) })] })) })] })] })) }));
}
//# sourceMappingURL=DocumentPanel.js.map