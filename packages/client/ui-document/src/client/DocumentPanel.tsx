// DocumentPanel: the details column's document half, Codex file-viewer style.
// An open-file tab strip on top (each tab focuses/closes through the owner
// currency); under it the reader: the latest read window (or a created
// file's whole text) plus the session's mutation hunks. The project
// directory tree is the frame's rightmost column (ui-project, ui-layout's
// `frame.projectTree` slot), so the reader and the tree sit side by side.
// The reader toggles between source mode (numbered, syntax-highlighted
// lines), reading mode (rendered Markdown for .md files), and render mode
// (sandboxed HTML for .html artifacts). While the agent runs, the panel
// follows its latest read/edit automatically; a manual tab click pauses
// following until the next turn starts. Pure presenter: all writes go
// through the owner currency (`onOpen`/`onClose`) and the declared viewing
// store (mode).

import { useEffect, useMemo, useRef } from 'react'
import type { ConversationSnapshot } from '@deepseek-ai/dsh-client-runtime/client'
import type { PropsLocale, PropsRuntime, PropsStore } from '@deepseek-ai/dsh-client-ui-slots'
import { DiffBlock, MarkdownText, ReadBlock } from '@deepseek-ai/dsh-client-ui-primitives'
import { deriveDocuments, displayPath } from './documents.ts'
import type { DocumentContent, DocumentEntry } from './documents.ts'
import { createDocumentViewStore, type DocumentViewMode } from './stores.ts'
import css from './DocumentPanel.module.css'

export { displayPath } from './documents.ts'

/** Full props: the details panel's document owner currency, the viewing store, plus the locale seat. */
export type DocumentPanelProps =
  & PropsRuntime<'conversation.details.document'>
  & PropsStore<ReturnType<typeof createDocumentViewStore>>
  & PropsLocale<'document'>

/**
 * Whether the reader's reading mode renders Markdown for this path.
 * @param path - the file path to classify.
 * @returns true for Markdown extensions.
 */
export function isMarkdownPath(path: string): boolean {
  return /\.(md|markdown)$/i.test(path)
}

/**
 * Whether the reader offers the HTML render mode (Codex artifact preview).
 * @param path - the file path to classify.
 * @returns true for HTML extensions.
 */
export function isHtmlPath(path: string): boolean {
  return /\.(html?)$/i.test(path)
}

/** The full text of a read window or synthesized create, as one string. */
function contentText(content: DocumentContent): string {
  return content.lines.map(line => line.text).join('\n')
}

/**
 * The reader body for the focused entry under the given mode: source is the
 * numbered read window; reading renders Markdown for .md paths and a plain
 * pre block otherwise; render shows the HTML artifact in a sandboxed iframe.
 * @param props - full panel props (store carries the mode).
 */
function ReaderBody({
  path, content, changes, mode, t,
}: {
  path: string
  content: DocumentContent | null
  changes: DocumentEntry['changes']
  mode: DocumentViewMode
  t: DocumentPanelProps['t']
}) {
  if (content === null) {
    return <div className={css.empty}>{t('document.notFound')}</div>
  }
  return (
    <>
      {mode === 'source'
        ? (
          <ReadBlock
            lines={content.lines}
            totalLines={content.totalLines}
            lang={content.lang}
            maxLines={40}
          />
        )
        : mode === 'render'
          ? (
            // Fully sandboxed (no script execution): arbitrary model-produced
            // HTML renders its markup/CSS but cannot touch the app.
            <iframe
              className={css.renderFrame}
              title={t('document.mode.render')}
              sandbox=""
              srcDoc={contentText(content)}
            />
          )
          : isMarkdownPath(path)
            ? (
              <div className={css.readingMarkdown}>
                <MarkdownText text={contentText(content)} />
              </div>
            )
            : <pre className={css.readingPlain}>{contentText(content)}</pre>}
      {changes.length > 0 && (
        <section className={css.changes}>
          <div className={css.changesLabel}>{t('document.changes')}</div>
          <DiffBlock diffs={changes} />
        </section>
      )}
    </>
  )
}

/**
 * The document half of the details panel (see module doc).
 * @param props - the panel owner currency, the viewing store, and the locale seat.
 * @returns the document tab UI.
 */
