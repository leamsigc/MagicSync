import httpx
from fastapi import HTTPException, status, Depends
from fastapi.security import HTTPBearer, HTTPAuthorizationCredentials
from typing import Optional
from app.core.config import settings


security = HTTPBearer(auto_error=False)

_auth_client: Optional[httpx.AsyncClient] = None


def get_auth_client() -> httpx.AsyncClient:
    global _auth_client
    if _auth_client is None or _auth_client.is_closed:
        _auth_client = httpx.AsyncClient(timeout=10.0)
    return _auth_client


async def validate_session(token: str) -> dict:
    """Validate session token against Better Auth on the Nuxt server."""
    client = get_auth_client()
    try:
        response = await client.get(
            f"{settings.better_auth_url}/api/auth/get-session",
            headers={
                "Cookie": f"better-auth.session_token={token}",
                "Authorization": f"Bearer {token}",
            },
        )
        if response.status_code == 200:
            data = response.json()
            if data and "user" in data:
                return data["user"]
        return {}
    except httpx.RequestError:
        return {}


async def get_current_user(
    credentials: Optional[HTTPAuthorizationCredentials] = Depends(security),
) -> dict:
    """Extract and validate user session from Better Auth."""
    if not credentials:
        return {"id": "anonymous", "email": "anonymous@example.com"}

    user = await validate_session(credentials.credentials)
    if not user or not user.get("id"):
        return {"id": "anonymous", "email": "anonymous@example.com"}

    return user


def require_user(user: dict = Depends(get_current_user)) -> dict:
    """Dependency to require authenticated user."""
    if not user or user.get("id") == "anonymous":
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Authentication required",
        )
    return user
