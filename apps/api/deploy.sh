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
sleep 2
ssh -i "$EC2_KEY" "$EC2_HOST" "sudo systemctl is-active evidenceos-api"

echo "==> Verifying health"
curl -sf "$HEALTH_URL" && echo
echo "==> Done."
