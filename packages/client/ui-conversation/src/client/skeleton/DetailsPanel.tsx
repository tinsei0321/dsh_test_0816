// DetailsPanel: close button + a two-tab strip (tool details | documents)
// over the column body. The tool tab shows the selected call's args and
// result — args as JSON, the result raw except for a terminal-card call, whose
// Output section is the command's terminal card. The document tab renders the
// 'conversation.details.document' child slot with the pinned path and this
// panel's store actions as the owner currency. Reads the
// selection from the shared chat
// store (conversation writes, this panel reads — the cross-registration
// share the store seat exists for) and derives the call material from the
// session snapshot — no data of its own.

import { Fragment, useCallback, useEffect, useRef } from 'react'
import { CodeBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { shallowEqual } from '@deepseek-ai/dsh-client-runtime/client'
import type { ConversationSnapshot, RunningToolCall, ToolCallBlock, ToolResultNode } from '@deepseek-ai/dsh-client-runtime/client'
import type { DetailsSlotProps } from '../contract/slots.ts'
import { findToolCall } from '../chat/tool-node-reader.ts'
import css from './DetailsPanel.module.css'

/** Full props composed by reference from the contract (automatic shares & injected share). */
export type DetailsPanelProps = DetailsSlotProps

/**
 * Selected call material: the call's display name and args plus the frozen
 * block slice it came from. `block` is a snapshot-cached reference, so the
 * wrapper stays shallow-equal across unrelated snapshot frames; the settled /
 * running split is read off it with the `'kind' in block` discrimination
 * instead of duplicated as flags.
 */
interface CallMaterial {
  name: string
  argsRaw: string | null
  block: ToolCallBlock
}

/** Material of a settled result node (native call or run_code sub-dispatch). */
function settledMaterial(node: ToolResultNode, callId: string): CallMaterial {
  return { name: node.call?.name ?? callId, argsRaw: node.call?.argsRaw ?? null, block: node }
}

/** Material of an in-flight call (native call or run_code sub-dispatch). */
function runningMaterial(call: RunningToolCall): CallMaterial {
  return { name: call.name, argsRaw: call.argsRaw, block: call }
}

function materialFor(s: ConversationSnapshot, callId: string): CallMaterial | null {
  const found = findToolCall(s, callId)
  if (found === undefined) return null
  return 'kind' in found ? settledMaterial(found, callId) : runningMaterial(found)
}

function pretty(raw: string): string {
  try {
    return JSON.stringify(JSON.parse(raw), null, 2)
  } catch {
    // Not JSON (streaming fragment or plain text): show verbatim.
    return raw
  }
}

/** Flatten a settled result for the no-ui-tool fallback. */
function rawResultText(block: ToolCallBlock): string {
  if (!('kind' in block)) return ''
  const parts = block.content.map(item => item.type === 'text' ? item.text : JSON.stringify(item, null, 2))
  if (parts.length === 0 && block.error !== undefined) parts.push(`${block.error.name}: ${block.error.code}`)
  return parts.join('\n')
}

/** The details panel's two halves. */
type DetailsTab = 'tool' | 'document'

export function DetailsPanel({
  useSession, useSessions, sessionId, useStore, actions, renderSlot, closeDetails, openDocument, openDocumentPanel, useDocOpenRequest, t,
}: DetailsPanelProps) {
  // Per-fact selectors: the shared chat store also carries the composer draft,
  // which must not re-render the details panel on every keystroke.
  const selection = useStore(s => s.selection)
  const detailsTab = useStore(s => s.detailsTab)
  const openDocs = useStore(s => s.openDocs)
  const activeDoc = useStore(s => s.activeDoc)
  // Session workspace root: an omitted or relative terminal cwd resolves
  // against it, which the pure presenter cannot see.
  const sessionCwd = useSessions(list => list.byId[sessionId]?.cwd)
  const callId = selection?.callId
  // materialFor builds a fresh wrapper; shallowEqual short-circuits on its
  // stable members (result node reference rides the snapshot's structural sharing).
  const material = useSession(
    s => (callId === undefined ? null : materialFor(s, callId)),
    (a, b) => shallowEqual(a, b))

  // Cross-panel opens (tool rows / file links publish through the documentOpen
  // service): every fresh request opens the column, pinning the path or
  // showing the document tab alone (a null-path panel request).
  const request = useDocOpenRequest(s => s)
  const handledToken = useRef(0)
  useEffect(() => {
    if (request === null || request.token === handledToken.current) return
    handledToken.current = request.token
    if (request.path === null) openDocumentPanel()
    else openDocument(request.path)
  }, [request, openDocument, openDocumentPanel])

  // Persisted snapshots from before the two-panel split rehydrate without
  // these fields; the tool tab is the stable default.
  const tab: DetailsTab = detailsTab ?? 'tool'
  const docs = openDocs ?? []
  const doc = activeDoc ?? null

  // The document child slot's complete write surface: open appends/focuses a
  // tab and keeps the document tab; close removes the tab (the store returns
  // the panel to the tool half when the last tab closes).
  const onOpenDocument = useCallback((path: string) => { actions.openDocument(path) }, [actions])
  const onCloseDocument = useCallback((path: string) => { actions.closeDocument(path) }, [actions])

  return (
    <div className={css.root}>
      <div className={css.header}>
        <div className={css.title}>
          {tab === 'document'
            ? t('details.tab.document')
            : selection === null ? t('details.title') : material?.name ?? selection.toolName ?? t('details.title')}
        </div>
        <button
          type="button" className={css.close} aria-label={t('details.close')}
          onClick={() => { closeDetails() }}
        >
          <svg viewBox="0 0 16 16" width="14" height="14" aria-hidden>
            <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
          </svg>
        </button>
      </div>
      <div className={css.tabs} role="tablist" aria-label={t('details.title')}>
        <button
          type="button" role="tab" aria-selected={tab === 'tool'}
          className={tab === 'tool' ? css.tabActive : css.tab}
          onClick={() => { actions.setDetailsTab('tool') }}
        >
          {t('details.tab.tool')}
        </button>
        <button
          type="button" role="tab" aria-selected={tab === 'document'}
          className={tab === 'document' ? css.tabActive : css.tab}
          onClick={() => { actions.setDetailsTab('document') }}
        >
          {t('details.tab.document')}
        </button>
      </div>
      <div className={css.body} role="tabpanel">
        {tab === 'document'
          ? (
            <Fragment key="document">
              {renderSlot('conversation.details.document', {
                docs,
                doc,
                onOpen: onOpenDocument,
                onClose: onCloseDocument,
                cwd: sessionCwd,
              })}
            </Fragment>
          )
          : selection === null || callId === undefined
            ? <div className={css.empty}>{t('details.empty')}</div>
            : material === null
              ? <div className={css.empty}>{t('details.notInWindow')}</div>
              : (
                <>
                  {material.argsRaw !== null && (
                    <section className={css.section}>
                      <div className={css.sectionLabel}>{t('details.input')}</div>
                      <CodeBlock code={pretty(material.argsRaw)} lang="json" copyLabel={t('copy')} copiedLabel={t('copied')} />
                    </section>
                  )}
                  <section className={css.section}>
                    <div className={css.sectionLabel}>{t('details.output')}</div>
                    {/* Keyed by the selected call: the body owns per-call view
                        state (the terminal card's expand and copy), which React
                        would otherwise carry into the next selection because the
                        panel does not unmount between calls. */}
                    <Fragment key={callId}>
                      {renderSlot('conversation.details.tool', { block: material.block, cwd: sessionCwd }, {
                        fallback: 'kind' in material.block
                          ? (
                            <pre className={css.code} data-error={material.block.isError || undefined}>
                              {rawResultText(material.block)}
                            </pre>
                          )
                          : <div className={css.empty}>{t('details.running')}</div>,
                      })}
                    </Fragment>
                  </section>
                </>
              )}
      </div>
    </div>
  )
}
