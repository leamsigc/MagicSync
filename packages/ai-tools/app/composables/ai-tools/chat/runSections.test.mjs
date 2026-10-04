import { describe, it } from 'node:test'
import assert from 'node:assert/strict'
import { sectionKindOf, groupSections, railSteps } from './runSections.ts'

/**
 * T23 RunCard data helpers: section grouping + step rail from real statuses.
 * Pure logic, no framework — the same module the card components import.
 */

const call = (overrides = {}) => ({ id: 'c1', name: 'web_search', ...overrides })

describe('sectionKindOf (T23)', () => {
  it('routes payload shapes ahead of tool names', () => {
    assert.equal(sectionKindOf('unknown_tool', JSON.stringify({ slides: [] })), 'carousel')
    assert.equal(sectionKindOf('unknown_tool', JSON.stringify({ ideas: [] })), 'ideas')
    assert.equal(sectionKindOf('unknown_tool', JSON.stringify({ hooks: [] })), 'ideas')
    assert.equal(sectionKindOf('unknown_tool', JSON.stringify({ caption: 'hi' })), 'draft')
    assert.equal(sectionKindOf('unknown_tool', JSON.stringify({ brief: 'b' })), 'research')
    assert.equal(sectionKindOf('unknown_tool', JSON.stringify({ cards: [] })), 'board')
  })

  it('falls back to tool-name groups, then delivery', () => {
    assert.equal(sectionKindOf('generate_carousel'), 'carousel')
    assert.equal(sectionKindOf('revise_carousel'), 'carousel')
    assert.equal(sectionKindOf('write_post'), 'draft')
    assert.equal(sectionKindOf('revise_draft'), 'draft')
    assert.equal(sectionKindOf('research_topic'), 'research')
    assert.equal(sectionKindOf('scan_trends'), 'research')
    assert.equal(sectionKindOf('board_move'), 'board')
    assert.equal(sectionKindOf('subagent'), 'board')
    assert.equal(sectionKindOf('schedule_post'), 'delivery')
    assert.equal(sectionKindOf('publish_now', 'not json'), 'delivery')
  })
})

describe('groupSections (T23)', () => {
  it('groups one run into at most one section per kind, in rail order', () => {
    const sections = groupSections([
      call({ id: 'a', name: 'schedule_post', result: '{}' }),
      call({ id: 'b', name: 'web_search', result: JSON.stringify({ brief: 'b' }) }),
      call({ id: 'c', name: 'scrape_url', result: JSON.stringify({ results: [] }) }),
      call({ id: 'd', name: 'write_post', result: JSON.stringify({ caption: 'c' }) }),
    ])
    assert.deepEqual(sections.map(s => s.kind), ['research', 'draft', 'delivery'])
    assert.equal(sections[0].calls.length, 2, 'both research calls share one section')
  })

  it('returns no sections for a run without tool calls', () => {
    assert.deepEqual(groupSections([]), [])
  })
})

describe('railSteps (T23)', () => {
  it('derives real statuses from tool calls without an envelope', () => {
    const steps = railSteps(undefined, [
      call({ id: 'a', name: 'web_search', result: '{"brief":"b"}' }),
      call({ id: 'b', name: 'write_post', error: 'boom' }),
      call({ id: 'c', name: 'board_move' }),
    ])
    assert.deepEqual(steps.map(s => s.status), ['done', 'failed', 'running'])
    assert.equal(steps[0].label, 'Web search')
  })

  it('prefers envelope steps and highlights the first open one', () => {
    const run = {
      id: 'r1',
      capability: 'goal.execute',
      title: 'Get customers',
      completed: false,
      steps: [
        { id: 's1', label: 'Research', status: 'done' },
        { id: 's2', label: 'Plan', status: 'todo' },
        { id: 's3', label: 'Next', status: 'todo' },
      ],
    }
    const steps = railSteps(run, [call({ id: 'x', name: 'web_search', result: '{}' })])
    assert.deepEqual(steps.map(s => s.status), ['done', 'active', 'todo'])
    assert.deepEqual(steps.map(s => s.label), ['Research', 'Plan', 'Next'])
  })

  it('keeps failed envelope steps failed instead of highlighting them', () => {
    const run = {
      id: 'r1',
      completed: false,
      steps: [
        { id: 's1', label: 'Research', status: 'failed' },
        { id: 's2', label: 'Plan', status: 'todo' },
      ],
    }
    assert.deepEqual(railSteps(run, []).map(s => s.status), ['failed', 'active'])
  })
})
