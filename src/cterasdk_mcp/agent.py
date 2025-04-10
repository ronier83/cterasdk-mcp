#!/usr/bin/env python3
import os
import logging
import argparse
import traceback
from flask import Flask, request, jsonify

# Import our core functions
from . import core

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("cterasdk_mcp.agent")

app = Flask(__name__)

# Command registry - makes it easy to add new commands
COMMANDS = {
    "cterasdk_login_test": {
        "function": core.login_test,
        "required_params": ["host", "username", "password"],
        "optional_params": {
            "client_type": "global_admin",
            "ssl_verify": False
        },
        "description": "Test login to CTERA server"
    },
    "cterasdk_list_tenants": {
        "function": core.list_tenants,
        "required_params": ["host", "username", "password"],
        "optional_params": {
            "ssl_verify": False
        },
        "description": "List all tenants in the Global Admin portal"
    }
}

# Basic authentication middleware
def authenticate(req):
    auth_header = req.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return False
    token = auth_header.split('Bearer ')[1]
    return token == os.environ.get('MCP_API_TOKEN', 'default-token')

@app.route('/api/v1/tools', methods=['GET'])
def get_tools():
    """Endpoint to list available tools"""
    if not authenticate(request):
        return jsonify({"error": "Unauthorized"}), 401

    tools = []
    for name, info in COMMANDS.items():
        tool = {
            "name": name,
            "description": info["description"],
            "parameters": {
                "type": "object",
                "properties": {},
                "required": info["required_params"]
            }
        }
        
        # Add required parameters
        for param in info["required_params"]:
            if param == "host":
                tool["parameters"]["properties"]["host"] = {
                    "type": "string",
                    "description": "Hostname or IP of CTERA server"
                }
            elif param == "username":
                tool["parameters"]["properties"]["username"] = {
                    "type": "string",
                    "description": "Username for login"
                }
            elif param == "password":
                tool["parameters"]["properties"]["password"] = {
                    "type": "string",
                    "description": "Password for login"
                }
        
        # Add optional parameters
        for param, default in info["optional_params"].items():
            if param == "client_type":
                tool["parameters"]["properties"]["client_type"] = {
                    "type": "string",
                    "enum": ["global_admin", "services_portal", "edge"],
                    "description": "Type of client to use",
                    "default": default
                }
            elif param == "ssl_verify":
                tool["parameters"]["properties"]["ssl_verify"] = {
                    "type": "boolean",
                    "description": "Verify SSL certificates",
                    "default": default
                }
        
        tools.append(tool)
    
    return jsonify(tools)

@app.route('/api/v1/run', methods=['POST'])
def run_tool():
    """Endpoint to run a specific tool"""
    if not authenticate(request):
        return jsonify({"error": "Unauthorized"}), 401
    
    data = request.json
    if not data:
        return jsonify({"error": "Missing request body"}), 400
    
    tool_name = data.get('name')
    params = data.get('parameters', {})
    
    if not tool_name:
        return jsonify({"error": "Missing tool name"}), 400
    
    if tool_name not in COMMANDS:
        return jsonify({"error": f"Unknown tool: {tool_name}"}), 404
    
    try:
        command = COMMANDS[tool_name]
        function = command["function"]
        required_params = command["required_params"]
        optional_params = command["optional_params"]
        
        # Check required parameters
        for param in required_params:
            if param not in params:
                return jsonify({"error": f"Missing required parameter: {param}"}), 400
        
        # Add default values for optional parameters if not provided
        for param, default in optional_params.items():
            if param not in params:
                params[param] = default
        
        # Execute the function with parameters
        result = function(**params)
        return jsonify(result)
    
    except Exception as e:
        logger.error(f"Error running tool {tool_name}: {str(e)}")
        logger.error(traceback.format_exc())
        return jsonify({
            "success": False,
            "error": str(e)
        }), 500

def main():
    parser = argparse.ArgumentParser(description='CTERA SDK MCP Agent')
    parser.add_argument('--host', default='0.0.0.0', help='Host to bind to')
    parser.add_argument('--port', type=int, default=5000, help='Port to bind to')
    parser.add_argument('--debug', action='store_true', help='Enable debug mode')
    
    args = parser.parse_args()
    
    logger.info(f"Starting CTERA SDK MCP Agent on {args.host}:{args.port}")
    app.run(host=args.host, port=args.port, debug=args.debug)

if __name__ == '__main__':
    main() 