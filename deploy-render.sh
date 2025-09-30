#!/usr/bin/env bash
set -euo pipefail
APP_DIR="${1:-$HOME/santafresh}"; REPO_NAME="${2:-santafresh}"; BLUEPRINT="render.yaml"
mkdir -p "$APP_DIR"; cd "$APP_DIR"

# Ensure package.json + start script
[ -f package.json ] || npm init -y >/dev/null
node -e "let p=require('./package.json'); p.type='module'; p.scripts=p.scripts||{}; p.scripts.start='node server.mjs'; require('fs').writeFileSync('package.json', JSON.stringify(p,null,2));"

# Render blueprint
cat > "$BLUEPRINT" <<'YAML'
services:
  - type: web
    name: santa-chat
    env: node
    plan: free
    buildCommand: npm ci
    startCommand: node server.mjs
    autoDeploy: true
    healthCheckPath: /health
    envVars:
      - key: OPENAI_API_KEY
        sync: false
      - key: OPENAI_TTS_VOICE_SANTA
        value: alloy
      - key: OPENAI_TTS_VOICE_ELF
        value: amber
YAML

# Git init & commit
git init >/dev/null 2>&1 || true
git add -A
git commit -m "Deploy: Render blueprint" >/dev/null 2>&1 || true

echo "If you have GitHub CLI (gh), run:"
echo "  gh repo create santafresh --public --source=. --remote=origin --push"
echo "Otherwise create a repo on github.com and push, then open:"
echo "  https://render.com/deploy?repo=https://github.com/<YOUR_USER>/santafresh"
