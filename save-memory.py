#!/usr/bin/env python3
import requests
import json
import sys

def save_memory(memory_text, tags=None):
    """Save a memory to the Mem0 MCP server"""
    if tags is None:
        tags = []
    
    payload = {
        "memory": memory_text,
        "tags": tags
    }
    
    try:
        # Try different possible endpoints
        endpoints = [
            "http://localhost:8050/api/save_memory",
            "http://localhost:8051/api/save_memory",
            "http://localhost:8050/sse/save_memory",
            "http://localhost:8051/sse/save_memory",
            "http://localhost:8050/mem0/save_memory",
            "http://localhost:8051/mem0/save_memory"
        ]
        
        for endpoint in endpoints:
            try:
                print(f"Trying endpoint: {endpoint}")
                response = requests.post(endpoint, json=payload, timeout=5)
                if response.status_code == 200:
                    print(f"Memory saved successfully via {endpoint}")
                    print(f"Response: {response.text}")
                    return True
            except requests.exceptions.RequestException as e:
                print(f"Error with {endpoint}: {e}")
                continue
        
        print("Failed to save memory to any endpoint")
        return False
    
    except Exception as e:
        print(f"Error: {e}")
        return False

if __name__ == "__main__":
    memory_text = """Authentication Bypass Pattern for Vercel Deployments: 
1. The AUTH_BYPASS_ENABLED environment variable controls authentication bypass behavior
2. Disabling middleware with an empty export prevents authentication checks
3. Creating a credential-based public auth provider with fixed anonymous user details
4. Auto-detecting vercel.app deployments in SessionProvider and enabling mock sessions
5. Static HTML fallback pages provide a last resort when all else fails
6. Vercel.json rewrites can redirect authentication routes to the main page
7. Clean build process by removing package locks and caches ensures fresh deployments"""
    
    tags = ["vercel", "deployment", "auth", "bypass", "nextjs", "middleware"]
    
    save_memory(memory_text, tags)