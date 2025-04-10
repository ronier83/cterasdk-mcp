#!/usr/bin/env python3
import logging
from typing import Dict, Any
import contextlib
import asyncio

import cterasdk.settings
from cterasdk import GlobalAdmin, ServicesPortal, Edge
from cterasdk.exceptions import CTERAException

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("cterasdk_mcp")

# Helper context manager for client sessions
@contextlib.contextmanager
def get_client(host: str, username: str, password: str, client_type: str = 'global_admin', ssl_verify: bool = True):
    """Context manager to create a client, login, and automatically logout"""
    # Create a new event loop for this thread
    try:
        loop = asyncio.get_event_loop()
    except RuntimeError:
        loop = asyncio.new_event_loop()
        asyncio.set_event_loop(loop)
    
    cterasdk.settings.sessions.management.ssl = ssl_verify
    
    # Select the appropriate client type
    client_class = {
        'global_admin': GlobalAdmin,
        'services_portal': ServicesPortal,
        'edge': Edge
    }.get(client_type)
    
    if not client_class:
        raise ValueError(f"Invalid client type: {client_type}")
    
    # Create client and login
    client = client_class(host)
    try:
        client.login(username, password)
        yield client
    finally:
        try:
            client.logout()
        except Exception as e:
            logger.warning(f"Error during logout: {str(e)}")

def login_test(host: str, username: str, password: str, client_type: str = 'global_admin', ssl_verify: bool = True) -> Dict[str, Any]:
    """
    Test login credentials without maintaining a session
    
    Args:
        host: The hostname or IP of the CTERA server
        username: The username to authenticate with
        password: The password to authenticate with
        client_type: The type of client to use (global_admin, services_portal, or edge)
        ssl_verify: Whether to verify SSL certificates
        
    Returns:
        Dictionary with login test result
    """
    try:
        with get_client(host, username, password, client_type, ssl_verify) as client:
            return {
                "success": True,
                "message": f"Successfully authenticated as {username} to {host}"
            }
    except Exception as e:
        logger.error(f"Login test failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def list_tenants(host: str, username: str, password: str, ssl_verify: bool = False) -> Dict[str, Any]:
    """
    List all tenants in the Global Admin portal
    
    Args:
        host: The hostname or IP of the CTERA server
        username: The username to authenticate with
        password: The password to authenticate with
        ssl_verify: Whether to verify SSL certificates
        
    Returns:
        Dictionary with list of tenants
    """
    try:
        with get_client(host, username, password, 'global_admin', ssl_verify) as admin:
            # Switch to the global admin view before listing tenants
            admin.portals.browse_global_admin()
            
            # Get list of tenants
            tenants = []
            for tenant in admin.portals.list_tenants():
                tenant_data = {
                    "name": tenant.name,
                    "class_name": tenant._classname if hasattr(tenant, '_classname') else None
                }
                # Add any additional properties available
                if hasattr(tenant, 'displayName'):
                    tenant_data["display_name"] = tenant.displayName
                if hasattr(tenant, 'tenant'):
                    tenant_data["tenant_id"] = tenant.tenant
                    
                tenants.append(tenant_data)
            
            return {
                "success": True,
                "tenants": tenants
            }
    
    except CTERAException as e:
        logger.error(f"Failed to list tenants: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }
    except Exception as e:
        logger.error(f"Error listing tenants: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        } 