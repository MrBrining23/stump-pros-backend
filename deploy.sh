#!/bin/bash
# ============================================================
# Stump Pros Backend — Full Deploy Script
# Handles: GitHub repo creation + push + Railway deployment
# Usage: bash deploy.sh
# ============================================================

set -e

REPO_NAME="stump-pros-backend"
GITHUB_USER="MrBrining23"
RAILWAY_PROJECT="stump-pros-backend"

GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
NC='\033[0m'

log()  { echo -e "${GREEN}[✓]${NC} $1"; }
info() { echo -e "${YELLOW}[→]${NC} $1"; }
fail() { echo -e "${RED}[✗]${NC} $1"; exit 1; }

# ── Step 1: Check gh CLI ──────────────────────────────────
info "Checking for GitHub CLI (gh)..."
if ! command -v gh &>/dev/null; then
  info "gh not found. Installing via Homebrew..."
  if command -v brew &>/dev/null; then
    brew install gh
  else
    fail "Homebrew not found. Please install gh CLI from https://cli.github.com and re-run."
  fi
fi
log "gh CLI found."

# ── Step 2: Check gh auth ─────────────────────────────────
info "Checking GitHub auth..."
if ! gh auth status &>/dev/null; then
  info "Not logged in. Opening browser for GitHub auth..."
  gh auth login --web -h github.com
fi
log "GitHub authenticated."

# ── Step 3: Create GitHub repo ────────────────────────────
info "Creating private GitHub repo: $GITHUB_USER/$REPO_NAME..."
if gh repo view "$GITHUB_USER/$REPO_NAME" &>/dev/null; then
  log "Repo already exists — skipping creation."
else
  gh repo create "$GITHUB_USER/$REPO_NAME" --private --source=. --remote=origin --push
  log "Repo created and code pushed!"
fi

# ── Step 4: Git init + push (if not already pushed) ──────
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
cd "$SCRIPT_DIR"

if [ ! -d ".git" ]; then
  info "Initializing git..."
  git init
  git add .
  git commit -m "Initial commit: Stump Pros backend"
fi

REMOTE=$(git remote get-url origin 2>/dev/null || echo "")
if [ -z "$REMOTE" ]; then
  git remote add origin "https://github.com/$GITHUB_USER/$REPO_NAME.git"
fi

info "Pushing to GitHub..."
git push -u origin main 2>/dev/null || git push -u origin master 2>/dev/null || {
  git branch -M main
  git push -u origin main
}
log "Code is on GitHub."

# ── Step 5: Check Railway CLI ─────────────────────────────
info "Checking for Railway CLI..."
if ! command -v railway &>/dev/null; then
  info "Railway CLI not found. Installing..."
  if command -v brew &>/dev/null; then
    brew install railway
  else
    curl -fsSL https://railway.app/install.sh | sh
  fi
fi
log "Railway CLI found."

# ── Step 6: Railway login ─────────────────────────────────
info "Checking Railway auth..."
if ! railway whoami &>/dev/null; then
  info "Not logged in to Railway. Opening browser..."
  railway login
fi
log "Railway authenticated."

# ── Step 7: Create Railway project ────────────────────────
info "Creating Railway project: $RAILWAY_PROJECT..."
railway init --name "$RAILWAY_PROJECT" 2>/dev/null || true
log "Railway project ready."

# ── Step 8: Link repo + deploy ────────────────────────────
info "Deploying to Railway..."
railway up --detach
log "Deployment triggered."

# ── Step 9: Add PostgreSQL ────────────────────────────────
info "Adding PostgreSQL plugin..."
railway add --plugin postgresql 2>/dev/null || true
log "PostgreSQL added (DATABASE_URL will be auto-set)."

# ── Step 10: Set environment variables ────────────────────
info "Setting environment variables..."
railway variables set \
  QUO_API_KEY="36c4902a26aa32741cb574fe26fa3b8b0d8f3372cc18e6db1e02de3a78cde056" \
  STUMP_PROS_PHONE="+13047122005" \
  NODE_ENV="production" \
  PORT="3000"
log "Environment variables set."

# ── Step 11: Run db:init ──────────────────────────────────
info "Running npm run db:init to create database tables..."
railway run npm run db:init
log "Database tables created."

# ── Done ──────────────────────────────────────────────────
echo ""
echo -e "${GREEN}════════════════════════════════════════${NC}"
log "Stump Pros backend deployed!"
echo ""
info "Getting your Railway URL..."
railway domain 2>/dev/null || railway status
echo -e "${GREEN}════════════════════════════════════════${NC}"
