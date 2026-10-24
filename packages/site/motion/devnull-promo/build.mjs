/**
 * Full build for the dev-null.sh promo video.
 *
 *   node motion/devnull-promo/build.mjs            # capture → audio → mux
 *   node motion/devnull-promo/build.mjs --no-capture  # re-mux only
 *
 * Outputs (in packages/doc/public/video/):
 *   magicsync-dev-null-sh.mp4          1080p master, h264 + aac
 *   magicsync-dev-null-sh-720p.mp4     web-sized copy
 *   magicsync-dev-null-sh.poster.png   poster frame for the wiki page
 */
import { spawn, spawnSync } from 'node:child_process'
import { fileURLToPath } from 'node:url'
import { dirname, join, resolve } from 'node:path'
import { statSync } from 'node:fs'

const here = dirname(fileURLToPath(import.meta.url))
const outDir = resolve(here, '../../../doc/public/video')

const run = (cmd, args) => new Promise((res, rej) => {
  const p = spawn(cmd, args, { stdio: 'inherit' })
  p.on('close', (code) => (code === 0 ? res() : rej(new Error(`${cmd} exited ${code}`))))
})

const skipCapture = process.argv.includes('--no-capture')

if (!skipCapture) {
  console.log('› capturing frames')
  await run(process.execPath, [join(here, 'capture.mjs')])
  console.log('› synthesising audio')
  await run(process.execPath, [join(here, 'audio.mjs')])
}

const master = join(outDir, 'magicsync-dev-null-sh.mp4')
const wav = join(outDir, 'magicsync-dev-null-sh.audio.wav')
const final = join(outDir, 'magicsync-dev-null-sh.final.mp4')
const web = join(outDir, 'magicsync-dev-null-sh-720p.mp4')
const poster = join(outDir, 'magicsync-dev-null-sh.poster.png')

console.log('› muxing audio')
spawnSync('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-i', master, '-i', wav,
  '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000',
  '-shortest', '-movflags', '+faststart', final,
], { stdio: 'inherit' })

console.log('› 720p web copy')
spawnSync('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-i', final, '-vf', 'scale=1280:720:flags=lanczos',
  '-c:v', 'libx264', '-preset', 'slow', '-crf', '22', '-pix_fmt', 'yuv420p',
  '-c:a', 'copy', '-movflags', '+faststart', web,
], { stdio: 'inherit' })

console.log('› poster frame')
spawnSync('ffmpeg', [
  '-y', '-hide_banner', '-loglevel', 'error',
  '-ss', '40', '-i', final, '-frames:v', '1', '-q:v', '2', poster,
], { stdio: 'inherit' })

/* publish the 1080p master over the capture output and clean the intermediates */
spawnSync('mv', ['-f', final, master])
spawnSync('rm', ['-f', wav])

for (const f of [master, web, poster]) {
  console.log(`  ${f.replace(resolve(here, '../../..'), '.')}  ${(statSync(f).size / 1024).toFixed(0)} KB`)
}
