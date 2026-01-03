"""Fix car image URLs to add /frontend prefix"""
import asyncio
import os
from dotenv import load_dotenv
load_dotenv()

import asyncpg

async def fix_urls():
    db_url = os.getenv('DATABASE_URL', '')
    # Convert SQLAlchemy URL to asyncpg format
    db_url = db_url.replace('postgresql+asyncpg://', 'postgresql://')
    
    conn = await asyncpg.connect(db_url)
    result = await conn.execute(
        "UPDATE cars SET image_url = REPLACE(image_url, '/uploads/', '/frontend/uploads/') "
        "WHERE image_url LIKE '/uploads/%'"
    )
    print(f"Result: {result}")
    await conn.close()

asyncio.run(fix_urls())
