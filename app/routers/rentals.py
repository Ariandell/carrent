from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from datetime import datetime, timedelta
from typing import Optional
from sqlalchemy.orm import joinedload

from app.database import get_db
from app.models.rental import Rental, RentalStatus
from app.models.car import Car, CarStatus
from app.models.user import User
from app.schemas.rental import RentalCreate, RentalResponse, RentalExtend
from app.routers.auth import get_current_user
from app.websocket.manager import manager

router = APIRouter(prefix="/api/rentals", tags=["Rentals"])

from decimal import Decimal

@router.post("/start", response_model=RentalResponse)
async def start_rental(
    rental_data: RentalCreate,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Get Car and Price
    result = await db.execute(select(Car).where(Car.id == rental_data.car_id))
    car = result.scalars().first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    if car.status != CarStatus.FREE:
        raise HTTPException(status_code=409, detail="Car is not available")

    # 2. Calculate Cost (UAH)
    # Use Decimal for financial calculations
    price_per_minute = Decimal(str(car.price_per_minute))
    duration_decimal = Decimal(str(rental_data.duration_minutes))
    total_cost = price_per_minute * duration_decimal
    
    # 3. Check Balance (UAH)
    user_balance = current_user.balance # Already Decimal
    if user_balance < total_cost:
        raise HTTPException(status_code=402, detail=f"Insufficient funds. Required: {total_cost} UAH, Available: {user_balance} UAH")

    # 4. Create Rental
    new_rental = Rental(
        user_id=current_user.id,
        car_id=car.id,
        duration_minutes=rental_data.duration_minutes
    )
    
    # 5. Update Car Status
    car.status = CarStatus.BUSY
    
    # 6. Deduct Balance
    current_user.balance -= total_cost 
    
    db.add(new_rental)
    await db.commit()
    await db.refresh(new_rental)
    
    # Broadcast update (Safe execution)
    try:
        await manager.broadcast_status_update()
        
        # Start Video Stream on Car
        if car.raspberry_id:
            print(f"Sending start_stream to {car.raspberry_id} with ID {car.vdo_ninja_id}")
            await manager.send_command_to_car(car.raspberry_id, f"start_stream|{car.vdo_ninja_id}")
    except Exception as e:
        print(f"⚠️ Warning: Failed to send websocket command: {e}")
        # We do NOT raise an exception here, so the rental is still returned successfully.

    return new_rental

@router.get("/active", response_model=Optional[RentalResponse])
async def get_active_rental(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Rental)
        .options(joinedload(Rental.user), joinedload(Rental.car))
        .where(Rental.user_id == current_user.id)
        .where(Rental.status == RentalStatus.ACTIVE)
        .order_by(Rental.started_at.desc())
    )
    rental = result.scalars().first()

    if rental:
        # Check for Expiry
        # rental.duration_minutes includes extensions
        expiry_time = rental.started_at + timedelta(minutes=rental.duration_minutes)
        
        # Buffer of 10 seconds to avoid race conditions with frontend timer
        if datetime.utcnow() > expiry_time + timedelta(seconds=10):
            print(f"Stats: Rental {rental.id} expired at {expiry_time}. Current: {datetime.utcnow()}. Auto-closing.")
            
            # Close Rental
            rental.status = RentalStatus.COMPLETED
            rental.ended_at = datetime.utcnow()
            
            # Free Car
            result_car = await db.execute(select(Car).where(Car.id == rental.car_id))
            car = result_car.scalars().first()
            if car:
                car.status = CarStatus.FREE
                # Stop Stream
                if car.raspberry_id:
                     await manager.send_command_to_car(car.raspberry_id, "stop_stream")
                     
            await db.commit()
            
            # Broadcast
            await manager.broadcast_status_update()
            
            return None # No active rental anymore

    return rental

