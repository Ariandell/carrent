import asyncio
import sys
import os

# Ensure app can be imported
sys.path.append(os.getcwd())

from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from sqlalchemy.future import select

async def make_admin(email: str):
    print(f"Connecting to database to update user: {email}...")
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if not user:
            print(f"❌ User with email '{email}' NOT FOUND.")
            return
        
        print(f"Found user: {user.name} (Current Role: {user.role})")
        user.role = UserRole.ADMIN
        await db.commit()
        print(f"✅ User '{email}' has been successfully promoted to ADMIN.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python make_admin.py <email>")
        sys.exit(1)
    
    email = sys.argv[1]
    asyncio.run(make_admin(email))
