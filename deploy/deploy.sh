#!/usr/bin/env bash
set -e

# Base directory of the repository
DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." >/dev/null 2>&1 && pwd)"
cd "$DIR"

echo "=== Deploying Clips Studio at $DIR ==="

# 1. Python virtual environment setup
if [ ! -d "venv" ]; then
    echo "Creating Python virtualenv..."
    python3 -m venv venv
fi

echo "Installing/updating Python dependencies..."
./venv/bin/pip install --upgrade pip
./venv/bin/pip install -r requirements.txt

# 2. Frontend build
echo "Building frontend..."
cd frontend
npm install --silent
npm run build
cd "$DIR"

# 3. Ensure required directories exist
mkdir -p downloads

# 4. Restart Systemd service if it exists and is active
if systemctl is-active --quiet clips.service 2>/dev/null; then
    echo "Restarting clips.service..."
    sudo systemctl restart clips.service
    echo "Service restarted successfully!"
else
    echo "Notice: clips.service is not currently active."
    echo "To set up systemd service, copy deploy/clips.service to /etc/systemd/system/ and run:"
    echo "  sudo cp deploy/clips.service /etc/systemd/system/"
    echo "  sudo systemctl daemon-reload"
    echo "  sudo systemctl enable --now clips.service"
fi

echo "=== Deployment Completed Successfully! ==="
