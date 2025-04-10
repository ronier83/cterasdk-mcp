# CTERA SDK MCP Agent

MCP (Modular Computational Platform) agent for the CTERA SDK that provides a REST API interface for authentication and session management.

## Features

- Login to CTERA servers (GlobalAdmin, ServicesPortal, Edge)
- Session management with cookie preservation
- Authentication with API tokens
- Tenant listing for GlobalAdmin sessions
- Docker support for easy deployment

## Installation

```bash
pip install cterasdk-mcp
```

## Usage

### Running the CLI Tool

```bash
# Login to a CTERA server
cterasdk-mcp login --host your-ctera-host --username admin --password yourpassword

# List tenants
cterasdk-mcp list_tenants --session-key "your-session-key"

# List sessions
cterasdk-mcp list_sessions

# Logout
cterasdk-mcp logout --session-key "your-session-key"
```

### Running the API Server

```bash
# Start the API server
cterasdk-mcp-agent --host 0.0.0.0 --port 5000

# Set API token (for server authentication)
export MCP_API_TOKEN=your-secret-token
```

### Running with Docker

```bash
# Build the Docker image
docker build -t cterasdk-mcp .

# Run the container
docker run -p 5000:5000 -e MCP_API_TOKEN=your-secret-token cterasdk-mcp
```

## API Endpoints

### GET /api/v1/tools

Returns a list of available tools and their parameters.

### POST /api/v1/run

Executes a tool with the provided parameters.

#### Available Tools

1. **cterasdk_login** - Login to CTERA server
2. **cterasdk_logout** - Logout from CTERA server
3. **cterasdk_list_sessions** - List all active sessions
4. **cterasdk_list_tenants** - List all tenants in the GlobalAdmin portal

## Integration with MCP Gateway

To integrate with MCP Gateway, add this agent to your MCP Gateway configuration file:

```yaml
mcps:
  - name: cterasdk
    url: http://localhost:5000
    api_key: your-secret-token
```

## Development

### Setup Development Environment

```bash
# Clone the repository
git clone https://github.com/yourusername/cterasdk-mcp.git
cd cterasdk-mcp

# Install development dependencies
pip install -e ".[dev]"
``` 