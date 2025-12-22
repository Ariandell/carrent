from typing import Dict, List, Optional
from fastapi import WebSocket
import json
import logging

class ConnectionManager:
    def __init__(self):
        # active_connections: List[WebSocket] = []
        self.active_cars: Dict[str, WebSocket] = {} # raspberry_id -> WebSocket
        self.observing_users: List[WebSocket] = [] # Users on dashboard
        self.controlling_users: Dict[str, WebSocket] = {} # car_id -> WebSocket (Rental active)

    async def connect_car(self, raspberry_id: str, websocket: WebSocket):
        await websocket.accept()
        self.active_cars[raspberry_id] = websocket
        print(f"🚗 Car connected: {raspberry_id}")
        await self.broadcast_status_update()

    def disconnect_car(self, raspberry_id: str):
        if raspberry_id in self.active_cars:
            del self.active_cars[raspberry_id]
            print(f"❌ Car disconnected: {raspberry_id}")

    async def connect_user_observer(self, websocket: WebSocket):
        await websocket.accept()
        self.observing_users.append(websocket)
    
    def disconnect_user_observer(self, websocket: WebSocket):
        if websocket in self.observing_users:
            self.observing_users.remove(websocket)

    async def connect_user_controller(self, car_id: str, websocket: WebSocket):
        await websocket.accept()
        # Ensure only one controller per car (though logic should be handled by Rental service)
        self.controlling_users[car_id] = websocket
        print(f"🎮 User connected to control car {car_id}")

    def disconnect_user_controller(self, car_id: str):
        if car_id in self.controlling_users:
            del self.controlling_users[car_id]

    async def send_command_to_car(self, raspberry_id: str, command: str):
        if raspberry_id in self.active_cars:
            await self.active_cars[raspberry_id].send_text(command)
            return True
        return False

    async def broadcast_status_update(self):
        # This function should ideally fetch real statuses from DB or memory
        # For now, we just send a list of online raspberry_ids
        online_cars = list(self.active_cars.keys())
        message = json.dumps({"type": "status_update", "online_cars": online_cars})
        
        # Broadcast to all observers (dashboard)
        for connection in self.observing_users:
            try:
                await connection.send_text(message)
            except:
                self.disconnect_user_observer(connection)

manager = ConnectionManager()
