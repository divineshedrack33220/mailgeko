#!/bin/sh
set -e

# The API always listens on 8080 (matches the Next.js rewrites in next.config).
# The web process binds to Render's injected PORT when present (so Render routes
# external traffic to it), and falls back to 3000 for local/compose runs. If the
# injected PORT collides with the API's 8080, the web process uses 3000 instead.
unset HOSTNAME

WEB_PORT="${PORT:-3000}"
if [ "$WEB_PORT" = "8080" ]; then
	WEB_PORT=3000
fi

PORT=8080 /usr/local/bin/api &
API_PID=$!

/usr/local/bin/worker &
WORKER_PID=$!

PORT="$WEB_PORT" HOSTNAME=0.0.0.0 node /app/server.js &
WEB_PID=$!

trap 'kill $API_PID $WORKER_PID $WEB_PID 2>/dev/null || true' TERM INT
wait
