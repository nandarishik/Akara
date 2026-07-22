from typing import Annotated
from uuid import UUID

from fastapi import Depends, HTTPException, status
from fastapi.security import HTTPAuthorizationCredentials, HTTPBearer
from jose import JWTError, jwt
from pydantic import BaseModel

from app.core.config import settings


class TokenPayload(BaseModel):
    sub: str  # user UUID from Supabase
    email: str | None = None
    role: str | None = None
    aud: str | None = None


class AuthenticatedUser(BaseModel):
    user_id: UUID
    email: str | None
    role: str | None


_bearer = HTTPBearer()


def decode_supabase_jwt(token: str) -> TokenPayload:
    """Validate and decode a Supabase-issued JWT.
    Raises HTTP 401 on any validation failure.
    """
    try:
        payload = jwt.decode(
            token,
            settings.jwt_secret,
            algorithms=[settings.jwt_algorithm],
            audience="authenticated",
        )
        return TokenPayload(**payload)
    except JWTError as exc:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail=f"Invalid token: {exc}",
            headers={"WWW-Authenticate": "Bearer"},
        ) from exc


def get_current_user(
    credentials: Annotated[HTTPAuthorizationCredentials, Depends(_bearer)],
) -> AuthenticatedUser:
    """FastAPI dependency: validates JWT, returns AuthenticatedUser."""
    payload = decode_supabase_jwt(credentials.credentials)
    return AuthenticatedUser(
        user_id=UUID(payload.sub),
        email=payload.email,
        role=payload.role,
    )


CurrentUser = Annotated[AuthenticatedUser, Depends(get_current_user)]
