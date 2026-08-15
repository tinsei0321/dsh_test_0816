/**
 * Package-owned invariant companion for `@deepseek-ai/dsh-client-ui-project`.
 * @module @deepseek-ai/dsh-client-ui-project/invariant
 */

/* jscpd:ignore-start */
import type { Context } from '@deepseek-ai/cordis'
import type { InvariantInstaller } from '@deepseek-ai/dsh-invariants'

const PACKAGE_NAME = '@deepseek-ai/dsh-client-ui-project'

/** Cordis companion plugin name. */
export const name = 'client-ui-project-invariant'
/** Service required before the companion can reserve package ownership. */
export const inject = ['invariants']

/**
 * No runtime invariant: the slot registration and dictionaries are
 * effect-owned with disposal proven by their plugin specs; this package owns
 * no mutable state (the tree's loaded levels live in the declared viewing
 * store, whose lifecycle the slot framework owns).
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
