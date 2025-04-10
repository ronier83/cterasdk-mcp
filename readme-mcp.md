# CTERA SDK MCP Integration Guide

This guide explains how to integrate the CTERA SDK MCP (Model, Channel, Provider) implementation with [Cursor AI](https://cursor.sh/), Claude, or other AI tools.

## What is CTERA SDK MCP?

CTERA SDK MCP is a lightweight Node.js server that provides a simple way to interact with CTERA portals. It eliminates the need for Python dependencies and provides a consistent API that can be easily integrated with AI assistants and other tools.

## Quick Setup

### Option 1: Using npx (Recommended)

```bash
# Start the server directly with npx
npx -y github:ronier83/cterasdk-mcp start --token your_secret_token --port 5001
```

### Option 2: Clone and Run

```bash
# Clone the repository
git clone https://github.com/ronier83/cterasdk-mcp.git
cd cterasdk-mcp

# Install dependencies
npm install

# Start the server
node cli.js start --token your_secret_token --port 5001
```

## Cursor AI Integration

To integrate with Cursor AI, add the following configuration to your `.cursorrules` file in your project:

```json
{
  "mcp": {
    "server": {
      "command": "/usr/local/bin/npx",
      "args": ["-y", "github:ronier83/cterasdk-mcp", "start", "--token", "default_token", "--port", "5001"],
      "enabled": true
    },
    "repository": "github:ronier83/cterasdk-mcp"
  },
  "apiEndpoints": [
    { "path": "/api/login", "method": "POST", "requiresToken": true },
    { "path": "/api/browse-global", "method": "POST", "requiresToken": true, "requiresSession": true },
    { "path": "/api/list-tenants", "method": "POST", "requiresToken": true, "requiresSession": true },
    { "path": "/api/sessions", "method": "GET", "requiresToken": true },
    { "path": "/api/logout", "method": "POST", "requiresToken": true, "requiresSession": true },
    { "path": "/api/session/:sessionKey", "method": "GET", "requiresToken": true },
    { "path": "/api/proxy", "method": "POST", "requiresToken": true, "requiresSession": true },
    { "path": "/api/health", "method": "GET", "requiresToken": true }
  ]
}
```

### Important Configuration Notes:

1. Always use GitHub repository reference (`github:ronier83/cterasdk-mcp`)
2. Do not use the @ prefix when referencing the repository
3. Maintain port 5001 consistency across your configuration
4. The token value should match what you use when starting the server

## Usage with Claude or Other AI Tools

### 1. Start the MCP Server

```bash
npx -y github:ronier83/cterasdk-mcp start --token your_secret_token --port 5001
```

### 2. Create a Session

```bash
# Using curl
curl -X POST "http://localhost:5001/api/login" \
  -H "Content-Type: application/json" \
  -H "X-API-Token: your_secret_token" \
  -d '{"host":"your-ctera-host", "username":"admin", "password":"your-password"}'

# Or using the CLI
npx -y github:ronier83/cterasdk-mcp login \
  --host your-ctera-host \
  --username admin \
  --password your-password \
  --token your_secret_token \
  --port 5001
```

This will return a session key needed for subsequent operations.

### 3. List Tenants (Example Operation)

```bash
# Using curl
curl -X POST "http://localhost:5001/api/list-tenants" \
  -H "Content-Type: application/json" \
  -H "X-API-Token: your_secret_token" \
  -d '{"sessionKey":"your-session-key"}'

# Or using the CLI
npx -y github:ronier83/cterasdk-mcp list-tenants \
  --session-key your-session-key \
  --token your_secret_token \
  --port 5001
```

## API Endpoints Reference

All endpoints require the `X-API-Token` header to be set to your configured token.

| Endpoint | Method | Description | Required Parameters |
|----------|--------|-------------|---------------------|
| `/api/login` | POST | Login to a CTERA portal | `host`, `username`, `password` |
| `/api/browse-global` | POST | Browse to Global Admin | `sessionKey` |
| `/api/list-tenants` | POST | List tenants | `sessionKey` |
| `/api/sessions` | GET | List active sessions | None |
| `/api/logout` | POST | Logout from a session | `sessionKey` |
| `/api/session/:sessionKey` | GET | Get details of a specific session | Path parameter: `sessionKey` |
| `/api/proxy` | POST | Proxy requests to CTERA API | `sessionKey`, `method`, `path`, optional: `data`, `headers` |
| `/api/health` | GET | Health check | None |

## MCP Protocol Endpoint

For advanced integrations, the server also provides an MCP protocol endpoint at `/mcp` that supports:

- `login` - Authenticate with a CTERA portal
- `listTenants` - List available tenants

This endpoint can be used by compatible AI tools including Cursor AI.

## Security Considerations

- Always use a secure token rather than the default token
- Store session information securely
- The server supports HTTPS but doesn't enforce it; consider running behind a reverse proxy for production use

## Troubleshooting

1. **405 Method Not Allowed Error**: Ensure you're not explicitly adding port 443 to URLs, as this can cause issues with some CTERA portals
2. **Authentication Failures**: Double-check your credentials and ensure the CTERA portal is accessible from your network
3. **Session Issues**: Sessions are saved to `sessions.json`. If experiencing issues, you can delete this file to start fresh

## Advanced Configuration

For persistent deployments, consider:

1. Setting up as a systemd service on Linux
2. Using PM2 for process management
3. Configuring a reverse proxy like Nginx or Apache

Example systemd configuration:

```
[Unit]
Description=CTERA SDK MCP Server
After=network.target

[Service]
User=youruser
WorkingDirectory=/path/to/cterasdk-mcp
ExecStart=/usr/bin/npx -y github:ronier83/cterasdk-mcp start --token your_secret_token --port 5001
Restart=always
Environment=NODE_ENV=production

[Install]
WantedBy=multi-user.target
``` 