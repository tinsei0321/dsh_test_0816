import { jsxs as _jsxs } from "react/jsx-runtime";
import { deriveDocuments } from "./documents.js";
import css from './HeaderDocumentButton.module.css';
/**
 * The files pill: hidden while the session touched nothing, otherwise shows
 * the touched-file count and routes the click to the document tab.
 * @param props - runtime share, injected opener, and the locale seat.
 */
export function HeaderDocumentButton({ openPanel, useSession, t }) {
    const count = useSession(snapshot => deriveDocuments(snapshot).length);
    if (count === 0)
        return null;
    return (_jsxs("button", { type: "button", className: css.pill, "aria-label": t('document.headerLabel', { count: String(count) }), onClick: openPanel, children: [t('document.header'), " \u00B7 ", count] }));
}
//# sourceMappingURL=HeaderDocumentButton.js.map