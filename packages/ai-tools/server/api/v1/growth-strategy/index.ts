export default defineEventHandler(async (event) => {
    const query = getQuery(event)
    const page = parseInt(String(query.page ?? '1'))
    const limit = parseInt(String(query.limit ?? '10'))

    return {
        data: [],
        page,
        limit,
        total: 0,
    }
})
