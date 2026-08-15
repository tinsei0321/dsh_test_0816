// @vitest-environment jsdom
/** StepGroupHeader presentation: the localized Step label, the status line,
 *  and the status-to-StateDot mapping. User-visible assertions only. */

import { afterEach, describe, expect, it } from 'vitest'
import { cleanup, render, screen } from '@testing-library/react'
import { makeTranslate } from '@deepseek-ai/dsh-client-test-runtime'
import { zh as commonZh } from '@deepseek-ai/dsh-client-locale/src/locales/zh.ts'
import { StepGroupHeader, stepDotState } from '../src/client/chat/StepGroupHeader.tsx'
import { zh } from '../src/client/locales.ts'
import type { ChatViewSlotProps } from '../src/client/contract/slots.ts'

const t = makeTranslate(zh, commonZh) as ChatViewSlotProps['t']

afterEach(cleanup)

describe('stepDotState', () => {
  it('maps running to ongoing, completed to done, error to error', () => {
    expect(stepDotState('running')).toBe('ongoing')
    expect(stepDotState('completed')).toBe('done')
    expect(stepDotState('error')).toBe('error')
  })
})

describe('StepGroupHeader', () => {
  it('renders the localized step number and status text', () => {
    render(<StepGroupHeader step={3} status="running" t={t} />)
    expect(screen.getByText('步骤 3')).toBeTruthy()
    expect(screen.getByText('进行中')).toBeTruthy()
  })

  it('renders the completed and error states distinctly', () => {
    const { rerender } = render(<StepGroupHeader step={1} status="completed" t={t} />)
    expect(screen.getByText('已完成')).toBeTruthy()
    rerender(<StepGroupHeader step={1} status="error" t={t} />)
    expect(screen.getByText('出错')).toBeTruthy()
  })
})
