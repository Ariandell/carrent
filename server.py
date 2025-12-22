from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from typing import Dict

app = FastAPI()

class ConnectionManager:
    def __init__(self):
        # Тут живе "машинка"
        self.active_car: WebSocket | None = None
        # Тут живуть "юзери" (може бути кілька вкладок)
        self.active_users: list[WebSocket] = []

    async def connect_car(self, websocket: WebSocket):
        await websocket.accept()
        self.active_car = websocket
        print("✅ CAR CONNECTED!")

    def disconnect_car(self):
        self.active_car = None
        print("❌ CAR DISCONNECTED!")

    async def connect_user(self, websocket: WebSocket):
        await websocket.accept()
        self.active_users.append(websocket)
        print("👤 USER CONNECTED!")

    def disconnect_user(self, websocket: WebSocket):
        self.active_users.remove(websocket)

    async def send_command(self, command: str):
        if self.active_car:
            await self.active_car.send_text(command)
            return "Command sent"
        return "Car is offline"

manager = ConnectionManager()

# Ендпоінт для машинки
@app.websocket("/ws/car")
async def car_endpoint(websocket: WebSocket):
    await manager.connect_car(websocket)
    try:
        while True:
            await websocket.receive_text() # Слухаємо (щоб тримати канал)
    except WebSocketDisconnect:
        manager.disconnect_car()

# Ендпоінт для юзера (контролера)
@app.websocket("/ws/user")
async def user_endpoint(websocket: WebSocket):
    await manager.connect_user(websocket)
    try:
        while True:
            # Юзер надсилає команду (наприклад "forward")
            data = await websocket.receive_text()
            print(f"📩 Received command: {data}")
            # Сервер пересилає її машинці
            result = await manager.send_command(data)
            await websocket.send_text(f"Server status: {result}")
    except WebSocketDisconnect:
        manager.disconnect_user(websocket)