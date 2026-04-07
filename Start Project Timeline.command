#!/bin/zsh
set -euo pipefail

PROJECT_DIR="/Users/aleqian/Documents/MyProjects/improved-project-timeline"
APP_URL="http://127.0.0.1:5173/"

cd "$PROJECT_DIR"

(
  until curl -sf "$APP_URL" >/dev/null 2>&1; do
    sleep 1
  done
  open -a "Firefox" "$APP_URL"
) &

npm run dev -- --host 127.0.0.1
