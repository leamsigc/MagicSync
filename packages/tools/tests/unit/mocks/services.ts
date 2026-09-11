import { vi } from 'vitest'

// Controllable stand-ins for the DB-backed singletons the MCP tools and the
// export orchestrator call. Tests set implementations per case.
export const carouselMock = {
  upsert: vi.fn(),
  getForUser: vi.fn(),
  listForUser: vi.fn(),
  remove: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
}

export const boardMock = {
  upsert: vi.fn(),
  getForUser: vi.fn(),
  listForUser: vi.fn(),
  remove: vi.fn(),
  publish: vi.fn(),
  unpublish: vi.fn(),
}

export const postMock = {
  create: vi.fn(),
}

export const assetMock = {
  create: vi.fn(),
}

export const carouselService = carouselMock
export const menuBoardService = boardMock
export const postService = postMock
export const assetService = assetMock
