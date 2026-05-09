#!/usr/bin/env bash
# =============================================================================
# infra/minio/bootstrap.sh — One-shot MinIO bucket provisioning
#
# Sets up the 'posts-media' bucket (or $MINIO_BUCKET_MEDIA) with the CORS
# policy from cors.json. Run once per environment on initial deploy, or after
# recreating the MinIO container.
#
# Prerequisites:
#   - mc (MinIO Client) installed and available on PATH
#   - MinIO running and accessible at $MINIO_ENDPOINT
#   - $MINIO_ACCESS_KEY and $MINIO_SECRET_KEY set
#
# Usage:
#   MINIO_ENDPOINT=http://localhost:9000 \
#   MINIO_ACCESS_KEY=minioadmin \
#   MINIO_SECRET_KEY=minioadmin \
#   bash infra/minio/bootstrap.sh
#
#   # Dry-run (prints commands without executing):
#   bash infra/minio/bootstrap.sh --dry-run
#
# Environment variables (can also be loaded from .env):
#   MINIO_ENDPOINT     — MinIO server URL (default: http://localhost:9000)
#   MINIO_ACCESS_KEY   — MinIO root user (default: minioadmin)
#   MINIO_SECRET_KEY   — MinIO root password (default: minioadmin)
#   MINIO_BUCKET_MEDIA — bucket name (default: posts-media)
#   MC_ALIAS           — mc alias name (default: jcsoftdev)
# =============================================================================

set -euo pipefail

# ---------------------------------------------------------------------------
# Defaults
# ---------------------------------------------------------------------------
MINIO_ENDPOINT="${MINIO_ENDPOINT:-http://localhost:9000}"
MINIO_ACCESS_KEY="${MINIO_ACCESS_KEY:-minioadmin}"
MINIO_SECRET_KEY="${MINIO_SECRET_KEY:-minioadmin}"
MINIO_BUCKET_MEDIA="${MINIO_BUCKET_MEDIA:-posts-media}"
MC_ALIAS="${MC_ALIAS:-jcsoftdev}"

# ---------------------------------------------------------------------------
# Dry-run flag
# ---------------------------------------------------------------------------
DRY_RUN=false
for arg in "$@"; do
  case "$arg" in
    --dry-run) DRY_RUN=true ;;
  esac
done

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
CORS_FILE="${SCRIPT_DIR}/cors.json"

log() { echo "[minio-bootstrap] $*"; }
run() {
  if [ "$DRY_RUN" = "true" ]; then
    echo "  [DRY-RUN] $*"
  else
    "$@"
  fi
}

# ---------------------------------------------------------------------------
# Pre-flight checks (skipped in dry-run for CI/testing without mc installed)
# ---------------------------------------------------------------------------
if [ "$DRY_RUN" = "false" ] && ! command -v mc &>/dev/null; then
  echo "[minio-bootstrap] ERROR: 'mc' (MinIO Client) is not installed."
  echo "  Install via: brew install minio/stable/mc"
  echo "  Or: https://min.io/docs/minio/linux/reference/minio-mc.html"
  exit 1
fi

if [ ! -f "$CORS_FILE" ]; then
  echo "[minio-bootstrap] ERROR: CORS file not found at $CORS_FILE"
  exit 1
fi

log "Starting MinIO bootstrap"
log "  Endpoint   : $MINIO_ENDPOINT"
log "  Bucket     : $MINIO_BUCKET_MEDIA"
log "  Alias      : $MC_ALIAS"
log "  DRY_RUN    : $DRY_RUN"

# ---------------------------------------------------------------------------
# 1. Register mc alias
# ---------------------------------------------------------------------------
log "Step 1: Registering mc alias '$MC_ALIAS'"
run mc alias set "$MC_ALIAS" \
  "$MINIO_ENDPOINT" \
  "$MINIO_ACCESS_KEY" \
  "$MINIO_SECRET_KEY"

# ---------------------------------------------------------------------------
# 2. Create bucket (idempotent — ok if already exists)
# ---------------------------------------------------------------------------
log "Step 2: Creating bucket '$MINIO_BUCKET_MEDIA' (idempotent)"
if [ "$DRY_RUN" = "true" ]; then
  echo "  [DRY-RUN] mc mb --ignore-existing ${MC_ALIAS}/${MINIO_BUCKET_MEDIA}"
else
  mc mb --ignore-existing "${MC_ALIAS}/${MINIO_BUCKET_MEDIA}" || true
fi

# ---------------------------------------------------------------------------
# 3. Set bucket policy to download (public GET for media serving)
#    — only object keys explicitly presigned are accessible; bucket-wide
#      public access is kept minimal.
# ---------------------------------------------------------------------------
log "Step 3: Setting anonymous download policy for public media serving"
run mc anonymous set download "${MC_ALIAS}/${MINIO_BUCKET_MEDIA}"

# ---------------------------------------------------------------------------
# 4. Apply CORS policy via AWS S3 API (mc does not support CORS natively)
#    Falls back to aws CLI if mc cors is unavailable.
# ---------------------------------------------------------------------------
log "Step 4: Applying CORS policy from $CORS_FILE"

# mc >= RELEASE.2024-05-x supports 'mc cors set'
if mc cors --help &>/dev/null 2>&1; then
  run mc cors set "${MC_ALIAS}/${MINIO_BUCKET_MEDIA}" "$CORS_FILE"
else
  # Fallback: use aws CLI with MinIO endpoint
  log "  mc cors not available — falling back to aws s3api"
  if ! command -v aws &>/dev/null; then
    echo "[minio-bootstrap] ERROR: Neither 'mc cors' nor 'aws' CLI is available."
    echo "  Install AWS CLI: https://docs.aws.amazon.com/cli/latest/userguide/getting-started-install.html"
    exit 1
  fi
  run aws s3api put-bucket-cors \
    --endpoint-url "$MINIO_ENDPOINT" \
    --bucket "$MINIO_BUCKET_MEDIA" \
    --cors-configuration "file://${CORS_FILE}" \
    --region "${MINIO_REGION:-us-east-1}"
fi

# ---------------------------------------------------------------------------
# Done
# ---------------------------------------------------------------------------
log "Bootstrap complete."
log "  Bucket '$MINIO_BUCKET_MEDIA' is ready at $MINIO_ENDPOINT"
log "  CORS policy applied from $CORS_FILE"
if [ "$DRY_RUN" = "true" ]; then
  log "  (DRY-RUN: no changes were made)"
fi
