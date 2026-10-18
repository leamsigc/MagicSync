/**
 * Shared `evlog` log-redaction config for every layer's Nuxt module options.
 *
 * User avatars are stored as base64 data URIs. Better Auth puts the `user` and
 * `session` objects into the request log context, so without this every log line
 * copies the full base64 image — which blows past the platform's 5 MB log cap
 * and buries the fields that actually matter.
 *
 * `patterns` catches any base64 data URI anywhere in the event (whatever the
 * field is called); `paths` catches the known image fields regardless of shape.
 * Built-in PII redaction stays on (the option only overrides the object).
 */
export const evlogRedact = {
  paths: ['**.image', '**.avatar', '**.picture', '**.base64', '**.dataUrl', '**.dataUri'],
  patterns: [/data:[\w.+-]+\/[\w.+-]+;base64,[A-Za-z0-9+/=]+/g],
}
