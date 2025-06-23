#!/usr/bin/env bash
set -e

# Usage: sudo ./install_web_terminal.sh
# Run this from your project root (e.g., /opt/web-terminal)

# 0) Ensure script is run as root
if [ "$EUID" -ne 0 ]; then
  echo "Error: Please run as root (e.g., via sudo)."
  exit 1
fi

INSTALL_DIR="$(pwd)"
echo "Installing web-terminal from $INSTALL_DIR"

# 1) Install prerequisites
apt-get update
apt-get install -y git nodejs npm

# 2) Install Node.js dependencies
echo "Installing Node.js dependencies..."
npm install --production

# 3) Create systemd service file
SERVICE_FILE="/etc/systemd/system/web-terminal.service"
echo "Creating systemd service at $SERVICE_FILE"
cat > "$SERVICE_FILE" <<EOF
[Unit]
Description=Web-Terminal (whitelisted commands)
After=network.target

[Service]
Type=simple
WorkingDirectory=$INSTALL_DIR
ExecStart=/usr/bin/npm start
Restart=on-failure
StandardOutput=syslog
StandardError=syslog
SyslogIdentifier=web-terminal

[Install]
WantedBy=multi-user.target
EOF

# 4) Enable & start service
echo "Reloading systemd daemon and enabling web-terminal.service"
systemctl daemon-reload
systemctl enable web-terminal
systemctl restart web-terminal

# 5) Done
echo "Installation complete. 'web-terminal' service is active and listening on port 3000."
