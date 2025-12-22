import asyncio
import os
from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr, BaseModel
from dotenv import load_dotenv
import sys

# Fix for Windows asyncio loop
if sys.platform == 'win32':
    asyncio.set_event_loop_policy(asyncio.WindowsSelectorEventLoopPolicy())

# Load env manually since we are running as script
load_dotenv()

# Configuration (Hardcoded for testing)
conf = ConnectionConfig(
    MAIL_USERNAME="maksym.auto.online@gmail.com",
    MAIL_PASSWORD="obdflkcimnawibfa", # Spaces removed
    MAIL_FROM="maksym.auto.online@gmail.com",
    MAIL_PORT=587,
    MAIL_SERVER="smtp.gmail.com",
    MAIL_STARTTLS=True,
    MAIL_SSL_TLS=False,
    USE_CREDENTIALS=True,
    VALIDATE_CERTS=True
)

async def test_email():
    print("--- SMTP Configuration ---")
    print(f"Server: {conf.MAIL_SERVER}")
    print(f"Port: {conf.MAIL_PORT}")
    print(f"Username: {conf.MAIL_USERNAME}")
    print(f"From: {conf.MAIL_FROM}")
    print("--------------------------")

    if not conf.MAIL_USERNAME or not conf.MAIL_PASSWORD:
        print("ERROR: MAIL_USERNAME or MAIL_PASSWORD is missing in .env!")
        return

    recipient = os.getenv("TEST_EMAIL_RECIPIENT", conf.MAIL_USERNAME) # Default to self
    print(f"Attempting to send test email to: {recipient}")

    message = MessageSchema(
        subject="FPV Racer SMTP Test",
        recipients=[recipient],
        body="<h1>It Works!</h1><p>Your SMTP configuration is correct.</p>",
        subtype=MessageType.html
    )

    try:
        fm = FastMail(conf)
        await fm.send_message(message)
        print("SUCCESS: Email sent successfully!")
    except Exception as e:
        print(f"FAILURE: Could not send email.\nError: {e}")

if __name__ == "__main__":
    asyncio.run(test_email())
