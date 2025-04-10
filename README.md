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

# Create and activate virtual environment
python -m venv .venv
source .venv/bin/activate  # On Windows: .venv\Scripts\activate

# Install development dependencies
pip install -e ".[dev]"
```

### Adding New Commands

To add a new command to the API, follow these steps:

1. Add a new function in `src/cterasdk_mcp/core.py`:

```python
def your_new_command(host: str, username: str, password: str, arg1: str, arg2: bool = False) -> Dict[str, Any]:
    """
    Description of your new command
    
    Args:
        host: The hostname or IP of the CTERA server
        username: The username to authenticate with
        password: The password to authenticate with
        arg1: Description of arg1
        arg2: Description of arg2
        
    Returns:
        Dictionary with result data
    """
    try:
        with get_client(host, username, password, 'global_admin', not arg2) as client:
            # Your command implementation here
            result = client.some_operation(arg1)
            
            return {
                "success": True,
                "data": result
            }
    
    except Exception as e:
        logger.error(f"Command failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }
```

2. Update the `__init__.py` to expose your new function:

```python
from .core import login_test, list_tenants, your_new_command
```

3. Register your command in the `COMMANDS` registry in `src/cterasdk_mcp/agent.py`:

```python
COMMANDS = {
    # ... existing commands ...
    "cterasdk_your_command": {
        "function": core.your_new_command,
        "required_params": ["host", "username", "password", "arg1"],
        "optional_params": {
            "arg2": False,
        },
        "description": "Description of your new command"
    }
}
```

That's it! Your new command will be automatically added to the API documentation and will be accessible via the `/api/v1/run` endpoint. 