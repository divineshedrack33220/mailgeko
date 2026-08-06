#!/bin/sh
set -e

# The API always listens on 8080 (matches the Next.js rewrites in next.config).
# The web process binds to Render's injected PORT when present (so Render routes
# external traffic to it), and falls back to 3000 for local/compose runs. If the
# injected PORT collides with the API's 8080, the web process uses 3000 instead.
unset HOSTNAME

# Start the bundled in-memory Redis when REDIS_ADDR points at the local
# instance (the default is localhost:6379). When REDIS_ADDR names an external
# server (e.g. Upstash), that server is used and the local one is skipped.
start_local_redis() {
	case "${REDIS_ADDR:-localhost:6379}" in
		localhost:* | 127.0.0.1:*) return 0 ;;
	esac
	return 1
}

REDIS_PID=""
if start_local_redis; then
	echo "starting bundled redis on 127.0.0.1:6379"
	redis-server --save "" --appendonly no --bind 127.0.0.1 --port 6379 >/dev/null 2>&1 &
	REDIS_PID=$!
	i=0
	until redis-cli -h 127.0.0.1 -p 6379 ping >/dev/null 2>&1 || [ "$i" -ge 40 ]; do
		i=$((i + 1))
		sleep 0.25
	done
fi

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

trap 'kill $API_PID $WORKER_PID $WEB_PID $REDIS_PID 2>/dev/null || true' TERM INT
wait
