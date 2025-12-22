from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordBearer

from app.database import get_db
from app.models.user import User
from fastapi import APIRouter, Depends, HTTPException, status, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from fastapi.security import OAuth2PasswordBearer
from fastapi.responses import RedirectResponse
import uuid

from app.database import get_db
from app.models.user import User
from pydantic import BaseModel, EmailStr
from app.schemas.user import UserCreate, UserLogin, GoogleLogin, Token, UserResponse, PasswordRecovery, PasswordReset
from app.utils.security import verify_password, get_password_hash, create_access_token, decode_access_token, verify_google_token
from app.utils.email import send_verification_email, send_reset_email
import random

router = APIRouter(prefix="/api/auth", tags=["Auth"])
oauth2_scheme = OAuth2PasswordBearer(tokenUrl="/api/auth/login")

# In-memory storage (Replace with Redis in Prod)
# Format: {email: {"code": "123456", "token": "uuid", "type": "verify/reset"}}
verification_store = {}

from app.schemas.user import PasswordRecovery, PasswordReset
import random

# Email sending disabled for development - using console logging
# To enable real email, configure fastapi-mail with SMTP settings

@router.post("/register")
async def register(user_data: UserCreate, tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    import logging
    logger = logging.getLogger("auth.register")
    logger.setLevel(logging.INFO)
    handler = logging.StreamHandler()
    handler.setLevel(logging.INFO)
    logger.addHandler(handler)
    
    logger.info(f"=== REGISTER REQUEST for {user_data.email} ===")
    
    # Check if user exists
    result = await db.execute(select(User).where(User.email == user_data.email))
    if result.scalars().first():
        logger.warning(f"User {user_data.email} already exists!")
        raise HTTPException(status_code=400, detail="Email already registered")

    new_user = User(
        email=user_data.email,
        password_hash=get_password_hash(user_data.password),
        name=user_data.name,
        is_verified=False # Enforce verification
    )
    db.add(new_user)
    await db.commit()
    await db.refresh(new_user)
    logger.info(f"User {user_data.email} created successfully")

    # Generate Verification Data
    code = str(random.randint(100000, 999999))
    token = str(uuid.uuid4())
    verification_store[user_data.email] = {"code": code, "token": token, "type": "verify"}
    logger.info(f"Generated code {code} for {user_data.email}")

    # Send Email (Directly await for debugging)
    logger.info(f">>> SENDING EMAIL to {user_data.email} <<<")
    try:
        await send_verification_email(user_data.email, code, token)
        logger.info(f">>> EMAIL SENT SUCCESSFULLY to {user_data.email} <<<")
    except Exception as e:
        logger.error(f">>> EMAIL FAILED: {e} <<<")
    
    return {"message": "Registration successful. Please verify your email."}

class VerificationRequest(BaseModel):
    email: EmailStr
    code: str

@router.post("/verify-email")
async def verify_email_code(data: VerificationRequest, db: AsyncSession = Depends(get_db)):
    store_data = verification_store.get(data.email)
    if not store_data or store_data["code"] != data.code or store_data["type"] != "verify":
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # Verify User
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    user.is_verified = True
    await db.commit()
    
    # Cleanup
    del verification_store[data.email]
    
    # Return login token immediately for seamless UX?
    access_token = create_access_token(subject=user.id)
    return {"message": "Email verified", "access_token": access_token, "token_type": "bearer"}

@router.get("/verify-link")
async def verify_magic_link(token: str, db: AsyncSession = Depends(get_db)):
    # Find email by token (Inefficient for scale, but fine for prototype with in-memory dict)
    email = None
    for em, data in verification_store.items():
        if data.get("token") == token and data.get("type") == "verify":
            email = em
            break
            
    if not email:
        # Redirect to error page or login with error
        return RedirectResponse(url="/frontend/auth.html?error=invalid_token")
        
    # Verify User
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()
    if user:
        user.is_verified = True
        await db.commit()
        del verification_store[email]
        
        # Login and Redirect
        access_token = create_access_token(subject=user.id)
        # Redirect to dashboard with token hash
        return RedirectResponse(url=f"/frontend/dashboard.html#token={access_token}")
        
    return RedirectResponse(url="/frontend/auth.html?error=user_not_found")

@router.post("/forgot-password")
async def forgot_password(data: PasswordRecovery, tasks: BackgroundTasks, db: AsyncSession = Depends(get_db)):
    # 1. Check if user exists
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()
    if not user:
        # Don't reveal user existence? For now, standard 404 is fine for UX
        raise HTTPException(status_code=404, detail="User not found")

    # 2. Generate Code
    code = str(random.randint(100000, 999999))
    verification_store[data.email] = {"code": code, "type": "reset"}
    
    # 3. Send Email
    tasks.add_task(send_reset_email, data.email, code)
    
    return {"message": "Reset code sent"}

@router.post("/reset-password")
async def reset_password(data: PasswordReset, db: AsyncSession = Depends(get_db)):
    # 1. Verify Code
    stored = verification_store.get(data.email)
    if not stored or stored["code"] != data.code or stored["type"] != "reset":
        raise HTTPException(status_code=400, detail="Invalid verification code")
    
    # 2. Update Password
    result = await db.execute(select(User).where(User.email == data.email))
    user = result.scalars().first()
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    user.password_hash = get_password_hash(data.new_password)
    await db.commit()
    
    # 3. Clear code
    del verification_store[data.email]
    
    return {"message": "Password updated successfully"}

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

async def get_admin_user(current_user: User = Depends(get_current_user)):
    from app.models.user import UserRole
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action"
        )
    return current_user

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
    avatar_url = google_data.get("picture", "")
    google_id = google_data["sub"]

    # Check existence
    result = await db.execute(select(User).where(User.email == email))
    user = result.scalars().first()

    if not user:
        # Create new user
        user = User(
            email=email,
            name=name,
            avatar_url=avatar_url,
            google_id=google_id
        )
        db.add(user)
        await db.commit()
        await db.refresh(user)
    else:
        # Update google_id if missing or changed
        if not user.google_id:
            user.google_id = google_id
            await db.commit()

    access_token = create_access_token(subject=user.id)
    return {"access_token": access_token, "token_type": "bearer"}

@router.get("/me", response_model=UserResponse)
async def read_users_me(current_user: User = Depends(get_current_user)):
    return current_user
