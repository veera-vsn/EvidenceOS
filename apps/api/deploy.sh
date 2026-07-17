#!/usr/bin/env bash
# Redeploy apps/api to the EC2 backend.
#
# Not wired to git in any way on purpose — see
# Project_Docs/Learnings/Phase_7_Deployment/01_aws_setup_log.md §8 for why
# (avoids putting a GitHub credential on the server). Run this by hand
# whenever apps/api changes and you want the EC2 box updated; it is not
# triggered automatically by commit or push.
set -euo pipefail

EC2_HOST="ec2-user@18.196.98.199"
EC2_KEY="$HOME/.ssh/evidenceos-api-key.pem"
REMOTE_DIR="/opt/evidenceos-api"
HEALTH_URL="https://18.196.98.199.sslip.io/health"
LOCAL_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"

echo "==> Syncing code to $EC2_HOST:$REMOTE_DIR"
tar --exclude='.venv' --exclude='__pycache__' --exclude='*.pyc' \
    --exclude='.pytest_cache' --exclude='.env' --exclude='.env.local' \
    --exclude='.ruff_cache' --exclude='deploy.sh' \
    -czf - -C "$LOCAL_DIR" . | ssh -i "$EC2_KEY" "$EC2_HOST" "tar -xzf - -C $REMOTE_DIR"

echo "==> Installing dependencies (no-op if requirements.txt is unchanged)"
ssh -i "$EC2_KEY" "$EC2_HOST" "cd $REMOTE_DIR && .venv/bin/pip install -q -r requirements.txt"

echo "==> Restarting service"
ssh -i "$EC2_KEY" "$EC2_HOST" "sudo systemctl restart evidenceos-api"

echo "==> Verifying health"
# `systemctl is-active` exits non-zero for any state but "active" (e.g.
# "activating" while uvicorn is still binding), which under `set -e`
# aborted the script right here with no explanation -- see
# Project_Docs/Learnings/Phase_7_Deployment/CHALLENGES.md C9. Poll the
# actual health endpoint instead, since that's what we really care about;
# on failure, dump the service state and recent logs so the real error
# (e.g. a crash-looping process) is visible immediately.
for attempt in $(seq 1 10); do
  if curl -sf "$HEALTH_URL"; then
    echo
    echo "==> Done."
    exit 0
  fi
  sleep 1
done

echo "Health check failed after 10s. Service state and recent logs:" >&2
ssh -i "$EC2_KEY" "$EC2_HOST" "sudo systemctl is-active evidenceos-api; sudo journalctl -u evidenceos-api -n 30 --no-pager" >&2
exit 1
