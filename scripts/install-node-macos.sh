#!/usr/bin/env bash
# Run on YOUR Mac (Terminal or Cursor integrated terminal), not inside a remote sandbox.
set -euo pipefail

echo "==> Checking for Node/npm..."
export PATH="/opt/homebrew/bin:/usr/local/bin:$PATH"
if command -v npm >/dev/null 2>&1; then
  echo "npm already installed: $(command -v npm)"
  npm -v
  exit 0
fi

if command -v brew >/dev/null 2>&1; then
  echo "==> Installing Node via Homebrew..."
  brew install node
  echo "==> Done."
  node -v && npm -v
  exit 0
fi

echo "Homebrew not found. Installing Node via nvm (user directory, no sudo)..."
export NVM_DIR="${NVM_DIR:-$HOME/.nvm}"
if [ ! -s "$NVM_DIR/nvm.sh" ]; then
  curl -fsSL https://raw.githubusercontent.com/nvm-sh/nvm/v0.40.1/install.sh | bash
fi
# shellcheck source=/dev/null
[ -s "$NVM_DIR/nvm.sh" ] && . "$NVM_DIR/nvm.sh"
nvm install --lts
nvm alias default 'lts/*'
echo ""
echo "==> Add this to ~/.zshrc if it is not already there:"
echo 'export NVM_DIR="$HOME/.nvm"'
echo '[ -s "$NVM_DIR/nvm.sh" ] && \. "$NVM_DIR/nvm.sh"'
echo ""
echo "Then open a new terminal and run: cd $(dirname "$0")/.. && npm install && npm run dev"
node -v && npm -v
