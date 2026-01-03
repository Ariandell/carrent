from fastapi import FastAPI
from fastapi.staticfiles import StaticFiles
from fastapi.middleware.cors import CORSMiddleware
from app.config import settings
import sys
import asyncio



app = FastAPI(title="FPV Racer Pro")

# CORS Setup
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"], 
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)
from app.database import init_db

@app.on_event("startup")
async def startup_event():
    await init_db()

from app.routers import auth, users, cars, websockets, rentals, payments, admin, support, uploads
app.include_router(auth.router)
app.include_router(users.router)
app.include_router(cars.router)
app.include_router(rentals.router)
app.include_router(payments.router)
app.include_router(admin.router)
app.include_router(support.router)
app.include_router(uploads.router)
app.include_router(websockets.router)

@app.get("/")
def read_root():
    return RedirectResponse(url="/frontend/auth.html")

# Mount frontend files
from fastapi.staticfiles import StaticFiles
from fastapi.responses import RedirectResponse
import os

# Ensure absolute path for safety
frontend_path = os.path.join(os.path.dirname(os.path.dirname(__file__)), "frontend")
app.mount("/frontend", StaticFiles(directory=frontend_path, html=True), name="frontend")
