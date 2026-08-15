import type { PropsLocale, PropsRuntime } from '@deepseek-ai/dsh-client-ui-slots'
/** Injected business face: the panel-only open published through the service. */
export interface HeaderDocumentInjected {
  /** Open the details column on the document tab (no pinned file). */
  openPanel: () => void
}
/** Full props: the header-action runtime share, the injected face, and the locale seat. */
export type HeaderDocumentButtonProps = PropsRuntime<'conversation.session.header.actions'> & HeaderDocumentInjected & PropsLocale<'document'>
/**
 * The files pill: hidden while the session touched nothing, otherwise shows
 * the touched-file count and routes the click to the document tab.
 * @param props - runtime share, injected opener, and the locale seat.
 */
export declare function HeaderDocumentButton({ openPanel, useSession, t }: HeaderDocumentButtonProps): import('react').JSX.Element | null
//# sourceMappingURL=HeaderDocumentButton.d.ts.map
