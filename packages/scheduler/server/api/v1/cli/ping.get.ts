export default defineEventHandler(async (event) => {
  return {
    apiKey: event.context.apiKey,
    path: event.path,
    middlewareOrder: 'if you see this, auth middleware ran before api-key middleware',
  }
})
