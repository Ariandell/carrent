from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import selectinload
from sqlalchemy import func, and_, delete
from pydantic import BaseModel
from typing import List, Optional
from datetime import datetime, timedelta
import uuid

from app.database import get_db
from app.models.offer import RentalOffer
from app.models.user import User
from app.models.car import Car
from app.models.rental import Rental, RentalStatus
from app.models.transaction import Transaction, TransactionStatus
from app.routers.auth import get_admin_user

router = APIRouter(prefix="/api/admin", tags=["Admin"])

# ===== Pydantic Schemas =====

class OfferBase(BaseModel):
    name: str
    duration_minutes: int
    price: float
    description: Optional[str] = None
    is_active: bool = True

class OfferCreate(OfferBase):
    pass

class OfferResponse(OfferBase):
    id: uuid.UUID
    
    class Config:
        from_attributes = True

class UserSummary(BaseModel):
    id: uuid.UUID
    email: str
    name: str
    balance_minutes: int
    role: str
    is_verified: bool
    created_at: datetime
    total_rentals: int
    total_spent: float
    
    class Config:
        from_attributes = True

class TransactionResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: Optional[str] = None
    user_email: Optional[str] = None
    amount_uah: float
    minutes_added: int
    status: str
    created_at: datetime
    
    class Config:
        from_attributes = True

class RentalResponse(BaseModel):
    id: uuid.UUID
    user_id: uuid.UUID
    user_name: Optional[str] = None
    car_id: uuid.UUID
    car_name: Optional[str] = None
    started_at: datetime
    duration_minutes: int
    ended_at: Optional[datetime] = None
    status: str
    rating: Optional[int] = None
    
    class Config:
        from_attributes = True

class CarWithDriver(BaseModel):
    id: uuid.UUID
    name: str
    status: str
    battery_level: int
    current_driver_id: Optional[uuid.UUID] = None
    current_driver_name: Optional[str] = None
    current_driver_email: Optional[str] = None
    rental_started_at: Optional[datetime] = None
    rental_ends_at: Optional[datetime] = None
    
    class Config:
        from_attributes = True

class DashboardStats(BaseModel):
    total_users: int
    total_rentals: int
    active_rentals: int
    total_revenue: float
    revenue_today: float
    total_cars: int
    online_cars: int

class UserHistory(BaseModel):
    user: UserSummary
    rentals: List[RentalResponse]
    transactions: List[TransactionResponse]

# ===== Dashboard Stats =====

