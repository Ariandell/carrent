import asyncio
from app.database import async_session
from app.models.user import User
from sqlalchemy.future import select

async def list_users():
    async with async_session() as session:
        result = await session.execute(select(User))
        users = result.scalars().all()
        print(f"Found {len(users)} users:")
        for u in users:
            print(f"ID: {u.id} | Email: {u.email} | Name: {u.name} | Verified: {u.is_verified}")

if __name__ == "__main__":
    asyncio.run(list_users())
