import logging
from fastapi import APIRouter, Depends, HTTPException, Request, Form
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from uuid import uuid4

from app.database import get_db
from app.models.transaction import Transaction, TransactionStatus
from app.models.user import User
from app.routers.auth import get_current_user
from app.utils.liqpay import liqpay
from app.config import settings

# Setup logging
logger = logging.getLogger("payments")

router = APIRouter(prefix="/api/payments", tags=["Payments"])

# Get URLs from centralized config
APP_URL = settings.APP_URL
LIQPAY_WEBHOOK_URL = f"{APP_URL}/api/payments/callback"

@router.post("/create")
async def create_payment(
    amount: float, 
    db: AsyncSession = Depends(get_db), 
    current_user: User = Depends(get_current_user)
):
    # Log URLs for debugging
    logger.info(f"Payment create: APP_URL={APP_URL}")
    logger.info(f"Payment create: webhook_url={LIQPAY_WEBHOOK_URL}")
    
    # Create pending transaction
    order_id = str(uuid4())
    minutes_to_add = int(amount) # Basic logic: 1 UAH = 1 Minute (Can be changed to Offer logic later)
    
    transaction = Transaction(
        user_id=current_user.id,
        amount_uah=amount,
        minutes_added=minutes_to_add,
        liqpay_order_id=order_id,
        status=TransactionStatus.PENDING
    )
    db.add(transaction)
    await db.commit()
    
    result_url = f"{APP_URL}/frontend/dashboard.html?payment=success"
    logger.info(f"Payment create: result_url={result_url}")
    
    # Generate LiqPay data
    params = liqpay.get_checkout_params(
        amount=amount,
        currency="UAH",
        description=f"Top up balance: {minutes_to_add} minutes",
        order_id=order_id,
        result_url=result_url,
        server_url=LIQPAY_WEBHOOK_URL
    )
    
    return params

@router.post("/callback")
async def liqpay_callback(
    data: str = Form(...), 
    signature: str = Form(...), 
    db: AsyncSession = Depends(get_db)
):
    """LiqPay webhook callback for processing payment results"""
    
    # Verify signature
    if not liqpay.verify_signature(data, signature):
        logger.warning("LiqPay callback: Invalid signature received")
        raise HTTPException(status_code=400, detail="Invalid signature")
    
    decoded_data = liqpay.decode_data(data)
    order_id = decoded_data.get("order_id")
    status = decoded_data.get("status")
    amount = decoded_data.get("amount", 0)
    
    logger.info(f"LiqPay callback: order_id={order_id}, status={status}, amount={amount}")
    
    # Find transaction
    result = await db.execute(select(Transaction).where(Transaction.liqpay_order_id == order_id))
    transaction = result.scalars().first()
    
    if not transaction:
        logger.error(f"LiqPay callback: Transaction not found for order_id={order_id}")
        return {"status": "error", "message": "Transaction not found"}
        
    if transaction.status == TransactionStatus.SUCCESS:
        logger.info(f"LiqPay callback: Transaction {order_id} already processed")
        return {"status": "already_processed"}

    if status == "success" or status == "sandbox":
        transaction.status = TransactionStatus.SUCCESS
        
        # Add balance to user
        result_user = await db.execute(select(User).where(User.id == transaction.user_id))
        user = result_user.scalars().first()
        if user:
            old_balance = user.balance_minutes
            user.balance_minutes += transaction.minutes_added
            logger.info(
                f"LiqPay callback: SUCCESS - User {user.email} balance updated: "
                f"{old_balance} -> {user.balance_minutes} (+{transaction.minutes_added} min)"
            )
    else:
        transaction.status = TransactionStatus.FAILED
        logger.warning(f"LiqPay callback: FAILED - order_id={order_id}, status={status}")
    
    await db.commit()
    return {"status": "ok"}

@router.get("/history")
async def get_history(
    db: AsyncSession = Depends(get_db),
    current_user: User = Depends(get_current_user)
):
    result = await db.execute(select(Transaction).where(Transaction.user_id == current_user.id).order_by(Transaction.created_at.desc()))
    transactions = result.scalars().all()
    return transactions
