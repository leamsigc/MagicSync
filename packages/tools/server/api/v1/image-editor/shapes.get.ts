import { SHAPE_CATALOG, SHAPE_CATEGORIES } from '../../../../shared/image-editor/shapes'

/** Shape pack for the editor Shapes panel and the MCP list-design-shapes tool. */
export default defineEventHandler(async (event) => {
  const log = useLogger(event)
  await checkUserIsLogin(event)
  log.set({ shapes: SHAPE_CATALOG.length })
  return {
    shapes: SHAPE_CATALOG,
    categories: SHAPE_CATEGORIES,
  }
})
