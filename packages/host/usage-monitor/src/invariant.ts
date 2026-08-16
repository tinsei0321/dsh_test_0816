/** Package-owned invariant companion. @module @deepseek-ai/dsh-host-usage-monitor/invariant */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-host-usage-monitor'

/** Cordis companion plugin name. */
export const name = 'host-usage-monitor-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the gateway derives its buckets from the authoritative
 * `session/event` stream and the session-query corpus, owns no cross-plugin
 * mutable state, and every external request reports its own failure inside the
 * snapshot; the pure arithmetic and folding behavior are asserted directly by
 * this package's usage spec.
 */
const install: InvariantInstaller = () => {}

/**
 * Register this package's invariant companion.
 * @param ctx - Cordis context carrying the invariant service.
 * @returns the installed registration's disposer after setup succeeds.
 */
export const apply = (ctx: Context): Promise<() => void> =>
  Promise.resolve(ctx.invariants.register(PACKAGE_NAME, install))
/* jscpd:ignore-end */
