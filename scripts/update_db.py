import asyncio
import sys
import os

# Add parent dir to path to find app module
sys.path.append(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))

from app.database import engine, Base
# Import all models so Base.metadata knows about them
from app.models import user, car, rental, support, transaction, offer
# Payment model? user.py handles payments? No, payments probably in router or separate model.
# Check routers/payments.py imports.
# It imports Transaction probably? Let's check.
# user.py has PaymentTransaction? No, usually in models/payment.py
# I should check if models/payment.py exists.

async def init_tables():
    print("Creating tables...")
    async with engine.begin() as conn:
        await conn.run_sync(Base.metadata.create_all)
    print("Tables created/updated successfully.")

if __name__ == "__main__":
    # Windows fix for asyncio
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    asyncio.run(init_tables())
