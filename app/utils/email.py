from fastapi_mail import FastMail, MessageSchema, ConnectionConfig, MessageType
from pydantic import EmailStr
from app.config import settings
import os
import logging

logger = logging.getLogger(__name__)
logging.basicConfig(level=logging.INFO)

# Configuration
conf = ConnectionConfig(
    MAIL_USERNAME=settings.mail_username, 
    MAIL_PASSWORD=settings.mail_password,
    MAIL_FROM=settings.mail_from,
    MAIL_PORT=settings.mail_port,
    MAIL_SERVER=settings.mail_server,
    MAIL_STARTTLS=settings.mail_starttls,
    MAIL_SSL_TLS=settings.mail_ssl_tls,
    USE_CREDENTIALS=settings.use_credentials,
    VALIDATE_CERTS=settings.validate_certs
)

async def send_verification_email(email: EmailStr, code: str, token: str):
    """
    Sends a verification email with both a manual code and a magic link.
    """
    
    # Base URL handling - in prod this should be env var
    base_url = os.getenv("APP_URL", "http://localhost:8001")
    # Redirect to backend endpoint which handles the token verification
    magic_link = f"{base_url}/api/auth/verify-link?token={token}"

    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
        <h2 style="color: #2563eb; text-align: center;">Welcome to FPV Racer!</h2>
        <p style="color: #374151; font-size: 16px;">Hello Pilot,</p>
        <p style="color: #374151; font-size: 16px;">Confirm your email to start your engines.</p>
        
        <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin-bottom: 10px; color: #6b7280; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Your Verification Code</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111827;">{code}</div>
        </div>
        
        <p style="text-align: center; margin: 20px 0;">
            <a href="{magic_link}" style="display: inline-block; background-color: #2563eb; color: white; padding: 12px 24px; text-decoration: none; border-radius: 6px; font-weight: bold;">
                Verify & Login Automatically
            </a>
        </p>
        
        <p style="color: #6b7280; font-size: 12px; text-align: center;">
            If the button doesn't work, copy this code or ignore this email if you didn't register.
        </p>
    </div>
    """

    message = MessageSchema(
        subject="FWD: Pilot Verification Required",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    try:
        fm = FastMail(conf)
        await fm.send_message(message)
        logger.info(f"EMAIL SENT to {email}")
    except Exception as e:
        logger.error(f"Failed to send email: {e}")
        # In dev, we might just print usage
        logger.warning(f"DEV EMAIL: Code={code}, Link={magic_link}")
        
        # Write to debug file
        try:
            with open("debug_emails.log", "a") as f:
                f.write(f"--------------------------------------------------\n")
                f.write(f"To: {email}\n")
                f.write(f"Code: {code}\n")
                f.write(f"Magic Link: {magic_link}\n")
                f.write(f"--------------------------------------------------\n")
        except Exception:
            pass

async def send_reset_email(email: EmailStr, code: str):
    """
    Sends a password reset code.
    """
    html = f"""
    <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto; padding: 20px; background-color: #f9fafb; border-radius: 10px;">
        <h2 style="color: #dc2626; text-align: center;">Password Reset Request</h2>
        <div style="background-color: #ffffff; padding: 20px; border-radius: 8px; text-align: center; margin: 20px 0;">
            <p style="margin-bottom: 10px; color: #6b7280; text-transform: uppercase; font-size: 12px; letter-spacing: 1px;">Your Recovery Code</p>
            <div style="font-size: 32px; font-weight: bold; letter-spacing: 5px; color: #111827;">{code}</div>
        </div>
    </div>
    """
    
    message = MessageSchema(
        subject="Security Alert: Password Reset",
        recipients=[email],
        body=html,
        subtype=MessageType.html
    )

    try:
        fm = FastMail(conf)
        await fm.send_message(message)
    except Exception as e:
        print(f"Failed to send email: {e}")
        print(f"DEV EMAIL: Code={code}")

        # Write to debug file
        try:
            with open("debug_emails.log", "a") as f:
                f.write(f"--------------------------------------------------\n")
                f.write(f"To: {email} (Password Reset)\n")
                f.write(f"Code: {code}\n")
                f.write(f"--------------------------------------------------\n")
        except Exception:
            pass
