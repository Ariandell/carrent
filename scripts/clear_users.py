import asyncio
import sys
from pathlib import Path

# Додаємо кореневу директорію до шляху імпорту
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import AsyncSessionLocal
from app.models.user import User
from app.models.rental import Rental
from app.models.transaction import Transaction
from sqlalchemy import delete

async def clear_users():
    async with AsyncSessionLocal() as db:
        print("Видалення всіх сесій та даних користувачів...")
        try:
            # Видаляємо зв'язані дані спочатку через FK constraints
            await db.execute(delete(Rental))
            await db.execute(delete(Transaction))
            # Тепер можна видалити користувачів
            await db.execute(delete(User))
            
            await db.commit()
            print("Всі дані користувачів успішно видалені.")
        except Exception as e:
            print(f"Помилка при видаленні користувачів: {e}")
            await db.rollback()

if __name__ == "__main__":
    asyncio.run(clear_users())
