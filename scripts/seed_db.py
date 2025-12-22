import asyncio
import sys
from pathlib import Path

# Add parent directory to path so 'app' module can be found
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import AsyncSessionLocal
from app.models.user import User, UserRole
from app.models.car import Car, CarStatus
from app.utils.security import get_password_hash

async def seed_data():
    async with AsyncSessionLocal() as db:
        print("Seeding data...")

        # 1. Create Admin
        admin_email = "admin@fpv.com"
        # Check if exists
        # (Skipping exist check for brevity, assuming fresh DB or handle uniqueness error)
        try:
            admin = User(
                email=admin_email,
                name="Super Admin",
                password_hash=get_password_hash("admin123"),
                role=UserRole.ADMIN,
                balance_minutes=9999
            )
            db.add(admin)
            print(f"Created Admin: {admin_email} / admin123")
        except Exception:
            print("Admin might already exist, skipping.")

        # 2. Create User
        user_email = "racer@fpv.com"
        try:
            user = User(
                email=user_email,
                name="Speedy Racer",
                password_hash=get_password_hash("racer123"),
                role=UserRole.USER,
                balance_minutes=15
            )
            db.add(user)
            print(f"Created User: {user_email} / racer123")
        except Exception:
            print("User might already exist, skipping.")

        # 3. Create Cars
        cars = [
            Car(
                name="Hummer H1",
                raspberry_id="pi_car_01",
                vdo_ninja_id="view_id_01",
                status=CarStatus.FREE,
                description="Heavy duty off-roader"
            ),
            Car(
                name="Buggy V2",
                raspberry_id="pi_car_02",
                vdo_ninja_id="view_id_02",
                status=CarStatus.BUSY, # Simulate busy
                description="High speed buggy"
            )
        ]

        for car in cars:
            # Check by raspberry_id to avoid dupes if running multiple times logic needed
            # For now, simplistic approach
            db.add(car)
            print(f"Created Car: {car.name}")
        
        try:
            await db.commit()
            print("Seeding complete!")
        except Exception as e:
            print(f"Error committing: {e}")
            await db.rollback()

if __name__ == "__main__":
    import sys
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    try:
        asyncio.run(seed_data())
    except Exception as e:
        print(f"An error occurred: {e}")
