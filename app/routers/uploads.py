from fastapi import APIRouter, UploadFile, File, HTTPException, Depends
from fastapi.responses import FileResponse
import os
import uuid
from pathlib import Path
from app.models.user import User, UserRole
from app.routers.auth import get_current_user
from app.database import get_db
from sqlalchemy.ext.asyncio import AsyncSession

router = APIRouter(prefix="/api/uploads", tags=["Uploads"])

# Directory for car images
UPLOAD_DIR = Path("frontend/uploads/cars")
UPLOAD_DIR.mkdir(parents=True, exist_ok=True)

ALLOWED_EXTENSIONS = {'.png', '.jpg', '.jpeg', '.webp'}
MAX_FILE_SIZE = 10 * 1024 * 1024  # 10MB

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(status_code=403, detail="Admin access required")
    return current_user

@router.post("/car-image")
async def upload_car_image(
    file: UploadFile = File(...),
    admin: User = Depends(get_admin_user)
):
    """Upload a car image (PNG recommended for transparency)"""
    
    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Read and check file size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")
    
    # Generate unique filename
    filename = f"{uuid.uuid4()}{ext}"
    file_path = UPLOAD_DIR / filename
    
    # Save file
    with open(file_path, "wb") as f:
        f.write(contents)
    
    # Return URL path (with /frontend prefix for static serving)
    url = f"/frontend/uploads/cars/{filename}"
    return {"url": url, "filename": filename}

@router.delete("/car-image/{filename}")
async def delete_car_image(
    filename: str,
    admin: User = Depends(get_admin_user)
):
    """Delete a car image"""
    file_path = UPLOAD_DIR / filename
    
    if not file_path.exists():
        raise HTTPException(status_code=404, detail="File not found")
    
    os.remove(file_path)
    return {"message": "Image deleted"}

# Avatar Uploads
AVATAR_DIR = Path("frontend/uploads/avatars")
AVATAR_DIR.mkdir(parents=True, exist_ok=True)

@router.post("/avatar")
async def upload_avatar(
    file: UploadFile = File(...),
    current_user: User = Depends(get_current_user),
    db: AsyncSession = Depends(get_db) # Need DB to update user
):
    """Upload user avatar"""
    # Validate file extension
    ext = os.path.splitext(file.filename)[1].lower()
    if ext not in ALLOWED_EXTENSIONS:
        raise HTTPException(
            status_code=400, 
            detail=f"File type not allowed. Use: {', '.join(ALLOWED_EXTENSIONS)}"
        )
    
    # Check size
    contents = await file.read()
    if len(contents) > MAX_FILE_SIZE:
        raise HTTPException(status_code=400, detail="File too large. Max 10MB.")
    
    # Generate filename with user ID to prevent clutter (or just uuid)
    # Using uuid to avoid caching issues if we just used user_id.png
    filename = f"{current_user.id}_{uuid.uuid4()}{ext}"
    file_path = AVATAR_DIR / filename
    
    # Save
    with open(file_path, "wb") as f:
        f.write(contents)
        
    # Update User Profile
    url = f"/frontend/uploads/avatars/{filename}"
    current_user.avatar_url = url
    await db.commit()
    await db.refresh(current_user)
    
    return {"url": url}
