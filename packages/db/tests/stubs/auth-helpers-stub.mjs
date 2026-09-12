// Test stub for #layers/BaseAuth/server/utils/AuthHelpers. The real module
// pulls in the better-auth stack, which fires background queries outside any
// test scope. Services under test only need the key helpers and auth gate.
export function encryptKey(value) {
  return `enc:${value}`
}

export function decryptKey(value) {
  return typeof value === 'string' && value.startsWith('enc:') ? value.slice(4) : value
}

export async function checkUserIsLogin() {
  throw new Error('checkUserIsLogin is stubbed in service tests')
}
