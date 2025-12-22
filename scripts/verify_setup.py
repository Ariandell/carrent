import asyncio
import sys
from pathlib import Path

# Add parent directory to path so 'app' module can be found
sys.path.insert(0, str(Path(__file__).parent.parent))

from sqlalchemy.ext.asyncio import create_async_engine
from sqlalchemy import text
from app.config import settings
from app.utils.security import verify_password, get_password_hash

async def check_db():
    print(f"1. Checking DB config: {settings.DATABASE_URL.split('@')[1] if '@' in settings.DATABASE_URL else 'HIDDEN'}")
    try:
        engine = create_async_engine(settings.DATABASE_URL)
        async with engine.connect() as conn:
            result = await conn.execute(text("SELECT 1"))
            print("   [OK] Database Connection Successful")
            
            # Check Users table
            from app.models.user import User
            # We need a session/select to query
            
    except Exception as e:
        print(f"   [FAIL] Database Error: {e}")
        import traceback
        traceback.print_exc()

async def check_hashing():
    print("\n2. Checking Password Hashing (passlib/bcrypt)")
    try:
        pwd = "test"
        hashed = get_password_hash(pwd)
        is_valid = verify_password(pwd, hashed)
        print(f"   [OK] Hashing works. Hash len: {len(hashed)}")
    except Exception as e:
        print(f"   [FAIL] Hashing Error: {e}")
        import traceback
        traceback.print_exc()

if __name__ == "__main__":
    if sys.platform == 'win32':
        asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())
    
    asyncio.run(check_hashing())
    asyncio.run(check_db())
