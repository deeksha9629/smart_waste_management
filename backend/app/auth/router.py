from fastapi import APIRouter, HTTPException, status, Depends
from datetime import datetime, timezone

from app.auth.models import UserCreate, UserLogin, UserResponse, Token, VALID_ROLES
from app.auth.utils import (
    hash_password,
    verify_password,
    create_access_token,
    get_current_user,
)
from app.auth.models import TokenData
from app.database import db

router = APIRouter(prefix="/auth", tags=["Authentication"])


@router.post("/register", response_model=Token, status_code=status.HTTP_201_CREATED)
def register(payload: UserCreate):
    if payload.role not in VALID_ROLES:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail=f"Invalid role. Must be one of: {', '.join(VALID_ROLES)}",
        )

    if db.get_user_by_email(payload.email):
        raise HTTPException(
            status_code=status.HTTP_409_CONFLICT,
            detail="Email already registered",
        )

    user_data = {
        "email": payload.email,
        "password_hash": hash_password(payload.password),
        "full_name": payload.full_name,
        "role": payload.role,
        "phone": payload.phone,
        "organization_name": payload.organization_name,
        "is_active": True,
        "is_verified": False,
    }

    try:
        user = db.create_user(user_data)
    except Exception as e:
        err = str(e)
        print(f"[AUTH][register] create_user error: {err}")
        if "permission denied for table users" in err.lower():
            raise HTTPException(
                status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
                detail=(
                    "Database permission error: backend service key cannot write to users table. "
                    "Grant table permissions to service_role in Supabase."
                ),
            )
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Registration failed due to a server error",
        )

    # Initialise citizen token wallet automatically
    if payload.role in ("citizen", "community_group"):
        try:
            db.update_citizen_tokens(user["id"], {"token_balance": 0, "total_earned": 0})
        except Exception:
            pass

    try:
        token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    except Exception as e:
        print(f"[AUTH][register] token creation error: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token creation failed",
        )
    return Token(
        access_token=token,
        user_role=user["role"],
        user_id=str(user["id"]),
        full_name=user["full_name"],
    )


@router.post("/login", response_model=Token)
def login(payload: UserLogin):
    user = db.get_user_by_email(payload.email)
    if not user or not verify_password(payload.password, user["password_hash"]):
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Incorrect email or password",
        )

    if not user.get("is_active", True):
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Account is deactivated",
        )

    # Update last_login timestamp
    try:
        db.update_user(user["id"], {"last_login": datetime.now(timezone.utc).isoformat()})
    except Exception:
        pass

    try:
        token = create_access_token({"sub": str(user["id"]), "role": user["role"]})
    except Exception:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Token creation failed",
        )
    return Token(
        access_token=token,
        user_role=user["role"],
        user_id=str(user["id"]),
        full_name=user["full_name"],
    )


@router.get("/me", response_model=UserResponse)
def get_me(current_user: TokenData = Depends(get_current_user)):
    user = db.get_user_by_id(current_user.user_id)
    if not user:
        raise HTTPException(status_code=status.HTTP_404_NOT_FOUND, detail="User not found")
    return UserResponse(**user)


@router.post("/logout")
def logout():
    # JWT is stateless; invalidation is handled client-side by discarding the token.
    return {"message": "Logged out successfully. Please discard your token."}
