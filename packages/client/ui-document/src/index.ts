/**
 * Document plugin, node half. The roster row exists so the browser half (the
 * details panel's document tab) loads; there are no host-side registrations
 * and the plugin contributes nothing to the model's context. The browser half
 * ships via exports["./client"], discovered through the package.json
 * dsh.client declaration.
 */

import type { Context } from '@deepseek-ai/cordis'

/** No host services: this half only carries the browser roster row. */
export const inject = []

/**
 * Node half body — intentionally empty; see the module doc.
 * @param _ctx - unused host context.
 */
export function apply(_ctx: Context): void {}
