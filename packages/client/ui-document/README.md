# @deepseek-ai/dsh-client-ui-document

English | [中文](README.zh.md)

The details panel's document half, Codex-style: an open-file tab strip (focus and close per tab, close-all) and the reader below it. The project directory tree is the frame's rightmost column (`frame.projectTree`, occupied by `ui-project`), so the project files and the focused document sit side by side — the tree at the far right edge. The reader shows the focused tab and toggles between source mode (numbered, syntax-highlighted lines), reading mode (rendered Markdown for `.md`/`.markdown` paths, plain text otherwise), and render mode (a sandboxed HTML iframe for `.html`/`.htm` artifacts) through the viewing store, which persists the mode across reloads. The browser half registers into the `conversation.details.document` seat declared by `ui-conversation`'s details entry; composing this plugin out of cordis.yml leaves the seat empty and the details panel's document tab renders nothing at zero cost.

The reader's content is derived from the public conversation snapshot (the top-level node list plus the running-call list) in one pure function, `deriveDocuments`: settled `read` results contribute their windowed lines, `diff` results and running diff calls contribute mutation hunks, and `search` path results contribute discovered-only entries. Per path, the reader shows the latest read window — or a created file's whole text synthesized from a whole-file change — followed by the session's mutation hunks in order. Entries sort newest-first by last activity, path as the stable tiebreak. While the agent runs, the panel follows its newest read/edit automatically; a manual tab click pauses following until the next turn starts. The panel's write paths are the owner currency (`onOpen`/`onClose`) and the declared viewing store (reader mode); the details panel's tabs and store are owned by `ui-conversation`. Tool rows and produced-file references elsewhere in the UI open files here through that package's `documentOpen` service.

The node half is an empty apply (the roster row); the plugin registers no prompt section, tool schema, or session event.

## Model Experience

None, as the package is a browser-side read-only projection of logged read/edit/search tool results and registers nothing model-facing.

#### KV Cache effect

The package adds no system-prompt section and no request content, so it has no effect on KV-cache reuse.

## Known Limitations and Deferred Work

- **Reader content derives from tool activity, not the filesystem** — the browser reads the session log, not the live file, so edits made after the last read render as diffs under the read content rather than being replayed into a current-file reconstruction; a future filesystem read seam could replace this with a live source view.
- **Persisted document tabs may go stale** — open tabs survive reloads while the entries only cover the loaded window; a stale tab renders the reader with the not-available hint instead of opening anything.
- **Path identity is case-sensitive** — the entries key by the path spelling the tool call used, so on Windows a file referenced with mixed-case variants appears as separate tabs. Normalizing case would guess wrong for case-sensitive filesystems; callers should reference one spelling.
