# Cursor Rules for CTERA SDK MCP

## MCP Server Configuration

```json
"cterasdk": {
  "command": "/usr/local/bin/npx",
  "args": [
    "-y",
    "github:ronier83/cterasdk-mcp",
    "start",
    "--token",
    "default_token",
    "--port",
    "5001"
  ],
  "enabled": true
}
```

- Always run from GitHub repository: `github:ronier83/cterasdk-mcp`
- Never use local file paths in configuration
- Do not use the `@` prefix when referencing the repository
- Port 5001 must remain consistent

## Repository Guidelines

- No generated files (*.tgz, sessions.json)
- No node_modules or editor-specific folders
- Maintain proper .gitignore settings

## API Usage

- Login flow: authenticate with CTERA portal → get session key
- API calls require X-API-Token header for MCP authorization
- All tenant operations require valid session key

## Testing Procedures

- Restart Cursor after configuration changes
- Verify MCP server status in Cursor logs
- Test login and tenant listing after changes

## API Endpoints

- POST /api/login
- POST /api/browse-global
- POST /api/list-tenants
- GET /api/sessions
- POST /api/logout
- GET /api/session/:sessionKey
- POST /api/proxy
- GET /api/health 