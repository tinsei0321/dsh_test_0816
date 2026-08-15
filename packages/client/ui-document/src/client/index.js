/**
 * Document plugin, browser half. Registers the details panel's document half
 * into the `conversation.details.document` seat declared by ui-conversation,
 * and the session header's file-review pill (Files · N) into the header
 * action row. Composing this plugin out of cordis.yml leaves both surfaces
 * empty; the details panel's document tab then renders its fallback (nothing)
 * at zero cost.
 */
import { DocumentPanel } from "./DocumentPanel.js";
import { HeaderDocumentButton } from "./HeaderDocumentButton.js";
import { createDocumentViewStore } from "./stores.js";
import { en, NS, zh } from "./locales.js";
/** Services required by the two registrations and their dictionaries. */
export const inject = ['slots', 'locale'];
/**
 * Client plugin body: register the dictionaries, the document-half entry,
 * and the header file-review pill.
 * @param ctx - client root context.
 */
export function apply(ctx) {
    ctx.effect(() => ctx.locale.register(NS, { zh, en }), 'ui-document: dictionaries');
    ctx.slots.inject('conversation.details.document', () => ctx.slots.register({
        name: 'conversation.details.document',
        children: {
            'conversation.details.document.tree': { kind: 'single', scope: 'session' },
        },
        locale: NS,
        store: createDocumentViewStore(),
    }, DocumentPanel));
    ctx.slots.inject('conversation.session.header.actions', () => ctx.slots.register({
        name: 'conversation.session.header.actions',
        id: 'document-files',
        // After the subagent catalog and the jobs pill: reviewing produced
        // files is the post-work gesture.
        order: 30,
        locale: NS,
        inject: () => ({
            openPanel: () => { ctx.get('documentOpen')?.openPanel(); },
        }),
    }, HeaderDocumentButton));
}
//# sourceMappingURL=index.js.map