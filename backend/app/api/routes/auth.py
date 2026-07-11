"""Authentication routes — Telegram login, user profile, role management."""

import logging

from fastapi import APIRouter, Depends, HTTPException, status
from pydantic import BaseModel

from backend.app.core.security import (
    AuthUser,
    CurrentUser,
    AdminOnly,
    create_access_token,
    extract_user_from_init_data,
)
from backend.app.models.user import UserRole
from backend.app.services.user_service import find_or_create_user, get_user_by_telegram_id, update_user_role

logger = logging.getLogger(__name__)
router = APIRouter(prefix="/api/auth", tags=["auth"])


# ─── Request / Response Models ─────────────────────────────────────────────


class LoginRequest(BaseModel):
    init_data: str


class LoginResponse(BaseModel):
    access_token: str
    token_type: str
    user: dict


class UserResponse(BaseModel):
    id: str | None = None
    telegram_id: str | None = None
    first_name: str | None = None
    last_name: str | None = None
    username: str | None = None
    photo_url: str | None = None
    role: str = "user"
    is_active: bool = True


class RoleUpdateRequest(BaseModel):
    role: UserRole


# ─── Routes ────────────────────────────────────────────────────────────────


@router.post("/login", response_model=LoginResponse)
async def login(request: LoginRequest):
    """Authenticate via Telegram WebApp initData.

    Expects JSON body: { "init_data": "<raw initData string>" }
    Validates the HMAC-SHA256 signature, finds or creates a user,
    and returns a JWT token.
    """
    if not request.init_data:
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST,
            detail="init_data is required",
        )

    # Validate Telegram init data and extract user info
    telegram_user = extract_user_from_init_data(request.init_data)
    if not telegram_user:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Invalid Telegram authentication data",
        )

    # Find or create user in Google Sheets (or in memory)
    user = find_or_create_user(telegram_user)
    if not user:
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to create or retrieve user",
        )

    # Determine role
    role_str = user.get("role", "user")
    try:
        role = UserRole(role_str)
    except ValueError:
        role = UserRole.USER

    # Create JWT token
    access_token = create_access_token(
        telegram_id=int(user["telegram_id"]),
        role=role,
    )

    # Build user response (exclude internal fields)
    user_response = {
        "id": str(user.get("id", "")),
        "telegram_id": str(user.get("telegram_id", "")),
        "first_name": user.get("first_name", ""),
        "last_name": user.get("last_name"),
        "username": user.get("username"),
        "photo_url": user.get("photo_url"),
        "role": role.value,
        "is_active": user.get("is_active", "true") == "true",
    }

    return LoginResponse(
        access_token=access_token,
        token_type="bearer",
        user=user_response,
    )


@router.get("/me", response_model=UserResponse)
async def get_me(current_user: CurrentUser):
    """Get current authenticated user's info."""
    user = get_user_by_telegram_id(current_user.telegram_id)
    if not user:
        # Return minimal info from the token
        return UserResponse(
            telegram_id=str(current_user.telegram_id),
            role=current_user.role.value,
        )

    return UserResponse(
        id=str(user.get("id", "")),
        telegram_id=str(user.get("telegram_id", "")),
        first_name=user.get("first_name"),
        last_name=user.get("last_name"),
        username=user.get("username"),
        photo_url=user.get("photo_url"),
        role=current_user.role.value,
        is_active=user.get("is_active", "true") == "true",
    )


@router.get("/admin/users")
async def list_users(admin: AdminOnly):
    """List all users (admin only)."""
    from backend.app.services.user_service import _get_users_repo

    repo = _get_users_repo()
    if not repo:
        return {"users": []}

    try:
        users = repo.get_all()
        return {"users": users}
    except Exception as e:
        logger.error(f"Failed to list users: {e}")
        raise HTTPException(
            status_code=status.HTTP_500_INTERNAL_SERVER_ERROR,
            detail="Failed to list users",
        )


@router.put("/admin/users/{telegram_id}/role")
async def set_user_role(telegram_id: int, body: RoleUpdateRequest, admin: AdminOnly):
    """Update a user's role (admin or owner).

    Expects JSON body: { "role": "admin" | "tester" | "user" }
    Only Owner can assign the 'owner' role.
    """
    # Prevent non-owner from assigning the owner role
    if not admin.is_owner() and body.role == UserRole.OWNER:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="Only the system owner can assign the owner role",
        )
    success = update_user_role(telegram_id, body.role.value)
    if not success:
        raise HTTPException(
            status_code=status.HTTP_404_NOT_FOUND,
            detail="User not found",
        )
    return {"status": "ok", "telegram_id": telegram_id, "role": body.role.value}
