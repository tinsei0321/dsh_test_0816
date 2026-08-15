// TrajectoryTurnHeader: sticky per-turn bar with Input/Output/Think/Time labels
// and the turn's wall-clock span (Codex turn-duration fact).

import { formatCompactDurationMs } from './trajectory-record.ts'
import css from './TrajectoryTurnHeader.module.css'

const COLUMN_LABELS = ['Input', 'Output', 'Think', 'Time'] as const

export interface TrajectoryTurnHeaderProps {
  /** 1-based turn index shown as `Turn N`. */
  turn: number
  /** Turn wall-clock span in milliseconds; absent = no duration chip. */
  durationMs?: number | null
}

/**
 * Render the sticky turn header row.
 * @param props.turn - turn index.
 * @param props.durationMs - optional turn span.
 * @returns the sticky header element.
 */
export function TrajectoryTurnHeader({ turn, durationMs }: TrajectoryTurnHeaderProps) {
  const duration = durationMs === null || durationMs === undefined || !Number.isFinite(durationMs)
    ? null
    : formatCompactDurationMs(durationMs)
  return (
    <div className={css.root}>
      <div className={css.inner}>
        <span className={css.title}>
          Turn {turn}
          {duration !== null && <span className={css.duration}>{` · ${duration}`}</span>}
        </span>
        <div className={css.columns} aria-hidden="true">
          {COLUMN_LABELS.map(label => (
            <span key={label} className={css.column}>{label}</span>
          ))}
        </div>
      </div>
    </div>
  )
}
