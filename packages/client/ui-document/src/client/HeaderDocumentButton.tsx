// HeaderDocumentButton: the session header's file-review affordance (Codex
// style) — a quiet "Files · N" pill over the session's touched-file count. It
// appears once the session has read or mutated anything and opens the details
// column on the document tab through the cross-panel `documentOpen` service.

import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
import { deriveDocuments } from './documents.ts'
import css from './HeaderDocumentButton.module.css'

/** Injected business face: the panel-only open published through the service. */
export interface HeaderDocumentInjected {
  /** Open the details column on the document tab (no pinned file). */
  openPanel: () => void
}

/** Full props: the header-action runtime share, the injected face, and the locale seat. */
export type HeaderDocumentButtonProps = PropsRuntime<'conversation.session.header.actions'>
  & HeaderDocumentInjected & PropsLocale<'document'>

/**
 * The files pill: hidden while the session touched nothing, otherwise shows
 * the touched-file count and routes the click to the document tab.
 * @param props - runtime share, injected opener, and the locale seat.
 */
export function HeaderDocumentButton({ openPanel, useSession, t }: HeaderDocumentButtonProps) {
  const count = useSession(snapshot => deriveDocuments(snapshot).length)
  if (count === 0) return null
  return (
    <button
      type="button"
      className={css.pill}
      aria-label={t('document.headerLabel', { count: String(count) })}
      onClick={openPanel}
    >
      {t('document.header')} · {count}
    </button>
  )
}
