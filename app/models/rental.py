import uuid
from datetime import datetime
from enum import Enum as PyEnum
from sqlalchemy import ForeignKey, DateTime, Integer, Enum
from sqlalchemy.orm import Mapped, mapped_column, relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class RentalStatus(str, PyEnum):
    ACTIVE = "active"
    COMPLETED = "completed"
    CANCELLED = "cancelled"

class Rental(Base):
    __tablename__ = "rentals"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("users.id"))
    car_id: Mapped[uuid.UUID] = mapped_column(ForeignKey("cars.id"))
    started_at: Mapped[datetime] = mapped_column(DateTime, default=datetime.utcnow)
    duration_minutes: Mapped[int] = mapped_column(Integer)
    extended_minutes: Mapped[int] = mapped_column(Integer, default=0)
    ended_at: Mapped[datetime | None] = mapped_column(DateTime, nullable=True)
    status: Mapped[RentalStatus] = mapped_column(Enum(RentalStatus), default=RentalStatus.ACTIVE)
    
    # New columns for Stage 3
    issue_report: Mapped[str | None] = mapped_column(nullable=True)
    rating: Mapped[int | None] = mapped_column(Integer, nullable=True)
    feedback: Mapped[str | None] = mapped_column(nullable=True)

    user = relationship("User", back_populates="rentals")
    car = relationship("Car", back_populates="rentals")
