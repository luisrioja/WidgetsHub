#!/usr/bin/env bash
#
# One-time (and idempotent) install for WidgetsHub on the Docker host.
# Safe to re-run: it only creates what is missing.
#
#   /DATA/AppData/widgethub/repo/deploy/setup.sh

set -euo pipefail

main() {
  readonly APP_DIR="${APP_DIR:-/DATA/AppData/widgethub}"
  readonly REPO_DIR="$APP_DIR/repo"
  readonly DATA_DIR="$APP_DIR/data"
  readonly CRON_LINE="* * * * * $REPO_DIR/deploy/update.sh"

  say() { printf '  %s\n' "$*"; }

  echo "WidgetsHub setup"

  # --- data directory -------------------------------------------------
  mkdir -p "$DATA_DIR"
  chmod 700 "$DATA_DIR"
  say "data dir ready: $DATA_DIR"

  if [[ ! -f "$DATA_DIR/secrets.json" ]]; then
    cat > "$DATA_DIR/secrets.json" <<'JSON'
{
  "adminEmails": []
}
JSON
    chmod 600 "$DATA_DIR/secrets.json"
    say "created $DATA_DIR/secrets.json — put your email in adminEmails"
    say "  (leave it empty and the first account to register becomes admin)"
  else
    chmod 600 "$DATA_DIR/secrets.json"
    say "secrets.json already present, left untouched"
  fi

  # --- executable bits ------------------------------------------------
  chmod +x "$REPO_DIR/deploy/update.sh" "$REPO_DIR/deploy/setup.sh"

  # --- cron -----------------------------------------------------------
  # The old entry ran weekly and pointed at a script that had been overwritten
  # with something unrelated, so any line mentioning widgethub is replaced.
  local current
  current="$(crontab -l 2>/dev/null || true)"

  if grep -Fq "$CRON_LINE" <<< "$current"; then
    say "cron entry already correct"
  else
    printf '%s\n' "$current" \
      | grep -v 'widgethub' \
      | { cat; echo "$CRON_LINE"; } \
      | grep -v '^$' \
      | crontab -
    say "cron entry installed: every minute"
  fi

  # --- first build ----------------------------------------------------
  cd "$REPO_DIR"
  say "building…"
  docker compose build
  docker compose up -d

  say "waiting for health…"
  local attempt
  for attempt in $(seq 1 30); do
    if curl -fsS --ipv4 --max-time 3 http://127.0.0.1:3080/api/health > /dev/null 2>&1; then
      echo
      echo "Up and healthy on :3080"
      echo "Next: register your account, then close registration from Admin."
      exit 0
    fi
    sleep 1
  done

  echo
  echo "Not healthy yet. Check: docker logs widgethub"
  exit 1
}

main "$@"
