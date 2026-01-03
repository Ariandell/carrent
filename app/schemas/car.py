from pydantic import BaseModel
from typing import Optional
from uuid import UUID
from datetime import datetime
from app.models.car import CarStatus

class CarBase(BaseModel):
    name: str
    raspberry_id: str
    vdo_ninja_id: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    price_per_minute: Optional[float] = 1.00  # UAH per minute

class CarCreate(CarBase):
    pass

class CarUpdate(BaseModel):
    name: Optional[str] = None
    status: Optional[CarStatus] = None
    vdo_ninja_id: Optional[str] = None
    location: Optional[str] = None
    description: Optional[str] = None
    image_url: Optional[str] = None
    price_per_minute: Optional[float] = None
    battery_level: Optional[int] = None

class CarResponse(CarBase):
    id: UUID
    status: CarStatus
    battery_level: int
    image_url: Optional[str] = None
    price_per_minute: float = 1.00
    busy_until: Optional[datetime] = None
    booked_by_name: Optional[str] = None
    created_at: datetime
    
    class Config:
        from_attributes = True
