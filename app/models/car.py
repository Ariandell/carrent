import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import String, Integer, DateTime, Enum, Numeric
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class CarStatus(str, PyEnum):
    FREE = "free"
    BUSY = "busy"
    OFFLINE = "offline"

class Car(Base):
    __tablename__ = "cars"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String)
    status: Mapped[CarStatus] = mapped_column(Enum(CarStatus), default=CarStatus.OFFLINE)
    vdo_ninja_id: Mapped[str | None] = mapped_column(String, nullable=True)
    location: Mapped[str | None] = mapped_column(String, nullable=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True)
    image_url: Mapped[str | None] = mapped_column(String, nullable=True)  # PNG image path
    price_per_minute: Mapped[float] = mapped_column(Numeric(10, 2), default=1.00)  # UAH per minute
    raspberry_id: Mapped[str] = mapped_column(String, unique=True, index=True)
    battery_level: Mapped[int] = mapped_column(Integer, default=100)
    created_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)

    rentals = relationship("Rental", back_populates="car")
    tariffs = relationship("CarTariff", back_populates="car", cascade="all, delete-orphan")
