#!/bin/sh
set -e

: "${PORT:=8080}"

export PORT
/usr/local/bin/api &
API_PID=$!

/usr/local/bin/worker &
WORKER_PID=$!

PORT=3000 HOSTNAME=0.0.0.0 node /app/server.js &
WEB_PID=$!

trap 'kill $API_PID $WORKER_PID $WEB_PID 2>/dev/null || true' TERM INT
wait
