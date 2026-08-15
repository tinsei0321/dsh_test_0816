/**
 * The document panel's viewing store: the reader mode (raw source with line
 * numbers, rendered reading view, or a rendered HTML artifact), persisted
 * across reloads. Module level exports the factory only (a module-level
 * handle would pin the store identity across plugin reloads); register()
 * receives the factory and the panel derives its PropsStore share from the
 * return type.
 */
import { defineStore } from '@deepseek-ai/dsh-client-runtime/client';
/**
 * Create the document panel viewing store handle.
 * @returns the store handle (spec + type + identity + factory in one).
 */
export function createDocumentViewStore() {
    return defineStore({
        init: () => ({ viewMode: 'source' }),
        persist: 'dsh.document.view.v1',
        actions: {
            setViewMode: (d, mode) => { d.viewMode = mode; },
        },
    });
}
//# sourceMappingURL=stores.js.map