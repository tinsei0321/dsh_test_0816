# @deepseek-ai/dsh-client-ui-project

English | [中文](README.zh.md)

The frame's rightmost column, the project directory tree, Codex-style: a lazy file browser over the current workspace. The tree's root is the current session's workspace, falling back to the most recent workspace — derived from the standard workspace/session projections in one pure function. The root level loads automatically; directory rows expand one level at a time through the runtime's `workspaces.listTreeEntries` (the Host's `host.listTreeEntries` RPC), and each in-flight load is aborted when its level collapses or the root changes, so a superseded request never overwrites a newer one. File rows open the details column's document reader through `ui-conversation`'s optional `documentOpen` service (absent provider = clicking does nothing, like every other consumer), and carry a colored status dot in front of the name when the repository's git working-tree status marks the file — VS Code SCM semantics: `M` modified (amber), `A` added and `R` renamed (green), `U` untracked (green), `D` deleted (red), `C` conflict (purple), scanned once per root through `workspaces.gitStatus` (the Host's `host.gitStatus` RPC). Hidden rows stay hidden until the section header's "Show hidden files" toggle flips, matching the directory browser; a truncated level reports the "…" hint the Host's bound implies.

The browser half registers into the `frame.projectTree` seat declared by `ui-layout`'s AppFrame entry, which renders it as the rightmost column beside the details column, so the project files and the focused document sit side by side — the tree at the far right edge. The header ✕ collapses the column to a compact re-open rail through `ctx.layout.toggleTree()`. Composing this plugin out of cordis.yml leaves the column empty and it renders nothing at zero cost. The tree's viewing state (expansion, selection, loaded levels, the hidden toggle) lives in a declared store shared across column-collapse remounts; levels are re-listed on demand and deliberately not persisted, since paths from a previous session's workspace would only mislead.

The node half is an empty apply (the roster row); the plugin registers no prompt section, tool schema, or session event.

## Model Experience

None, as the package is a browser-side directory browser over the Host's `host.listTreeEntries` listing and registers nothing model-facing.

#### KV Cache effect

The package adds no system-prompt section and no request content, so it has no effect on KV-cache reuse.

## Known Limitations and Deferred Work

- **Listing is the Host's browse capability** — the tree only exists while a `browse` directory-picker backend is composed; a `native`-only composition serves no listings and the tree shows the same empty state as a workspace-less composition (the RPC reports `directory-picker-unavailable`).
- **Status dots need a git repository and the git binary** — the decoration scan degrades silently to no dots when the workspace is not inside a git repository, git is missing from the Host's PATH, or the scan times out; it is a decorative overlay, not a source-of-truth change list.
- **Files open the document tab, not an editor** — file rows route through `ui-conversation`'s `documentOpen` service, which pins the details panel's document tab to the path; the document panel shows the session's touched-file content, not a live filesystem read (see ui-document's limitations).
- **Hidden rows follow the POSIX dot convention** — the Host flags hidden entries by dot-prefix only (Windows hidden attributes are not read), so the toggle reveals exactly what the browse backend can see.
