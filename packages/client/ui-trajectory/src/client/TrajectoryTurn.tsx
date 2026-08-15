// TrajectoryTurn: sticky Turn header plus the padded Message/Step body.

import type { ReactNode } from 'react'
import { TrajectoryTurnHeader } from './TrajectoryTurnHeader.tsx'
import css from './TrajectoryTurn.module.css'

export interface TrajectoryTurnProps {
  /** 1-based turn index for the sticky header. */
  turn: number
  /** Turn wall-clock span in milliseconds; absent = no duration chip. */
  durationMs?: number | null
  /** Message / Step headers and TrajectoryCell rows. */
  children?: ReactNode
}

/**
 * Render one turn section (sticky header + body).
 * @param props - turn index, optional span, and body children.
 * @returns the turn section element.
 */
export function TrajectoryTurn({ turn, durationMs, children }: TrajectoryTurnProps) {
  return (
    <section className={css.root} data-turn={turn}>
      {/* Optional props cannot carry an explicit undefined under
          exactOptionalPropertyTypes; null is the header's "no chip" value. */}
      <TrajectoryTurnHeader turn={turn} durationMs={durationMs ?? null} />
      <div className={css.body}>{children}</div>
    </section>
  )
}
