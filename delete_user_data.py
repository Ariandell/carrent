import asyncio
import sys
import os

# Ensure app can be imported
sys.path.append(os.getcwd())

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.rental import Rental
from app.models.transaction import Transaction
from sqlalchemy.future import select
from sqlalchemy import delete

async def delete_user_data(email: str):
    print(f"Searching for user with email: {email}...")
    
    async with AsyncSessionLocal() as db:
        # Find user
        result = await db.execute(select(User).where(User.email == email))
        user = result.scalars().first()
        
        if not user:
            print(f"❌ User with email '{email}' NOT FOUND.")
            return
        
        user_id = user.id
        print(f"Found user: {user.name} (ID: {user_id})")
        
        # Delete Transactions
        print("Deleting transactions...")
        t_result = await db.execute(delete(Transaction).where(Transaction.user_id == user_id))
        print(f"Deleted {t_result.rowcount} transactions.")
        
        # Delete Rentals
        print("Deleting rentals...")
        r_result = await db.execute(delete(Rental).where(Rental.user_id == user_id))
        print(f"Deleted {r_result.rowcount} rentals.")
        
        # Delete User
        print("Deleting user account...")
        u_result = await db.execute(delete(User).where(User.id == user_id))
        print(f"Deleted user record.")
        
        await db.commit()
        print(f"✅ All data for '{email}' has been successfully deleted.")

if __name__ == "__main__":
    if len(sys.argv) < 2:
        print("Usage: python delete_user_data.py <email>")
        sys.exit(1)
    
    email = sys.argv[1]
    asyncio.run(delete_user_data(email))
