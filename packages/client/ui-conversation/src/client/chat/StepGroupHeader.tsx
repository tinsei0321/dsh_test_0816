/**
 * StepGroupHeader: the compact Codex-style step grouping header above the
 * first node of each Agent step in the chat flow. Pure presentational — the
 * step number, status dot, and localized state label all arrive via props;
 * the status maps onto the shared StateDot tri-state (ongoing / done / error).
 */
import type { StateDotState } from '@deepseek-ai/dsh-client-ui-primitives'
import { StateDot } from '@deepseek-ai/dsh-client-ui-primitives'
import type { ChatViewSlotProps } from '../contract/slots.ts'
import type { StepStatus } from './step-groups.ts'
import css from './ChatView.module.css'

/** Status dot state for one StepStatus. */
export function stepDotState(status: StepStatus): StateDotState {
  return status === 'running' ? 'ongoing' : status === 'error' ? 'error' : 'done'
}

/**
 * Render one step grouping header.
 * @param props - step identity, status, and the owning view's locale seat.
 */
export function StepGroupHeader({ step, status, t }: {
  step: number
  status: StepStatus
  t: ChatViewSlotProps['t']
}) {
  return (
    <div className={css.stepHeader} data-step-status={status}>
      <StateDot state={stepDotState(status)} size={8} />
      <span className={css.stepLabel}>{t('chat.step', { n: step })}</span>
      <span className={css.stepStatus}>{t(`chat.step.status.${status}`)}</span>
    </div>
  )
}
