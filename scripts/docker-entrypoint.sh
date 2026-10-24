#!/bin/sh
# Drop privileges after fixing writable-path ownership.
#
# The runtime runs as the unprivileged `app` user. Every writable path that is
# a Docker volume or bind mount is created root-owned by Docker (and previous
# root-running releases left root-owned files behind), so the server hits
# EACCES on uploads. We start as root only long enough to fix ownership of the
# known writable roots, then exec the server as `app`.
#
# Paths handled:
#   $YTDLP_DOWNLOAD_DIR          video ingest scratch (named volume)
#   $NUXT_FILE_STORAGE_MOUNT     asset blob store root (Coolify bind mount,
#                                default /usr/app/upload/files)
#   /usr/app/upload/chunks       chunked-upload scratch
set -eu

APP_USER="${APP_USER:-app}"
VIDEO_DIR="${YTDLP_DOWNLOAD_DIR:-/app/video-tmp}"
UPLOAD_DIR="${NUXT_FILE_STORAGE_MOUNT:-/usr/app/upload/files}"

# NUXT_FILE_STORAGE_MOUNT may be relative to the app directory.
case "$UPLOAD_DIR" in
  /*) ;;
  *) UPLOAD_DIR="/usr/app/${UPLOAD_DIR#./}" ;;
esac

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$VIDEO_DIR" "$UPLOAD_DIR" /usr/app/upload/chunks

  chown -R "$APP_USER:$APP_USER" "$VIDEO_DIR" 2>/dev/null || true

  # Non-recursive on files: the mount can hold many inodes and only directory
  # write permission is needed to create new UUID-named files. Every directory
  # level is chowned because Coolify mounts `.../userFiles` and the per-user
  # folders inside it were created by the previous root-running release.
  chown "$APP_USER:$APP_USER" "$UPLOAD_DIR" /usr/app/upload /usr/app/upload/chunks 2>/dev/null || true
  find "$UPLOAD_DIR" -type d \
    -exec chown "$APP_USER:$APP_USER" {} \; 2>/dev/null || true

  exec su-exec "$APP_USER" "$@"
fi

exec "$@"
