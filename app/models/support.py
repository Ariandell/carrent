import uuid
from datetime import datetime
from sqlalchemy import Column, String, Text, DateTime, ForeignKey
from sqlalchemy.orm import relationship
from sqlalchemy.dialects.postgresql import UUID
from app.database import Base

class SupportTicket(Base):
    __tablename__ = "support_tickets"

    id = Column(UUID(as_uuid=True), primary_key=True, default=uuid.uuid4)
    user_id = Column(UUID(as_uuid=True), ForeignKey('users.id'), nullable=True)
    
    subject = Column(String, nullable=False)
    message = Column(Text, nullable=False)
    email = Column(String, nullable=True) # Contact email if different or guest
    
    status = Column(String, default="open") # open, in_progress, closed
    created_at = Column(DateTime, default=datetime.utcnow)
    
    user = relationship("User", backref="support_tickets")
