#!/bin/sh
set -eu
cd /workspace
if curl -sf -o /dev/null --max-time 2 http://127.0.0.1:4096/global/health; then
  exit 0
fi
if ! command -v opencode >/dev/null 2>&1; then
  echo "opencode CLI missing" >&2
  exit 0
fi
mkdir -p /tmp/opencode-logs
nohup opencode serve --port 4096 --hostname 127.0.0.1 --log-level INFO \
  >>/tmp/opencode-logs/serve.log 2>&1 &
i=0
while [ "$i" -lt 40 ]; do
  if curl -sf -o /dev/null --max-time 1 http://127.0.0.1:4096/global/health; then
    exit 0
  fi
  i=$((i + 1))
  sleep 0.25
done
exit 0
