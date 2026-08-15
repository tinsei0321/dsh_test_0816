# Agent Note: Codex-style workbench UI

Status: implemented

English | [中文](2026-08-15-codex-workbench-ui.zh.md)

## Problem

The web GUI shipped a three-region frame (workspace sidebar, conversation, details), but a Codex-style workbench needs more of the project on screen: a resident directory tree, a file viewer that follows what the agent reads and edits, turns grouped as numbered steps, and the Codex dark palette. The gap was presentational plus one host capability: listing directory entries for arbitrary workspace paths over the wire, which the existing modal directory picker never exposed.

## Decision

**One browse-only host RPC carries directory data.** `host.listTreeEntries` is declared as a Service Definition in `dsh-host-directory-picker`, implemented by `dsh-host-directory-picker-browse` with streaming `opendir` scans, mirrored as wire types in `dsh-host-apiproxy` `api/host.ts` (hand-copied to keep the browser-safe import surface, fenced for the clone gate), and re-exported through `dsh-api-remotes` and `dsh-client-connection` into the `IWorkspaces` client contract. Tree listings are browse state: they never enter the session log, because the model does not see them.

**Two new client plugins own the new columns.** `dsh-client-ui-project` renders the project tree in the new `frame.projectTree` slot: lazy per-level loading with `AbortController` cancellation, a hidden-files toggle, truncated-entry markers, and a 32px collapsed rail. `dsh-client-ui-document` renders the file viewer: open-file tabs with neighbor refocus, source / read / rendered modes, a `sandbox=""` iframe for arbitrary model-produced HTML, and auto-follow of the agent's latest read or edit that a manual click pauses until the next turn. `ui-layout` gained the fourth column through its existing column-concession chain, and the details panel gained a Documents tab beside Tool details.

**Conversation turns are grouped as steps.** `step-groups.ts` derives step rows from the trajectory in a pure two-pass function and `StepGroupHeader` renders running / completed / error states; tool rows carry duration chips and the approval card shows waiting and decided states with `aria-live` announcements.

**The Codex look is token aliasing, not a ported stylesheet.** `codex-theme.css` re-points existing `--dsw` semantic aliases to the Codex dark palette and is imported once by the shell's `base.css`; no token is renamed and no Codex brand asset is copied.

**The served index must not be heuristic-cached.** `dsh-host-frontend-static` sends `cache-control: no-store` for the boot index because the bundle rev list it embeds changes every build and a stale index pins old plugin revs.

## Testing

Package specs cover the new derivation and components (`step-groups`, `StepGroupHeader`, `ui-project`, `ui-document`, the widened `IWorkspaces` seam), and the frame-level goldens in `apps/web/tests/snapshots/lifecycle-chrome/` were refreshed so replay stays the assembled-app evidence, per the [browser e2e lane](../testing/2026-07-24-web-gui-browser-e2e-lane.md).

## Alternatives considered

**Render the tree from the existing modal picker's provider without a new RPC.** Rejected because the picker serves one-shot workspace selection; a resident tree needs incremental per-level listing with cancellation, and the picker exposed no wire-safe host method for arbitrary paths.

**Host the project tree inside `ui-workspace` on the left.** Rejected because the product places the tree opposite the conversation; the `frame.projectTree` slot keeps placement a composition concern instead of embedding it in a sidebar package.

**Log tree listings as session events.** Rejected because directory browsing is interface state the model never sees; logging it would bloat every session log while the model-visible rule binds only the other direction.

**Port Codex's own stylesheet.** Rejected because it copies brand presentation and breaks on upstream redesigns; alias-level theming keeps one token vocabulary and one theme runtime.

## Consequences

The frame is four columns; narrow viewports collapse the project tree to its rail. The `apiproxy` wire mirror must track the directory-picker Service Definition by hand — the clone fence makes drift visible but cannot prevent it. Directory data stays out of session logs and model context, so the viewer's auto-follow consumes the same RPC as the tree. Deferred with intent: directory watch push, five-state approval badges, and per-hunk review staging.
