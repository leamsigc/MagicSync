import { describe, it, before } from 'node:test'
import assert from 'node:assert/strict'

// T60.1 — versioned graph validation (pure, no database).
// Run: node --test --import ./tests/register-hook.mjs --import ./tests/globals.mjs tests/pipeline-graph.test.mjs

let validateWorkflowGraph
let linearizeGraph

function node(id, kind, extra = {}) {
  return { id, kind, name: id, position: { x: 0, y: 0 }, config: {}, ...extra }
}

function linearGraph() {
  return {
    schemaVersion: 1,
    nodes: [
      node('trigger', 'manual_trigger'),
      node('research', 'research'),
      node('write', 'write_post'),
      node('review', 'human_review'),
      node('publish', 'create_post'),
      node('end', 'terminal'),
    ],
    edges: [
      { id: 'e1', source: 'trigger', target: 'research' },
      { id: 'e2', source: 'research', target: 'write' },
      { id: 'e3', source: 'write', target: 'review' },
      { id: 'e4', source: 'review', target: 'publish' },
      { id: 'e5', source: 'publish', target: 'end' },
    ],
    policy: { requiresArtifactApproval: true, maxRetriesPerNode: 2, useBusinessContext: true },
  }
}

before(async () => {
  globalThis.useDrizzle = () => { throw new Error('no db needed') }
  const mod = await import('#layers/BaseDB/db/pipelines/workflow-graph.ts')
  validateWorkflowGraph = mod.validateWorkflowGraph
  linearizeGraph = mod.linearizeGraph
})

describe('workflow graph validation (T60.1)', () => {
  it('accepts a valid linear graph with order', () => {
    const result = validateWorkflowGraph(linearGraph())
    assert.equal(result.ok, true)
    assert.deepEqual(result.order, ['trigger', 'research', 'write', 'review', 'publish', 'end'])
  })

  it('rejects missing trigger and terminal', () => {
    const graph = linearGraph()
    graph.nodes = graph.nodes.filter(n => n.kind !== 'manual_trigger' && n.kind !== 'terminal')
    const result = validateWorkflowGraph(graph)
    assert.equal(result.ok, false)
    assert.ok(result.errors.some(e => e.includes('manual_trigger')))
    assert.ok(result.errors.some(e => e.includes('terminal')))
  })

  it('rejects duplicate triggers', () => {
    const graph = linearGraph()
    graph.nodes.push(node('trigger2', 'manual_trigger'))
    const result = validateWorkflowGraph(graph)
    assert.equal(result.ok, false)
  })

  it('rejects branching visibly', () => {
    const graph = linearGraph()
    graph.edges.push({ id: 'branch', source: 'research', target: 'review' })
    const result = validateWorkflowGraph(graph)
    assert.equal(result.ok, false)
    assert.ok(result.errors.some(e => e.includes('Branching')))
  })

  it('rejects cycles', () => {
    const graph = linearGraph()
    graph.edges.push({ id: 'cycle', source: 'publish', target: 'research' })
    const result = validateWorkflowGraph(graph)
    assert.equal(result.ok, false)
    assert.ok(result.errors.some(e => e.toLowerCase().includes('cycle') || e.includes('input')))
  })

  it('rejects disconnected nodes', () => {
    const graph = linearGraph()
    graph.nodes.push(node('orphan', 'write_post'))
    const result = validateWorkflowGraph(graph)
    assert.equal(result.ok, false)
    assert.ok(result.errors.some(e => e.includes('disconnected')))
  })

  it('rejects dangling edges', () => {
    const graph = linearGraph()
    graph.edges.push({ id: 'dangling', source: 'research', target: 'ghost' })
    const result = validateWorkflowGraph(graph)
    assert.equal(result.ok, false)
  })

  it('requires a review gate before actions', () => {
    const graph = linearGraph()
    graph.nodes = graph.nodes.filter(n => n.kind !== 'human_review')
    graph.edges = graph.edges.filter(e => e.source !== 'write' && e.target !== 'publish')
    graph.edges.push({ id: 'skip', source: 'write', target: 'publish' })
    const result = validateWorkflowGraph(graph)
    assert.equal(result.ok, false)
    assert.ok(result.errors.some(e => e.includes('human_review')))
  })

  it('rejects unknown node kinds', () => {
    const graph = linearGraph()
    graph.nodes.push({ id: 'weird', kind: 'teleport', name: 'weird', position: { x: 0, y: 0 }, config: {} })
    const result = validateWorkflowGraph(graph)
    assert.equal(result.ok, false)
  })

  it('linearizes without data loss', () => {
    const nodes = linearizeGraph(linearGraph())
    assert.ok(nodes)
    assert.deepEqual(nodes.map(n => n.id), ['trigger', 'research', 'write', 'review', 'publish', 'end'])
    assert.equal(linearizeGraph({ nodes: [], edges: [] }), null)
  })
})
