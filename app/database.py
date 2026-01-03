from sqlalchemy.ext.asyncio import create_async_engine, AsyncSession
from sqlalchemy.orm import sessionmaker, declarative_base
from app.config import settings

# echo=True prints SQL queries to console, set to False to clean up logs
engine = create_async_engine(settings.DATABASE_URL, echo=False)

AsyncSessionLocal = sessionmaker(
    bind=engine,
    class_=AsyncSession,
    expire_on_commit=False
)

Base = declarative_base()

async def get_db():
    async with AsyncSessionLocal() as session:
        yield session

async def init_db():
    # Import all models to ensure they are registered with Base metadata
    from app.models.user import User
    from app.models.car import Car
    from app.models.rental import Rental
    from app.models.transaction import Transaction
    from app.models.support import SupportTicket
    from app.models.offer import Offer
    from app.models.car_tariff import CarTariff
    
    async with engine.begin() as conn:
        # await conn.run_sync(Base.metadata.drop_all) # Uncomment to reset DB
        await conn.run_sync(Base.metadata.create_all)
