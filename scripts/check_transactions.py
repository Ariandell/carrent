import asyncio
import sys
from pathlib import Path

# Додаємо кореневу директорію до шляху імпорту
sys.path.insert(0, str(Path(__file__).parent.parent))

from app.database import AsyncSessionLocal
from app.models.transaction import Transaction
from sqlalchemy import select

async def check_transactions():
    async with AsyncSessionLocal() as db:
        print("Отримую список транзакцій...")
        result = await db.execute(select(Transaction).order_by(Transaction.created_at.desc()).limit(5))
        transactions = result.scalars().all()
        
        if not transactions:
            print("Транзакцій не знайдено.")
            return

        for tx in transactions:
            print(f"ID: {tx.id}")
            print(f"LiqPay Order ID: {tx.liqpay_order_id}")
            print(f"Сума: {tx.amount_uah} UAH")
            print(f"Статус: {tx.status}")
            print(f"Створено: {tx.created_at}")
            print("-" * 20)

if __name__ == "__main__":
    asyncio.run(check_transactions())
