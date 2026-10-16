/**
 * Journey registry — the interaction inventory.
 *
 * A journey is an ordered, re-runnable walkthrough of one route's interactions.
 * Each step is captured as `packages/doc/public/img/screenshots/<route-slug>/NN-<step>.png`,
 * and re-running overwrites each step in place.
 *
 * Step IDs mirror the sub-feature IDs in the feature map
 * (`.cursor/skills/verify-magicsync/features/`), so the images line up with the
 * documented inventory of what a feature actually does.
 *
 * Add one file per feature and register it below. Coverage grows by authoring —
 * nothing here is auto-discovered, because only an authored drive knows what a
 * click is *supposed* to produce.
 */
import type {
  TestBusiness,
  TestUser,
} from '../../e2e/helpers/e2e-utils'
import type { APIRequestContext, Page } from '@playwright/test'
import type { Journey } from '../../e2e/helpers/route-screenshots'
import { businessCreateJourney } from './business-create'
import { contentBoardJourney } from './content-board'

export interface JourneyContext {
  page: Page
  /** For fixtures the journey needs before it can drive anything. */
  authed: APIRequestContext
  user: TestUser
  business: TestBusiness
  baseURL: string
  /** The ordered capture handle. Use `ctx.journey.step(id, run?)`. */
  journey: Journey
}

export interface JourneyDefinition {
  /** Stable key, used by `SCREENSHOT_FEATURE` to run one journey. */
  key: string
  /** One line describing the walkthrough. */
  title: string
  /** Stable route pattern — the folder every step is written into. */
  route: string
  /** The feature map file this journey covers. */
  featureDoc: string
  /**
   * State the route needs before it will respond — e.g. a published Brand
   * Playbook, a connected account. Documented so a red run is diagnosable.
   */
  preconditions: string[]
  /** Declared step IDs, in order. Verified against what `run` actually captured. */
  steps: string[]
  /** Interactions deliberately not covered, and why. */
  notCovered?: string[]
  /** Prepare fixtures. Not captured. Runs before `run`. */
  setup?(ctx: JourneyContext): Promise<void>
  /** Drive the route and capture each step through `ctx.journey.step`. */
  run(ctx: JourneyContext): Promise<void>
}

export const journeys: JourneyDefinition[] = [contentBoardJourney, businessCreateJourney]
