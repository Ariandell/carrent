from fastapi import APIRouter, Depends
from app.schemas.user import UserResponse
from app.routers.auth import get_current_user
from app.models.user import User

router = APIRouter(prefix="/api/users", tags=["Users"])

@router.get("/profile", response_model=UserResponse)
async def read_user_profile(current_user: User = Depends(get_current_user)):
    return current_user

@router.get("/balance")
async def read_balance(current_user: User = Depends(get_current_user)):
    return {"balance_minutes": current_user.balance_minutes}

from typing import List
from sqlalchemy.future import select
from sqlalchemy.ext.asyncio import AsyncSession
from app.database import get_db
from app.routers.auth import get_admin_user

@router.get("/", response_model=List[UserResponse])
async def read_users(
    skip: int = 0, 
    limit: int = 100, 
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(User).offset(skip).limit(limit))
    users = result.scalars().all()
    return users
