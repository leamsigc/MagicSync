/**
 * Chat operator journey — the conversational surface, end to end.
 *
 * The first three steps are deterministic. `chat-run` and `chat-draft-composer`
 * call the agent runtime (provider keys required) and are given long waits;
 * without keys they are the only steps that fail. Step IDs come from
 * `.cursor/skills/verify-magicsync/features/chat.md`.
 */
import { expect } from '@playwright/test'
import { publishBrandPlaybook } from '../../e2e/helpers/content-fixtures'
import { waitForHydration } from '../../e2e/helpers/e2e-utils'
import type { JourneyContext, JourneyDefinition } from './index'

const ROUTE = '/app/chat'

export const chatJourney: JourneyDefinition = {
  key: 'chat',
  title: 'Chat operator — tools, a run, and the inline composer',
  route: ROUTE,
  featureDoc: '.cursor/skills/verify-magicsync/features/chat.md',
  preconditions: [
    'An active business owned by the fixture user.',
    'A published Brand Playbook — the content capabilities need one.',
    'AI provider keys for the run and composer steps.',
  ],
  notCovered: [
    'Carousel generation/revision — needs AI keys and an existing carousel.',
    'chat-draft-composer — the write chain depends on the research agent and non-deterministic tool-calling; a manual run proved board_list executes and renders a run card (app-chat/04-chat-run.png) but the composer hand-off was not reproducible.',
  ],
  steps: ['chat-open', 'chat-tools', 'chat-message', 'chat-reply'],

  async setup({ authed, user, business }: JourneyContext) {
    await publishBrandPlaybook(authed, user, business.id)
  },

  async run({ page, baseURL, journey }: JourneyContext) {
    await page.goto(`${baseURL}${ROUTE}`)
    await waitForHydration(page)
    await expect(page.getByTestId('chat-input')).toBeVisible({ timeout: 60000 })

    await journey.step('chat-open')

    await journey.step('chat-tools', async () => {
      await page.getByTestId('chat-options-toggle').click()
      await expect(page.getByRole('dialog').first()).toBeVisible({ timeout: 15000 })
    })

    await page.keyboard.press('Escape')

    await journey.step('chat-message', async () => {
      await page.getByTestId('chat-input').fill('List my content board cards.')
      await expect(page.getByTestId('chat-input')).toHaveValue('List my content board cards.')
    })

    await journey.step('chat-reply', async () => {
      await page.getByTestId('chat-send').click()
      // Assert the assistant answered (a run card only appears when the model
      // calls a tool, which is model-dependent).
      await expect(page.locator('.chat-markdown').first()).toBeVisible({ timeout: 180000 })
    })
  },
}
