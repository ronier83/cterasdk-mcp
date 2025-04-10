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

# Basic authentication middleware (this would be replaced with a more robust authentication in production)
def authenticate(req):
    auth_header = req.headers.get('Authorization')
    if not auth_header or not auth_header.startswith('Bearer '):
        return False
    token = auth_header.split('Bearer ')[1]
    # In a real implementation, this would validate against a proper token store
    return token == os.environ.get('MCP_API_TOKEN', 'default-token')

@app.route('/api/v1/tools', methods=['GET'])
def get_tools():
    """Endpoint to list available tools"""
    if not authenticate(request):
        return jsonify({"error": "Unauthorized"}), 401

    tools = [
        {
            "name": "cterasdk_login",
            "description": "Login to CTERA server",
            "parameters": {
                "type": "object",
                "properties": {
                    "host": {
                        "type": "string",
                        "description": "Hostname or IP of CTERA server"
                    },
                    "username": {
                        "type": "string",
                        "description": "Username for login"
                    },
                    "password": {
                        "type": "string",
                        "description": "Password for login"
                    },
                    "client_type": {
                        "type": "string",
                        "enum": ["global_admin", "services_portal", "edge"],
                        "description": "Type of client to use",
                        "default": "global_admin"
                    },
                    "ssl_verify": {
                        "type": "boolean",
                        "description": "Verify SSL certificates",
                        "default": False
                    }
                },
                "required": ["host", "username", "password"]
            }
        },
        {
            "name": "cterasdk_logout",
            "description": "Logout from CTERA server",
            "parameters": {
                "type": "object",
                "properties": {
                    "session_key": {
                        "type": "string",
                        "description": "Session key to logout"
                    }
                },
                "required": ["session_key"]
            }
        },
        {
            "name": "cterasdk_list_sessions",
            "description": "List all active sessions",
            "parameters": {
                "type": "object",
                "properties": {}
            }
        },
        {
            "name": "cterasdk_list_tenants",
            "description": "List all tenants in the Global Admin portal",
            "parameters": {
                "type": "object",
                "properties": {
                    "session_key": {
                        "type": "string",
                        "description": "Session key to use (must be a GlobalAdmin session)"
                    }
                },
                "required": ["session_key"]
            }
        }
    ]
    
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
    
    try:
        result = None
        
        if tool_name == "cterasdk_login":
            host = params.get('host')
            username = params.get('username')
            password = params.get('password')
            client_type = params.get('client_type', 'global_admin')
            ssl_verify = params.get('ssl_verify', False)
            
            if not host or not username or not password:
                return jsonify({"error": "Missing required parameters"}), 400
            
            result = core.login(host, username, password, client_type, ssl_verify)
        
        elif tool_name == "cterasdk_logout":
            session_key = params.get('session_key')
            
            if not session_key:
                return jsonify({"error": "Missing required parameters"}), 400
            
            result = core.logout(session_key)
        
        elif tool_name == "cterasdk_list_sessions":
            result = core.list_sessions()
            
        elif tool_name == "cterasdk_list_tenants":
            session_key = params.get('session_key')
            
            if not session_key:
                return jsonify({"error": "Missing required parameters"}), 400
            
            result = core.list_tenants(session_key)
        
        else:
            return jsonify({"error": f"Unknown tool: {tool_name}"}), 404
        
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