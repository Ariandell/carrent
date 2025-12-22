from fastapi import APIRouter, WebSocket, WebSocketDisconnect, Depends
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.future import select
from app.database import get_db
from app.websocket.manager import manager
from app.models.car import Car

router = APIRouter(prefix="/api", tags=["Websockets"])

@router.websocket("/ws/car/{raspberry_id}")
async def car_websocket(raspberry_id: str, websocket: WebSocket, db: AsyncSession = Depends(get_db)):
    await manager.connect_car(raspberry_id, websocket)
    try:
        while True:
            # Keep connection alive and listen for status updates (battery, etc)
            data_text = await websocket.receive_text()
            
            try:
                data = json.loads(data_text)
                if data.get("type") == "telemetry":
                    # Update DB
                    # We might want to optimize this (not query every time) but for MVP it's fine
                    # Or just cache it in manager? DB is safer for persistence across restarts.
                    result = await db.execute(select(Car).where(Car.raspberry_id == raspberry_id))
                    car = result.scalars().first()
                    if car:
                        car.battery_level = data.get("battery", 0)
                        # Could store RSSI too if model supported it
                        await db.commit()
                        
                        # Broadcast optimized update?
                        # For now, general broadcast handles it (it fetches all cars)
                        # But wait, broadcast fetches from DB?
                        # manager.broadcast_status_update() fetches from... where?
                        # It sends 'online_cars' list currently.
                        # We need to broadcast DATA.
                        
                        await manager.broadcast_status_update() 

            except json.JSONDecodeError:
                pass

    except WebSocketDisconnect:
        manager.disconnect_car(raspberry_id)
        await manager.broadcast_status_update()

@router.websocket("/ws/status")
async def status_websocket(websocket: WebSocket):
    await manager.connect_user_observer(websocket)
    try:
        while True:
            await websocket.receive_text() # Just keep alive
    except WebSocketDisconnect:
        manager.disconnect_user_observer(websocket)

@router.websocket("/ws/control/{car_id}")
async def control_websocket(car_id: str, websocket: WebSocket, db: AsyncSession = Depends(get_db)):
    # TODO: Validate RENTAL and User Token here!
    # For now basic connection
    
    # 1. Find the car to get raspberry_id
    result = await db.execute(select(Car).where(Car.id == car_id))
    car = result.scalars().first()
    
    if not car:
        await websocket.close()
        return

    await manager.connect_user_controller(car.id, websocket)
    try:
        while True:
            command = await websocket.receive_text()
            # Forward command to car
            success = await manager.send_command_to_car(car.raspberry_id, command)
            if not success:
                await websocket.send_text("Car offline")
    except WebSocketDisconnect:
        manager.disconnect_user_controller(car.id)
