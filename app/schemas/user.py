from pydantic import BaseModel, EmailStr, field_validator
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.user import UserRole

class UserBase(BaseModel):
    email: EmailStr
    name: str

class UserCreate(UserBase):
    password: str

class UserLogin(BaseModel):
    email: EmailStr
    password: str

class PasswordRecovery(BaseModel):
    email: EmailStr

class PasswordReset(BaseModel):
    email: EmailStr
    code: str
    new_password: str

class GoogleLogin(BaseModel):
    token: str

class Token(BaseModel):
    access_token: str
    token_type: str

class UserResponse(UserBase):
    id: UUID
    avatar_url: Optional[str] = None
    balance_minutes: int
    role: str  # String value to ensure proper serialization
    created_at: datetime
    
    @field_validator('role', mode='before')
    @classmethod
    def convert_role(cls, v):
        """Convert UserRole enum to string value"""
        if hasattr(v, 'value'):
            return v.value
        return str(v) if v else 'user'
    
    class Config:
        from_attributes = True
