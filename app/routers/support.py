from fastapi import APIRouter, Depends, HTTPException, BackgroundTasks
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload
from typing import List

from app.database import get_db
from app.models.support import SupportTicket
from app.models.user import User
from app.schemas.support import SupportTicketCreate, SupportTicketResponse, SupportTicketUpdate, SupportTicketReply
from app.routers.auth import get_current_user_optional, get_admin_user
from app.utils.email import send_support_reply_email

router = APIRouter(prefix="/api/support", tags=["Support"])

@router.post("/", response_model=SupportTicketResponse)
async def create_ticket(
    ticket_data: SupportTicketCreate,
    db: AsyncSession = Depends(get_db),
    user: User | None = Depends(get_current_user_optional)
):
    new_ticket = SupportTicket(
        subject=ticket_data.subject,
        message=ticket_data.message,
        email=ticket_data.email or (user.email if user else None),
        user_id=user.id if user else None
    )
    
    if not new_ticket.email and not user:
        # If no internal user and no email provided
        raise HTTPException(status_code=400, detail="Email is required for guests")

    db.add(new_ticket)
    await db.commit()
    await db.refresh(new_ticket)
    return new_ticket

@router.get("/", response_model=List[SupportTicketResponse])
async def list_tickets(
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(
        select(SupportTicket)
        .options(joinedload(SupportTicket.user))
        .order_by(SupportTicket.created_at.desc())
    )
    tickets = result.scalars().all()
    # Pydantic v2 from_attributes handles user relationship if schema matches
    # But SupportTicketResponse has user_email instead of user object.
    # We might need to map it manually or update schema to use @computed_field
    # Let's handle it manually or simple mapping
    for t in tickets:
        if t.user:
            t.user_email = t.user.email # HACK: Inject attribute for Pydantic
    return tickets

@router.put("/{ticket_id}", response_model=SupportTicketResponse)
async def update_ticket_status(
    ticket_id: str,
    status_data: SupportTicketUpdate,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalars().first()
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    ticket.status = status_data.status
    await db.commit()
    await db.refresh(ticket)
    return ticket

@router.post("/{ticket_id}/reply")
async def reply_ticket(
    ticket_id: str,
    reply_data: SupportTicketReply,
    tasks: BackgroundTasks,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    # Fetch ticket with user relationship
    result = await db.execute(
        select(SupportTicket)
        .options(joinedload(SupportTicket.user))
        .where(SupportTicket.id == ticket_id)
    )
    ticket = result.scalars().first()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")

    recipient_email = ticket.email
    if not recipient_email and ticket.user:
        recipient_email = ticket.user.email
            
    if not recipient_email:
        raise HTTPException(status_code=400, detail="No email address associated with this ticket")

    # Send email
    tasks.add_task(send_support_reply_email, recipient_email, ticket.subject, reply_data.message)
    
    return {"message": "Reply sent successfully"}

@router.delete("/{ticket_id}")
async def delete_ticket(
    ticket_id: str,
    db: AsyncSession = Depends(get_db),
    admin: User = Depends(get_admin_user)
):
    result = await db.execute(select(SupportTicket).where(SupportTicket.id == ticket_id))
    ticket = result.scalars().first()
    
    if not ticket:
        raise HTTPException(status_code=404, detail="Ticket not found")
        
    await db.delete(ticket)
    await db.commit()
    
    return {"message": "Ticket deleted successfully"}
