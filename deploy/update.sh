#!/usr/bin/env bash
#
# Pull-based autodeploy for WidgetsHub.
#
# Run every minute from cron. It fetches origin/main, and when there is
# something new it rebuilds the image, restarts the container and verifies the
# health endpoint before declaring success.
#
# The whole body lives inside main() on purpose: bash reads a script
# incrementally, so a `git reset --hard` that rewrites this very file mid-run
# would otherwise make the shell execute garbage. Defining a function forces
# bash to parse it fully before any of it runs.
#
#   crontab:  * * * * * /DATA/AppData/widgethub/repo/deploy/update.sh
#   manual :  FORCE=1 /DATA/AppData/widgethub/repo/deploy/update.sh

set -euo pipefail

main() {
  readonly APP_DIR="${APP_DIR:-/DATA/AppData/widgethub}"
  readonly REPO_DIR="$APP_DIR/repo"
  readonly LOG="$APP_DIR/update.log"
  readonly LOCK="$APP_DIR/update.lock"
  readonly BRANCH="${BRANCH:-main}"
  readonly HEALTH_URL="http://127.0.0.1:3080/api/health"
  readonly FORCE="${FORCE:-0}"

  log() { printf '[%s] %s\n' "$(date '+%Y-%m-%d %H:%M:%S')" "$*" >> "$LOG"; }

  # Only one deploy at a time. A build can outlast the one-minute cron tick,
  # and two concurrent rebuilds would fight over the same image tag.
  exec 9>"$LOCK"
  if ! flock -n 9; then
    log "another run still in progress, skipping"
    exit 0
  fi

  cd "$REPO_DIR"

  # The clone used to track develop; make sure it follows the deployed branch.
  local current
  current="$(git rev-parse --abbrev-ref HEAD)"
  if [[ "$current" != "$BRANCH" ]]; then
    log "switching branch $current -> $BRANCH"
    git fetch --quiet origin "$BRANCH"
    git checkout --quiet -B "$BRANCH" "origin/$BRANCH"
  fi

  git fetch --quiet origin "$BRANCH"

  local local_sha remote_sha
  local_sha="$(git rev-parse HEAD)"
  remote_sha="$(git rev-parse "origin/$BRANCH")"

  if [[ "$local_sha" == "$remote_sha" && "$FORCE" != "1" ]]; then
    exit 0   # nothing new; stay quiet so the log stays readable
  fi

  log "=== deploy started: ${local_sha:0:8} -> ${remote_sha:0:8} ==="

  # Only tracked files are touched, so data/ and secrets.json are untouched.
  git reset --hard --quiet "origin/$BRANCH"

  if ! docker compose build >> "$LOG" 2>&1; then
    log "BUILD FAILED — the running container was left alone"
    exit 1
  fi

  if ! docker compose up -d >> "$LOG" 2>&1; then
    log "START FAILED"
    exit 1
  fi

  # Give the container a moment, then confirm it actually serves traffic.
  local attempt
  for attempt in $(seq 1 20); do
    if curl -fsS --ipv4 --max-time 3 "$HEALTH_URL" > /dev/null 2>&1; then
      log "healthy after ${attempt}s — now at ${remote_sha:0:8}"
      log "=== deploy finished ==="
      exit 0
    fi
    sleep 1
  done

  log "UNHEALTHY after 20s — check: docker logs widgethub"
  exit 1
}

main "$@"
