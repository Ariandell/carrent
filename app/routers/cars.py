from typing import List, Optional
from fastapi import APIRouter, Depends, HTTPException, status
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select

from app.database import get_db
from app.models.car import Car, CarStatus
from app.models.user import User, UserRole
from app.models.rental import Rental, RentalStatus
from datetime import datetime, timedelta
from app.schemas.car import CarCreate, CarUpdate, CarResponse
from app.routers.auth import get_current_user

router = APIRouter(prefix="/api/cars", tags=["Cars"])

async def get_admin_user(current_user: User = Depends(get_current_user)):
    if current_user.role != UserRole.ADMIN:
        raise HTTPException(
            status_code=status.HTTP_403_FORBIDDEN,
            detail="You do not have permission to perform this action"
        )
    return current_user

@router.get("/", response_model=List[CarResponse])
async def read_cars(
    status: Optional[CarStatus] = None, 
    db: AsyncSession = Depends(get_db)
):
    query = select(Car)
    if status:
        query = query.where(Car.status == status)
    result = await db.execute(query)
    cars = result.scalars().all()
    
    # Process busy cars to find end time
    # (Optimization: could be done with a join, but this is simpler for now)
    car_responses = []
    
    # Fetch active rentals with user info
    # We need to join/load User to get the name
    from sqlalchemy.orm import selectinload
    active_rentals_query = select(Rental).options(selectinload(Rental.user)).where(Rental.status == RentalStatus.ACTIVE)
    rentals_res = await db.execute(active_rentals_query)
    active_rentals = rentals_res.scalars().all()
    # Normalize keys to string to avoid UUID vs str mismatch issues
    rental_map = {str(r.car_id): r for r in active_rentals}

    for car in cars:
        # Clone to not mutate db object if session is open (though here it's fine)
        # We need to return an object that matches CarResponse
        # Since CarResponse is Pydantic, we can pass a dict or object
        
        busy_until = None
        booked_by_name = None
        
        # Check using stringified ID
        if car.status == CarStatus.BUSY and str(car.id) in rental_map:
            rental = rental_map[str(car.id)]
            # Calculate end time: started_at + duration + extended
            duration = rental.duration_minutes + (rental.extended_minutes or 0)
            busy_until = rental.started_at + timedelta(minutes=duration)
            if rental.user:
                booked_by_name = rental.user.name or "User"
        
        # Determine if we can just set the attribute on the ORM object temporarily
        # Python allows setting arbitrary attributes on instances
        setattr(car, 'busy_until', busy_until)
        setattr(car, 'booked_by_name', booked_by_name)
        # Or we can let Pydantic handle it if the attribute exists
        
    return cars

@router.get("/{car_id}", response_model=CarResponse)
async def read_car(car_id: str, db: AsyncSession = Depends(get_db)):
    result = await db.execute(select(Car).where(Car.id == car_id))
    car = result.scalars().first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    return car

@router.post("/", response_model=CarResponse)
async def create_car(
    car_data: CarCreate, 
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    # Check if raspberry_id exists
    result = await db.execute(select(Car).where(Car.raspberry_id == car_data.raspberry_id))
    if result.scalars().first():
        raise HTTPException(status_code=400, detail="Car with this Raspberry ID already exists")

    new_car = Car(**car_data.dict())
    db.add(new_car)
    await db.commit()
    await db.refresh(new_car)
    return new_car

@router.put("/{car_id}", response_model=CarResponse)
async def update_car(
    car_id: str,
    car_update: CarUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(Car).where(Car.id == car_id))
    car = result.scalars().first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")

    update_data = car_update.dict(exclude_unset=True)
    for key, value in update_data.items():
        setattr(car, key, value)
    
    await db.commit()
    await db.refresh(car)
    return car

@router.delete("/{car_id}")
async def delete_car(
    car_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(Car).where(Car.id == car_id))
    car = result.scalars().first()
    if not car:
        raise HTTPException(status_code=404, detail="Car not found")
    
    await db.delete(car)
    await db.commit()
    return {"message": "Car deleted successfully"}
