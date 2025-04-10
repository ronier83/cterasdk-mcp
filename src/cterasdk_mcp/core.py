#!/usr/bin/env python3
import logging
from typing import Dict, Any, Optional

import cterasdk.settings
from cterasdk import GlobalAdmin, ServicesPortal, Edge
from cterasdk.exceptions import CTERAException

# Configure logging
logging.basicConfig(level=logging.INFO, format='%(asctime)s - %(name)s - %(levelname)s - %(message)s')
logger = logging.getLogger("cterasdk_mcp")

# Session store - this would be replaced with a more robust solution in production
SESSION_STORE = {}

def login(host: str, username: str, password: str, client_type: str = 'global_admin', ssl_verify: bool = True) -> Dict[str, Any]:
    """
    Log in to a CTERA server and store the session
    
    Args:
        host: The hostname or IP of the CTERA server
        username: The username to authenticate with
        password: The password to authenticate with
        client_type: The type of client to use (global_admin, services_portal, or edge)
        ssl_verify: Whether to verify SSL certificates
        
    Returns:
        Dictionary with login status and session ID
    """
    cterasdk.settings.sessions.management.ssl = ssl_verify
    
    # Select the appropriate client type
    client_class = {
        'global_admin': GlobalAdmin,
        'services_portal': ServicesPortal,
        'edge': Edge
    }.get(client_type)
    
    if not client_class:
        return {"success": False, "error": f"Invalid client type: {client_type}"}
    
    try:
        # Create client and login
        client = client_class(host)
        client.login(username, password)
        
        # Get the session ID
        session_id = client.get_session_id()
        
        # Store the session information
        session_key = f"{host}:{client_type}:{username}"
        SESSION_STORE[session_key] = {
            "session_id": session_id,
            "host": host,
            "username": username,
            "client_type": client_type
        }
        
        # Don't logout as we want to keep the session active
        return {
            "success": True,
            "message": f"Successfully logged in as {username} to {host}",
            "session_id": session_id,
            "session_key": session_key
        }
    
    except Exception as e:
        logger.error(f"Login failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def list_tenants(session_key: str) -> Dict[str, Any]:
    """
    List all tenants in the Global Admin portal
    
    Args:
        session_key: The key for the stored session
        
    Returns:
        Dictionary with list of tenants
    """
    if session_key not in SESSION_STORE:
        return {
            "success": False,
            "error": "Session not found"
        }
    
    session_data = SESSION_STORE[session_key]
    host = session_data["host"]
    client_type = session_data["client_type"]
    
    # This function only works with GlobalAdmin
    if client_type != 'global_admin':
        return {
            "success": False,
            "error": f"Tenant listing is only supported with GlobalAdmin access, not {client_type}"
        }
    
    try:
        # Create client and set session ID
        admin = GlobalAdmin(host)
        admin.set_session_id(session_data["session_id"])
        
        # Switch to the global admin view before listing tenants
        admin.portals.browse_global_admin()
        
        # Get list of tenants
        tenants = []
        for tenant in admin.portals.list_tenants():
            tenants.append({
                "name": tenant.name,
                "display_name": tenant.displayName if hasattr(tenant, 'displayName') else None,
                "tenant_id": tenant.tenant if hasattr(tenant, 'tenant') else None
            })
        
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

def restore_session(session_key: str) -> Optional[Dict[str, Any]]:
    """
    Restore a session using a stored session key
    
    Args:
        session_key: The key for the stored session
        
    Returns:
        Client object if session is restored, None otherwise
    """
    if session_key not in SESSION_STORE:
        return None
    
    session_data = SESSION_STORE[session_key]
    host = session_data["host"]
    client_type = session_data["client_type"]
    session_id = session_data["session_id"]
    
    # Select the appropriate client type
    client_class = {
        'global_admin': GlobalAdmin,
        'services_portal': ServicesPortal,
        'edge': Edge
    }.get(client_type)
    
    if not client_class:
        return None
    
    try:
        # Create client and set session ID
        client = client_class(host)
        client.set_session_id(session_id)
        
        # Verify session is valid by making a test call
        client.whoami()
        
        return client
    except Exception as e:
        logger.error(f"Failed to restore session: {str(e)}")
        return None

def logout(session_key: str) -> Dict[str, Any]:
    """
    Log out from a CTERA server and remove the stored session
    
    Args:
        session_key: The key for the stored session
        
    Returns:
        Dictionary with logout status
    """
    if session_key not in SESSION_STORE:
        return {
            "success": False,
            "error": "Session not found"
        }
    
    try:
        session_data = SESSION_STORE[session_key]
        host = session_data["host"]
        client_type = session_data["client_type"]
        
        # Select the appropriate client type
        client_class = {
            'global_admin': GlobalAdmin,
            'services_portal': ServicesPortal,
            'edge': Edge
        }.get(client_type)
        
        if not client_class:
            return {"success": False, "error": f"Invalid client type: {client_type}"}
        
        # Create client and set session ID
        client = client_class(host)
        client.set_session_id(session_data["session_id"])
        
        # Logout
        client.logout()
        
        # Remove session from store
        del SESSION_STORE[session_key]
        
        return {
            "success": True,
            "message": f"Successfully logged out from {host}"
        }
    
    except Exception as e:
        logger.error(f"Logout failed: {str(e)}")
        return {
            "success": False,
            "error": str(e)
        }

def list_sessions() -> Dict[str, Any]:
    """
    List all stored sessions
    
    Returns:
        Dictionary with session information
    """
    return {
        "success": True,
        "sessions": [
            {
                "session_key": key,
                "host": data["host"],
                "username": data["username"],
                "client_type": data["client_type"]
            }
            for key, data in SESSION_STORE.items()
        ]
    } 