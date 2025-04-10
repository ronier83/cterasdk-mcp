# CTERA SDK MCP

CTERA SDK MCP Agent with pure Node.js implementation for easy use with npx.

## Overview

This Node.js implementation of the CTERA SDK MCP Agent provides a lightweight, cross-platform solution for interacting with CTERA portals. It eliminates architecture-specific issues and Python dependencies for a more seamless experience.

## Quick Start

```bash
# Install with npx and start the server
npx -y cterasdk-mcp@latest start --token YOUR_API_TOKEN

# Or run directly from the cloned repository
git clone https://github.com/yourusername/cterasdk-mcp.git
cd cterasdk-mcp
npm install
npx . start --token YOUR_API_TOKEN
```

## Requirements

- Node.js 14+ and npm (or npx)

## Features

- Login to CTERA portal
- Browse to Global Admin
- List tenants
- Session management with persistence
- General-purpose proxy for CTERA API calls
- Pure Node.js implementation (no Python dependencies)

## Usage

### Start the Server

```bash
npx cterasdk-mcp start --token YOUR_API_TOKEN --port 5000
```

### Login to a CTERA Portal

```bash
npx cterasdk-mcp login --host your-ctera-host --username admin --password yourpassword
```

This will return a session key you can use for other commands.

### List Tenants

```bash
# First, login to get a session key
# Then, list tenants using the session key
npx cterasdk-mcp list-tenants --session-key your-session-key
```

### List Active Sessions

```bash
npx cterasdk-mcp list-sessions
```

### Logout

```bash
npx cterasdk-mcp logout --session-key your-session-key
```

### Send Custom API Requests

```bash
npx cterasdk-mcp proxy --session-key your-session-key --path "/admin/api/customEndpoint" --method POST --data '{"key":"value"}'
```

## API Endpoints

The server exposes the following API endpoints:

- `POST /api/login` - Login to a CTERA portal
- `POST /api/browse-global` - Browse to Global Admin
- `POST /api/list-tenants` - List tenants
- `GET /api/sessions` - List active sessions
- `POST /api/logout` - Logout from a session
- `GET /api/session/:sessionKey` - Get details of a specific session
- `POST /api/proxy` - Proxy requests to CTERA API
- `GET /api/health` - Health check

All endpoints require the `X-API-Token` header to be set to the configured token.

## Deploying as a Persistent Service

### Using systemd (Linux)

```bash
# Create a systemd service file
sudo nano /etc/systemd/system/cterasdk-mcp.service

# Add this content
[Unit]
Description=CTERA SDK MCP Server
After=network.target

[Service]
User=youruser
WorkingDirectory=/path/to/cterasdk-mcp
ExecStart=/usr/bin/npx . start --token YOUR_SECRET_TOKEN --port 5001
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target

# Enable and start the service
sudo systemctl enable cterasdk-mcp
sudo systemctl start cterasdk-mcp
```

### Using PM2

```bash
# Install PM2
npm install -g pm2

# Start the server with PM2
pm2 start index.js --name cterasdk-mcp -- --token YOUR_SECRET_TOKEN --port 5001

# Save the PM2 configuration
pm2 save

# Set PM2 to start on boot
pm2 startup
```

## Session Persistence

Sessions are automatically saved to a `sessions.json` file and loaded when the server starts. This ensures that sessions persist across server restarts.

## Integration with External Services

You can use the MCP server as an authentication proxy for other applications:

```javascript
// Example in another Node.js application
const axios = require('axios');

async function useMcpSession(sessionKey) {
  // Get session details from MCP
  const sessionResponse = await axios.get(
    `http://mcp-server:5001/api/session/${sessionKey}`,
    { headers: { 'X-API-Token': 'your-token' } }
  );
  
  const { host, jsessionid } = sessionResponse.data;
  
  // Now use this session in direct calls to CTERA
  const cteraResponse = await axios.get(
    `https://${host}/admin/api/someEndpoint`,
    { 
      headers: { 'Cookie': `JSESSIONID=${jsessionid}` },
      httpsAgent: new https.Agent({ rejectUnauthorized: false })
    }
  );
  
  return cteraResponse.data;
}
``` 


"cterasdk": {
  "command": "/usr/local/bin/npx",
  "args": [
    "-y",
    "cterasdk-mcp@latest",
    "start",
    "--token",
    "default_token",
    "--port",
    "5001"
  ],
  "enabled": true
}