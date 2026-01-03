from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import RedirectResponse
from pydantic import BaseModel, EmailStr
import uuid
import random
import logging

from app.database import get_db
from app.models.user import User
from app.schemas.user import (
    UserCreate, UserLogin, GoogleLogin, Token, 
    UserResponse, PasswordRecovery, PasswordReset
)
from app.utils.security import (
    verify_password, get_password_hash, 
    create_access_token, decode_access_token, verify_google_token
)
from app.utils.email import send_verification_email, send_reset_email

# Налаштування логування
logger = logging.getLogger("auth")

router = APIRouter(prefix="/api/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")
oauth2_scheme_optional = OAuth2PasswordBearer(tokenUrl="/api/auth/login", auto_error=False)

# In-memory storage (Для продакшну рекомендується використовувати Redis)
# Формат: {email: {"code": "123456", "token": "uuid", "type": "verify/reset"}}
verification_store = {}

@router.post("/register")
async def register(
    user_data: UserCreate, 
    tasks: BackgroundTasks, 
    db: AsyncSession = Depends(get_db)
):
    logger.info(f"Registering new user: {user_data.email}")
    
    # 1. Перевірка чи існує користувач
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalars().first():
        raise HTTPException(
            status_code=status.HTTP_400_BAD_REQUEST, 
            detail="Email already registered"
        )

    # 2. Створення користувача
    new_user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        name=user_data.name,
        is_verified=False
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)

    # 3. Генерація даних для підтвердження
    code = str(random.randint(100000, 999999))
    token = str(uuid.uuid4())
    verification_store[user_data.email] = {"code": code, "token": token, "type": "verify"}

    # 4. Відправка листа через BackgroundTasks (Фонове завдання)
    # Це вирішує проблему затримок та "мовчазних" падінь під час реєстрації
    tasks.add_task(send_verification_email, user_data.email, code, token)
    
    return {"message": "Registration successful. Please check your email for verification code."}

class VerificationRequest(BaseModel):
    email: EmailStr
    code: str

@router.post("/verify-email")
async def verify_email_code(data: VerificationRequest, db: AsyncSession = Depends(get_db)):
    store_data = verification_store.get(data.email)
    
    if not store_data or store_data["code"] != data.code or store_data["type"] != "verify":
        raise HTTPException(status_code=400, detail="Invalid or expired verification code")
    
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_verified = True
    await db.commit()
    
    # Видаляємо код після успішної перевірки
    del verification_store[data.email]
    
    access_token = create_access_token(subject=user.id)
    return {"message": "Email verified", "access_token": access_token, "token_type": "bearer"}

@router.get("/verify-link")
async def verify_magic_link(token: str, db: AsyncSession = Depends(get_db)):
    email = None
    for em, data in verification_store.items():
        if data.get("token") == token and data.get("type") == "verify":
            email = em
            break
            
    if not email:
        return RedirectResponse(url="/frontend/auth.html?error=invalid_token")
        
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    
    if user:
        user.is_verified = True
        await db.commit()
        if email in verification_store:
            del verification_store[email]
        
        access_token = create_access_token(subject=user.id)
        return RedirectResponse(url=f"/frontend/dashboard.html#token={access_token}")
        
    return RedirectResponse(url="/frontend/auth.html?error=user_not_found")

@router.post("/forgot-password")
async def forgot_password(
    data: PasswordRecovery, 
    tasks: BackgroundTasks, 
    db: AsyncSession = Depends(get_db)
):
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")

    code = str(random.randint(100000, 999999))
    verification_store[data.email] = {"code": code, "type": "reset"}
    
    tasks.add_task(send_reset_email, data.email, code)
    
    return {"message": "Password reset code sent"}

@router.post("/reset-password")
async def reset_password(data: PasswordReset, db: AsyncSession = Depends(get_db)):
    stored = verification_store.get(data.email)
    if not stored or stored["code"] != data.code or stored["type"] != "reset":
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.password_hash = get_password_hash(data.new_password)
    await db.commit()
    
    del verification_store[data.email]
    return {"message": "Password updated successfully"}

@router.post("/login", response_model=Token)
async def login(login_data: UserLogin, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(User).where(User.email == login_data.email))
    user = result.scalars().first()

    if not user or not user.password_hash or not verify_password(login_data.password, user.password_hash):
        raise HTTPException(status_code=400, detail="Incorrect email or password")
        
    if not user.is_verified:
        raise HTTPException(status_code=403, detail="Email not verified. Please check your inbox.")

    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}

@router.post("/google", response_model=Token)
async def google_login(login_data: GoogleLogin, db: AsyncSession = Depends(get_db)):
    google_data = verify_google_token(login_data.token)
    if not google_data:
        raise HTTPException(status_code=400, detail="Invalid Google token")

    email = google_data["email"]
    name = google_data.get("name", "Unknown")
    google_id = google_data["sub"]

    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        user = User(
            email=email,
            name=name,
            google_id=google_id,
            is_verified=True 
        )
        db.add(user)
    else:
        user.google_id = google_id
        
    await db.commit()
    await db.refresh(user)

    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}

async def get_current_user(token: str = Depends(oauth2_scheme), db: AsyncSession = Depends(get_db)):
    payload = decode_access_token(token)
    if not payload:
        raise HTTPException(
            status_code=status.HTTP_401_UNAUTHORIZED,
            detail="Could not validate credentials",
            headers={"WWW-Authenticate": "Bearer"},
        )
    user_id = payload.get("sub")
    
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    
    if user is None:
        raise HTTPException(status_code=401, detail="User not found")
    return user

async def get_current_user_optional(
    token: str = Depends(oauth2_scheme_optional), 
    db: AsyncSession = Depends(get_db)
):
    if not token:
        return None
    try:
        payload = decode_access_token(token)
        if not payload:
            return None
        user_id = payload.get("sub")
        result = await db.execute(select(User).where(User.id == user_id))
        user = result.scalars().first()
        return user
    except Exception:
        return None

async def get_admin_user(current_user: User = Depends(get_current_user)):
    from app.models.user import UserRole
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action"
        )
    return current_user

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user