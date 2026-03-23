from datetime import datetime, timezone, timedelta
from typing import Optional
from jose import JWTError, jwt
from passlib.context import CryptContext
from fastapi import Depends, HTTPException, status
from fastapi.security import OAuth2PasswordBearer

from app.config import settings
from app.auth.models import TokenData

# Use pbkdf2_sha256 for stable cross-platform hashing with passlib.
# Keep bcrypt in supported schemes so existing bcrypt hashes can still verify.
pwd_context = CryptContext(schemes=["pbkdf2_sha256", "bcrypt"], deprecated="auto")
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/auth/login")

MUNICIPALITY_ROLES = {"municipality_admin", "municipality_officer", "government_agency", "private_company"}
CITIZEN_ROLES = {"citizen", "community_group"}
RECYCLING_ROLES = {"recycling_manager", "recycling_operator"}


# ---------------------------------------------------------------------------
# Password helpers
# ---------------------------------------------------------------------------

def hash_password(password: str) -> str:
    return pwd_context.hash(password)


def verify_password(plain: str, hashed: str) -> bool:
    return pwd_context.verify(plain, hashed)


# ---------------------------------------------------------------------------
# JWT helpers
# ---------------------------------------------------------------------------

def create_access_token(data: dict, expires_delta: Optional[timedelta] = None) -> str:
    to_encode = data.copy()
    expire = datetime.now(timezone.utc) + (
        expires_delta or timedelta(minutes=settings.access_token_expire_minutes)
    )
    to_encode["exp"] = expire
    return jwt.encode(to_encode, settings.secret_key, algorithm=settings.algorithm)


def decode_token(token: str) -> TokenData:
    try:
        payload = jwt.decode(token, settings.secret_key, algorithms=[settings.algorithm])
        user_id: str = payload.get("sub")
        role: str = payload.get("role")
        if user_id is None:
            raise HTTPException(
                status_code=status.HTTP_401_UNAUTHORIZED,
                detail="Invalid token payload",
            )
        return TokenData(user_id=user_id, role=role)
    except JWTError:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )


# ---------------------------------------------------------------------------
# Current user dependency
# ---------------------------------------------------------------------------

def get_current_user(token: str = Depends(oauth2_scheme)) -> TokenData:
    return decode_token(token)


# ---------------------------------------------------------------------------
# Role-based permission checkers
# ---------------------------------------------------------------------------

def require_municipality_role(current_user: TokenData = Depends(get_current_user)) -> TokenData:
    if current_user.role not in MUNICIPALITY_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Municipality role required",
        )
    return current_user


def require_citizen_role(current_user: TokenData = Depends(get_current_user)) -> TokenData:
    if current_user.role not in CITIZEN_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Citizen role required",
        )
    return current_user


def require_recycling_role(current_user: TokenData = Depends(get_current_user)) -> TokenData:
    if current_user.role not in RECYCLING_ROLES:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Recycling plant role required",
        )
    return current_user


def require_any_role(*roles: str):
    """Factory: returns a dependency that accepts any of the given roles."""
    def checker(current_user: TokenData = Depends(get_current_user)) -> TokenData:
        if current_user.role not in roles:
            raise HTTPException(
                status_code=status.HTTP_403_FORBIDDEN,
                detail=f"One of these roles required: {', '.join(roles)}",
            )
        return current_user
    return checker
