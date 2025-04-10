#!/usr/bin/env python3
import json
import argparse
import logging
from . import core

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("cterasdk_mcp.cli")

def handle_command(args):
    """Process the command line arguments and execute the appropriate function"""
    if args.command == 'login':
        result = core.login(args.host, args.username, args.password, args.client_type, args.ssl_verify)
    elif args.command == 'logout':
        result = core.logout(args.session_key)
    elif args.command == 'list_sessions':
        result = core.list_sessions()
    elif args.command == 'list_tenants':
        result = core.list_tenants(args.session_key)
    else:
        result = {"success": False, "error": f"Unknown command: {args.command}"}
    
    print(json.dumps(result, indent=2))

def main():
    parser = argparse.ArgumentParser(description='CTERA SDK MCP Agent')
    subparsers = parser.add_subparsers(dest='command', help='Command to execute')
    
    # Login command
    login_parser = subparsers.add_parser('login', help='Login to CTERA server')
    login_parser.add_argument('--host', required=True, help='Hostname or IP of CTERA server')
    login_parser.add_argument('--username', required=True, help='Username for login')
    login_parser.add_argument('--password', required=True, help='Password for login')
    login_parser.add_argument('--client-type', choices=['global_admin', 'services_portal', 'edge'], 
                              default='global_admin', help='Type of client to use')
    login_parser.add_argument('--ssl-verify', action='store_true', default=False, 
                              help='Verify SSL certificates')
    
    # Logout command
    logout_parser = subparsers.add_parser('logout', help='Logout from CTERA server')
    logout_parser.add_argument('--session-key', required=True, help='Session key to logout')
    
    # List sessions command
    subparsers.add_parser('list_sessions', help='List all active sessions')
    
    # List tenants command
    tenants_parser = subparsers.add_parser('list_tenants', help='List all tenants in the Global Admin portal')
    tenants_parser.add_argument('--session-key', required=True, help='Session key to use')
    
    args = parser.parse_args()
    
    if not args.command:
        parser.print_help()
        return
    
    handle_command(args)

if __name__ == '__main__':
    main() 