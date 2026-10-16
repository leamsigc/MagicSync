/**
 * Fixtures for routes whose interactions run through the branded-AI capability
 * layer.
 *
 * Every capability built with `useBusinessContext: true` (content update, delete,
 * move, write, scan…) refuses with **500 `BRAND_CONTEXT_REQUIRED` — "Publish a
 * Brand Playbook to enable branded AI"** until the business has a published
 * Brand Playbook. `createActiveBusiness()` alone is therefore not enough to
 * drive the content board past its first interaction.
 *
 * `BrandPlaybookSchema` is fully defaulted, so an empty draft validates and
 * publishing needs no AI provider. This publishes the minimum viable playbook.
 */
import type { APIRequestContext } from '@playwright/test'
import type { TestUser } from './e2e-utils'

/** Publish a minimal Brand Playbook so branded-AI capabilities stop 500ing. */
export async function publishBrandPlaybook(
  request: APIRequestContext,
  user: TestUser,
  businessId: string,
): Promise<void> {
  const cookies = { [user.sessionCookie.name]: user.sessionCookie.value }

  const draft = await request.put(`/api/v1/business/${businessId}/playbook/draft`, {
    cookies,
    data: {},
  })
  if (!draft.ok()) {
    throw new Error(`playbook draft failed (${draft.status()}): ${await draft.text()}`)
  }

  const editionId = (await draft.json())?.data?.id as string | undefined
  if (!editionId) throw new Error('playbook draft returned no edition id')

  const publish = await request.post(`/api/v1/business/${businessId}/playbook/publish`, {
    cookies,
    data: { editionId },
  })
  if (!publish.ok()) {
    throw new Error(`playbook publish failed (${publish.status()}): ${await publish.text()}`)
  }
}
