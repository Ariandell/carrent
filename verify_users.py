import asyncio
import sys
import os

# Fix for Windows asyncio loop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.database import AsyncSessionLocal
from app.models.user import User
from sqlalchemy.future import select

async def verify_users():
    print("Connecting to database...")
    async with AsyncSessionLocal() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print(f"Found {len(users)} users.")
        
        count = 0
        for u in users:
            if not u.is_verified:
                u.is_verified = True
                print(f"Verifying user: {u.email}")
                count += 1
        
        if count > 0:
            await session.commit()
            print(f"Successfully verified {count} users.")
        else:
            print("No unverified users found.")

if __name__ == "__main__":
    try:
        asyncio.run(verify_users())
    except Exception as e:
        print(f"Error: {e}")
