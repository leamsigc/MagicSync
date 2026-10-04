export const AI_KEY_MESSAGE =
  'AI provider rejected the request (missing or invalid API key). Add your key in Account → AI settings, or switch to a local Ollama model.'

export function isAuthFailure(detail: string): boolean {
  return (
    detail.includes('AI_AUTH_FAILED')
    || detail.includes('AuthenticationError')
    || detail.includes('API key not valid')
    || detail.includes('invalid_api_key')
    || detail.includes('Incorrect API key')
  )
}
