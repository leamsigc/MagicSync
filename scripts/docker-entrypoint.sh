#!/bin/sh
# Drop privileges after fixing volume ownership.
#
# The runtime image ships a named volume at $YTDLP_DOWNLOAD_DIR. Docker creates
# a fresh named volume owned by root, which overrides the image's chown — so a
# process running as `app` cannot write there. We start as root only long enough
# to chown that one directory, then exec the server as `app`.
set -eu

APP_USER="${APP_USER:-app}"
VIDEO_DIR="${YTDLP_DOWNLOAD_DIR:-/app/video-tmp}"

if [ "$(id -u)" = "0" ]; then
  mkdir -p "$VIDEO_DIR"
  chown -R "$APP_USER:$APP_USER" "$VIDEO_DIR" 2>/dev/null || true
  exec su-exec "$APP_USER" "$@"
fi

exec "$@"