export function DocumentPanel(props: DocumentPanelProps) {
  const {
    docs, doc, onOpen, onClose, cwd, useSession, useStore, actions, t,
  } = props
  const snapshot = useSession((s: ConversationSnapshot) => s)
  const viewMode = useStore(s => s.viewMode)
  const entries = useMemo(() => deriveDocuments(snapshot), [snapshot])
  const latest = entries[0] ?? null
  const current = doc === null ? null : entries.find(entry => entry.path === doc) ?? null

  // Auto-follow: while the agent runs, the panel follows its newest
  // read/edit; a manual tab click pauses following until the next turn (the
  // running edge) starts.
  const manualOverride = useRef(false)
  const wasRunning = useRef(snapshot.running)
  useEffect(() => {
    const running = snapshot.running
    if (running && !wasRunning.current) manualOverride.current = false
    wasRunning.current = running
    if (running && !manualOverride.current && latest !== null && doc !== latest.path) {
      onOpen(latest.path)
    }
  }, [snapshot, latest, doc, onOpen])

  return (
    <div className={css.root}>
      {entries.length === 0
        ? <div className={css.empty}>{t('document.empty')}</div>
        : (
          <>
            {docs.length > 0 && (
              <div className={css.tabRow}>
                <div className={css.tabStrip} role="tablist" aria-label={t('document.list')}>
                  {docs.map(path => (
                    <div key={path} className={path === doc ? css.fileTabActive : css.fileTab}>
                      <button
                        type="button" role="tab" aria-selected={path === doc}
                        className={css.fileTabButton}
                        title={path}
                        onClick={() => {
                          manualOverride.current = true
                          onOpen(path)
                        }}
                      >
                        {displayPath(path, cwd)}
                      </button>
                      <button
                        type="button" className={css.fileTabClose} aria-label={t('document.closeTab', { name: displayPath(path, cwd) })}
                        onClick={() => { onClose(path) }}
                      >
                        <svg viewBox="0 0 16 16" width="12" height="12" aria-hidden>
                          <path d="M4 4l8 8M12 4l-8 8" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" />
                        </svg>
                      </button>
                    </div>
                  ))}
                </div>
                {docs.length > 1 && (
                  <button
                    type="button"
                    className={css.closeAll}
                    aria-label={t('document.closeAll')}
                    onClick={() => {
                      manualOverride.current = true
                      for (const path of [...docs]) onClose(path)
                    }}
                  >
                    {t('document.closeAll')}
                  </button>
                )}
              </div>
            )}
            <div className={css.viewer}>
              {current === null
                ? <div className={css.empty}>{t('document.emptyDoc')}</div>
                : (
                  <>
                    <div className={css.docHeader}>
                      <span className={css.docPath} title={current.path}>{displayPath(current.path, cwd)}</span>
                      <div className={css.modeSwitch} role="group" aria-label={t('document.mode.label')}>
                        <button
                          type="button"
                          className={viewMode === 'source' ? css.modeButtonActive : css.modeButton}
                          aria-pressed={viewMode === 'source'}
                          onClick={() => { actions.setViewMode('source') }}
                        >
                          {t('document.mode.source')}
                        </button>
                        <button
                          type="button"
                          className={viewMode === 'reading' ? css.modeButtonActive : css.modeButton}
                          aria-pressed={viewMode === 'reading'}
                          onClick={() => { actions.setViewMode('reading') }}
                        >
                          {t('document.mode.reading')}
                        </button>
                        {isHtmlPath(current.path) && (
                          <button
                            type="button"
                            className={viewMode === 'render' ? css.modeButtonActive : css.modeButton}
                            aria-pressed={viewMode === 'render'}
                            onClick={() => { actions.setViewMode('render') }}
                          >
                            {t('document.mode.render')}
                          </button>
                        )}
                      </div>
                    </div>
                    <div className={css.docBody}>
                      <ReaderBody
                        path={current.path}
                        content={current.content}
                        changes={current.changes}
                        mode={viewMode}
                        t={t}
                      />
                    </div>
                  </>
                )}
            </div>
          </>
        )}
    </div>
  )
}
