import uuid
from sqlalchemy import String, Integer, Boolean, Float
from sqlalchemy.orm import Mapped, mapped_column
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class RentalOffer(Base):
    __tablename__ = "rental_offers"

    id: Mapped[uuid.UUID] = mapped_column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    name: Mapped[str] = mapped_column(String)  # e.g. "Quick Spin"
    duration_minutes: Mapped[int] = mapped_column(Integer) # e.g. 5
    price: Mapped[float] = mapped_column(Float) # e.g. 2.00 (USD or Credits)
    is_active: Mapped[str] = mapped_column(Boolean, default=True)
    description: Mapped[str | None] = mapped_column(String, nullable=True) # "Best for beginners"