@router.post("/stop/{rental_id}", response_model=RentalResponse)
async def stop_rental(
    rental_id: str,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Rental).where(Rental.id == rental_id))
    rental = result.scalars().first()
    
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
        
    if rental.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your rental")
        
    if rental.status != RentalStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Rental already finished")

    # End rental
    rental.status = RentalStatus.COMPLETED
    rental.ended_at = datetime.utcnow()
    
    # Free up car
    result_car = await db.execute(select(Car).where(Car.id == rental.car_id))
    car = result_car.scalars().first()
    if car:
        car.status = CarStatus.FREE
    
    await db.commit()
    await db.refresh(rental)
    
    # Broadcast update
    await manager.broadcast_status_update()
    
    # Disconnect controller if active
    if car:
        manager.disconnect_user_controller(str(car.id))
        if car.raspberry_id:
            print(f"Sending stop_stream to {car.raspberry_id}")
            await manager.send_command_to_car(car.raspberry_id, "stop_stream")

    return rental

@router.post("/extend", response_model=RentalResponse)
async def extend_rental(
    extend_data: RentalExtend,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    # 1. Get Rental and Car
    result = await db.execute(select(Rental).where(Rental.id == extend_data.rental_id))
    rental = result.scalars().first()
    
    if not rental or rental.status != RentalStatus.ACTIVE:
        raise HTTPException(status_code=400, detail="Active rental not found")
    
    car_result = await db.execute(select(Car).where(Car.id == rental.car_id))
    car = car_result.scalars().first()
    
    if not car:
         raise HTTPException(status_code=404, detail="Car associated with rental not found")

    # 2. Calculate Cost (UAH)
    price_per_minute = float(car.price_per_minute)
    cost = price_per_minute * extend_data.additional_minutes
    
    # 3. Check Balance (UAH)
    user_balance = float(current_user.balance)
    if user_balance < cost:
        raise HTTPException(status_code=402, detail=f"Insufficient funds. Required: {cost} UAH, Available: {user_balance} UAH")
        
    # 4. Deduct and Update
    current_user.balance -= cost
    rental.extended_minutes += extend_data.additional_minutes
    rental.duration_minutes += extend_data.additional_minutes
    
    await db.commit()
    await db.refresh(rental)
    return rental

from typing import List
from app.routers.auth import get_admin_user

@router.get("/", response_model=List[RentalResponse])
async def read_rentals(
    skip: int = 0,
    limit: int = 100,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(
        select(Rental)
        .options(joinedload(Rental.user), joinedload(Rental.car))
        .order_by(Rental.started_at.desc())
        .offset(skip).limit(limit)
    )
    return result.scalars().all()

@router.get("/my", response_model=List[RentalResponse])
async def read_my_rentals(
    skip: int = 0,
    limit: int = 50,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(
        select(Rental)
        .options(joinedload(Rental.user), joinedload(Rental.car))
        .where(Rental.user_id == current_user.id)
        .order_by(Rental.started_at.desc())
        .offset(skip).limit(limit)
    )
    return result.scalars().all()

from app.schemas.rental import RentalReport, RentalFeedback

@router.post("/report", response_model=RentalResponse)
async def report_rental_issue(
    report_data: RentalReport,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Rental).where(Rental.id == report_data.rental_id))
    rental = result.scalars().first()
    
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
        
    if rental.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your rental")
        
    rental.issue_report = report_data.issue
    await db.commit()
    await db.refresh(rental)
    return rental

@router.post("/feedback", response_model=RentalResponse)
async def submit_rental_feedback(
    feedback_data: RentalFeedback,
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Rental).where(Rental.id == feedback_data.rental_id))
    rental = result.scalars().first()
    
    if not rental:
        raise HTTPException(status_code=404, detail="Rental not found")
        
    if rental.user_id != current_user.id:
        raise HTTPException(status_code=403, detail="Not your rental")
        
    rental.rating = feedback_data.rating
    rental.feedback = feedback_data.comment
    await db.commit()
    await db.refresh(rental)
    return rental
