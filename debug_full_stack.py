import asyncio
import sys
import os

# Fix for Windows asyncio loop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

from app.config import settings
from fastapi_mail import FastMail, MessageSchema, MessageType
from app.utils.email import conf # Import the EXACT config object used by the app

async def diagnose():
    print("--- DIAGNOSTICS START ---")
    print(f"Current Working Dir: {os.getcwd()}")
    
    # Check Settings
    print(f"\n[Settings Check]")
    print(f"MAIL_SERVER: '{settings.mail_server}' (Should be 'smtp.gmail.com')")
    print(f"MAIL_PORT: {settings.mail_port} (Should be 587)")
    print(f"MAIL_USERNAME: '{settings.mail_username}'")
    print(f"MAIL_PASSWORD: '{settings.mail_password[:4]}****' (Masked)")
    print(f"MAIL_FROM: '{settings.mail_from}'")
    
    if not settings.mail_username or not settings.mail_server:
        print("\n[CRITICAL ERROR] Settings are EMPTY! .env is not loading correctly.")
        print("Possible causes: missing python-dotenv, wrong .env location, or pydantic-settings issue.")
        return

    # Try sending real verification email
    print(f"\n[Sending Real Template Test]")
    recipient = "kuronamiarian@gmail.com"
    print(f"Sending to: {recipient}")
    
    from app.utils.email import send_verification_email
    import uuid
    
    try:
        # Mock data
        code = "123456"
        token = str(uuid.uuid4())
        await send_verification_email(recipient, code, token)
        print("\n[SUCCESS] Real verification email function executed without error.")
    except Exception as e:
        print(f"\n[FAILURE] Real function failed: {e}")

if __name__ == "__main__":
    asyncio.run(diagnose())