@router.get("/stats", response_model=DashboardStats)
async def get_dashboard_stats(db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    # Total users
    users_count = await db.execute(select(func.count(User.id)))
    total_users = users_count.scalar() or 0
    
    # Total rentals
    rentals_count = await db.execute(select(func.count(Rental.id)))
    total_rentals = rentals_count.scalar() or 0
    
    # Active rentals
    active_count = await db.execute(
        select(func.count(Rental.id)).where(Rental.status == RentalStatus.ACTIVE)
    )
    active_rentals = active_count.scalar() or 0
    
    # Total revenue (successful transactions)
    revenue_result = await db.execute(
        select(func.sum(Transaction.amount_uah)).where(Transaction.status == TransactionStatus.SUCCESS)
    )
    total_revenue = float(revenue_result.scalar() or 0)
    
    # Revenue today
    today_start = datetime.utcnow().replace(hour=0, minute=0, second=0, microsecond=0)
    today_revenue = await db.execute(
        select(func.sum(Transaction.amount_uah)).where(
            and_(
                Transaction.status == TransactionStatus.SUCCESS,
                Transaction.created_at >= today_start
            )
        )
    )
    revenue_today = float(today_revenue.scalar() or 0)
    
    # Cars stats
    cars_count = await db.execute(select(func.count(Car.id)))
    total_cars = cars_count.scalar() or 0
    
    online_count = await db.execute(
        select(func.count(Car.id)).where(Car.status != 'offline')
    )
    online_cars = online_count.scalar() or 0
    
    return DashboardStats(
        total_users=total_users,
        total_rentals=total_rentals,
        active_rentals=active_rentals,
        total_revenue=total_revenue,
        revenue_today=revenue_today,
        total_cars=total_cars,
        online_cars=online_cars
    )

# ===== Users Management =====

@router.get("/users", response_model=List[UserSummary])
async def list_users(db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    result = await db.execute(
        select(User).options(selectinload(User.rentals), selectinload(User.transactions))
    )
    users = result.scalars().all()
    
    return [
        UserSummary(
            id=u.id,
            email=u.email,
            name=u.name,
            balance_minutes=u.balance_minutes,
            role=u.role.value if hasattr(u.role, 'value') else str(u.role),
            is_verified=u.is_verified,
            created_at=u.created_at,
            total_rentals=len(u.rentals),
            total_spent=sum(t.amount_uah for t in u.transactions if t.status == TransactionStatus.SUCCESS)
        )
        for u in users
    ]

@router.delete("/users/{user_id}")
async def delete_user(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    # Get user
    result = await db.execute(select(User).where(User.id == user_id))
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
        
    # Delete related data first (Manual Cascade)
    await db.execute(delete(Transaction).where(Transaction.user_id == user_id))
    await db.execute(delete(Rental).where(Rental.user_id == user_id))
    
    # Delete support tickets (if any)
    # Note: SupportTicket model might act differently, but good to clean if linked
    from app.models.support import SupportTicket
    await db.execute(delete(SupportTicket).where(SupportTicket.user_id == user_id))
    
    # Delete user
    await db.delete(user)
    await db.commit()
    
    return {"message": "User and all related data deleted successfully"}

@router.get("/users/{user_id}/history", response_model=UserHistory)
async def get_user_history(user_id: uuid.UUID, db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    # Get user with relationships
    result = await db.execute(
        select(User).where(User.id == user_id).options(
            selectinload(User.rentals),
            selectinload(User.transactions)
        )
    )
    user = result.scalars().first()
    
    if not user:
        raise HTTPException(status_code=404, detail="User not found")
    
    # Get rentals with car names
    rentals_result = await db.execute(
        select(Rental, Car.name).join(Car).where(Rental.user_id == user_id).order_by(Rental.started_at.desc())
    )
    rentals_data = rentals_result.all()
    
    rentals = [
        RentalResponse(
            id=r.Rental.id,
            user_id=r.Rental.user_id,
            car_id=r.Rental.car_id,
            car_name=r.name,
            started_at=r.Rental.started_at,
            duration_minutes=r.Rental.duration_minutes,
            ended_at=r.Rental.ended_at,
            status=r.Rental.status.value if hasattr(r.Rental.status, 'value') else str(r.Rental.status),
            rating=r.Rental.rating
        )
        for r in rentals_data
    ]
    
    transactions = [
        TransactionResponse(
            id=t.id,
            user_id=t.user_id,
            amount_uah=float(t.amount_uah),
            minutes_added=t.minutes_added,
            status=t.status.value if hasattr(t.status, 'value') else str(t.status),
            created_at=t.created_at
        )
        for t in sorted(user.transactions, key=lambda x: x.created_at, reverse=True)
    ]
    
    user_summary = UserSummary(
        id=user.id,
        email=user.email,
        name=user.name,
        balance_minutes=user.balance_minutes,
        role=user.role.value if hasattr(user.role, 'value') else str(user.role),
        is_verified=user.is_verified,
        created_at=user.created_at,
        total_rentals=len(user.rentals),
        total_spent=sum(t.amount_uah for t in user.transactions if t.status == TransactionStatus.SUCCESS)
    )
    
    return UserHistory(user=user_summary, rentals=rentals, transactions=transactions)

# ===== Transactions =====

@router.get("/transactions", response_model=List[TransactionResponse])
async def list_transactions(
    limit: int = 50,
    db: AsyncSession = Depends(get_db), 
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(
        select(Transaction, User.name, User.email)
        .join(User)
        .order_by(Transaction.created_at.desc())
        .limit(limit)
    )
    transactions = result.all()
    
    return [
        TransactionResponse(
            id=t.Transaction.id,
            user_id=t.Transaction.user_id,
            user_name=t.name,
            user_email=t.email,
            amount_uah=float(t.Transaction.amount_uah),
            minutes_added=t.Transaction.minutes_added,
            status=t.Transaction.status.value if hasattr(t.Transaction.status, 'value') else str(t.Transaction.status),
            created_at=t.Transaction.created_at
        )
        for t in transactions
    ]

# ===== Cars with Current Drivers =====

@router.get("/cars/active", response_model=List[CarWithDriver])
async def get_cars_with_drivers(db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    # Get all cars
    cars_result = await db.execute(select(Car))
    cars = cars_result.scalars().all()
    
    result = []
    for car in cars:
        # Find active rental for this car
        rental_result = await db.execute(
            select(Rental, User.name, User.email)
            .join(User)
            .where(and_(Rental.car_id == car.id, Rental.status == RentalStatus.ACTIVE))
        )
        active_rental = rental_result.first()
        
        car_data = CarWithDriver(
            id=car.id,
            name=car.name,
            status=car.status.value if hasattr(car.status, 'value') else str(car.status),
            battery_level=car.battery_level
        )
        
        if active_rental:
            rental, driver_name, driver_email = active_rental
            car_data.current_driver_id = rental.user_id
            car_data.current_driver_name = driver_name
            car_data.current_driver_email = driver_email
            car_data.rental_started_at = rental.started_at
            car_data.rental_ends_at = rental.started_at + timedelta(minutes=rental.duration_minutes + rental.extended_minutes)
        
        result.append(car_data)
    
    return result

# ===== Offers CRUD (existing) =====

@router.get("/offers", response_model=List[OfferResponse])
async def list_all_offers(db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    result = await db.execute(select(RentalOffer).order_by(RentalOffer.price))
    return result.scalars().all()

@router.post("/offers", response_model=OfferResponse)
async def create_offer(offer: OfferCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    new_offer = RentalOffer(**offer.dict())
    db.add(new_offer)
    await db.commit()
    await db.refresh(new_offer)
    return new_offer

@router.put("/offers/{offer_id}", response_model=OfferResponse)
async def update_offer(offer_id: uuid.UUID, offer: OfferCreate, db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    result = await db.execute(select(RentalOffer).where(RentalOffer.id == offer_id))
    db_offer = result.scalars().first()
    if not db_offer:
        raise HTTPException(status_code=404, detail="Offer not found")
    
    for key, value in offer.dict().items():
        setattr(db_offer, key, value)
        
    await db.commit()
    await db.refresh(db_offer)
    return db_offer

@router.delete("/offers/{offer_id}")
async def delete_offer(offer_id: uuid.UUID, db: AsyncSession = Depends(get_db), admin: User = Depends(get_admin_user)):
    result = await db.execute(select(RentalOffer).where(RentalOffer.id == offer_id))
    db_offer = result.scalars().first()
    if not db_offer:
        raise HTTPException(status_code=404, detail="Offer not found")
        
    await db.delete(db_offer)
    await db.commit()
    return {"message": "Offer deleted"}

