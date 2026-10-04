export interface ContentToolResult<T> {
  status: 'ready' | 'needs_review' | 'scheduled' | 'published'
  summary: string
  nextAction: string
  data: T
  warnings: string[]
}

export function contentToolResult<T>(result: Omit<ContentToolResult<T>, 'warnings'> & { warnings?: string[] }): ContentToolResult<T> {
  return {
    ...result,
    warnings: result.warnings ?? [],
  }
}
