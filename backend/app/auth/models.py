from pydantic import BaseModel, EmailStr
from typing import Optional
from datetime import datetime

VALID_ROLES = [
    "municipality_admin",
    "municipality_officer",
    "citizen",
    "recycling_manager",
    "recycling_operator",
    "government_agency",
    "private_company",
    "community_group",
]


class UserCreate(BaseModel):
    email: EmailStr
    password: str
    full_name: str
    role: str
    phone: Optional[str] = None
    organization_name: Optional[str] = None

    model_config = {
        "json_schema_extra": {
            "example": {
                "email": "user@example.com",
                "password": "securepassword",
                "full_name": "Jane Doe",
                "role": "citizen",
                "phone": "+1234567890",
                "organization_name": None,
            }
        }
    }


class UserLogin(BaseModel):
    email: EmailStr
    password: str


class UserResponse(BaseModel):
    id: str
    email: str
    full_name: str
    role: str
    is_active: bool
    is_verified: bool
    phone: Optional[str] = None
    organization_name: Optional[str] = None
    profile_image_url: Optional[str] = None
    created_at: Optional[datetime] = None

    model_config = {"from_attributes": True}


class Token(BaseModel):
    access_token: str
    token_type: str = "bearer"
    user_role: str
    user_id: str
    full_name: str


class TokenData(BaseModel):
    user_id: Optional[str] = None
    role: Optional[str] = None
