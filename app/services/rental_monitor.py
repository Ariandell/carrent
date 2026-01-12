import asyncio
from datetime import datetime, timedelta
from sqlalchemy.future import select
from sqlalchemy.orm import joinedload # key for loading relations
from app.database import AsyncSessionLocal
from app.models.rental import Rental, RentalStatus
from app.models.car import Car, CarStatus
from app.websocket.manager import manager

async def check_expired_rentals():
    """
    Periodic task to check for expired rentals and close them.
    """
    print("🔄 Rental Monitor: Starting check...")
    
    async with AsyncSessionLocal() as db:
        try:
            # 1. Get ALL active rentals
            # We explicitly load the user/car to avoid async detachment issues if we need them later
            result = await db.execute(
                select(Rental).where(Rental.status == RentalStatus.ACTIVE)
            )
            active_rentals = result.scalars().all()
            
            expired_count = 0
            
            for rental in active_rentals:
                # Calculate expiry
                expiry_time = rental.started_at + timedelta(minutes=rental.duration_minutes + rental.extended_minutes)
                
                # Check if expired (with small buffer)
                if datetime.utcnow() > expiry_time + timedelta(seconds=10):
                    print(f"⚠️ Rental Monitor: Rental {rental.id} EXPIRED. Closing now.")
                    
                    # Close Rental
                    rental.status = RentalStatus.COMPLETED
                    rental.ended_at = datetime.utcnow()
                    
                    # Free Car
                    car_result = await db.execute(select(Car).where(Car.id == rental.car_id))
                    car = car_result.scalars().first()
                    
                    if car:
                        car.status = CarStatus.FREE
                        
                        # Stop Stream
                        if car.raspberry_id:
                            print(f"📡 Rental Monitor: Stopping stream for car {car.raspberry_id}")
                            try:
                                await manager.send_command_to_car(car.raspberry_id, "stop_stream")
                            except Exception as e:
                                print(f"❌ Failed to send stop_stream: {e}")
                                
                        # Disconnect controller
                        manager.disconnect_user_controller(str(car.id))

                    expired_count += 1
            
            if expired_count > 0:
                await db.commit()
                print(f"✅ Rental Monitor: Closed {expired_count} expired rentals.")
                # Broadcast update to all clients
                await manager.broadcast_status_update()
            else:
                print("👍 Rental Monitor: No expired rentals found.")

        except Exception as e:
            print(f"❌ Rental Monitor Error: {e}")
            await db.rollback()

async def start_rental_monitor():
    """
    Starts the infinite loop for monitoring.
    """
    print("🚀 Rental Monitor Service Started")
    while True:
        await check_expired_rentals()
        await asyncio.sleep(60) # Check every 60 seconds
