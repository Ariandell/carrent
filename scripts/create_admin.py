import asyncio
import sys
from pathlib import Path

# Add parent directory to path so 'app' module can be found
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.future import select
from app.database import AsyncSessionLocal
from app.models.user import User, UserRole

async def make_admin(email: str):
    async with AsyncSessionLocal() as db:
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if not user:
            print(f"User {email} not found!")
            return

        user.role = UserRole.ADMIN
        await db.commit()
        print(f"User {email} is now an ADMIN.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python create_admin.py <email>")
    else:
        asyncio.run(make_admin(sys.argv[1]))
