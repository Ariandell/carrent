from pydantic_settings import BaseSettings

class Settings(BaseSettings):
    DATABASE_URL: str = "postgresql+asyncpg://fpv_admin:fpv_secure_2024@localhost:5432/fpv_racer"
    JWT_SECRET: str = "unsafe_secret_for_dev"
    ALGORITHM: str = "HS256"
    ACCESS_TOKEN_EXPIRE_MINUTES: int = 30

    GOOGLE_CLIENT_ID: str = ""
    GOOGLE_CLIENT_SECRET: str = ""

    # LiqPay Settings
    LIQPAY_PUBLIC_KEY: str = ""
    LIQPAY_PRIVATE_KEY: str = ""
    LIQPAY_SANDBOX: bool = True  # Set to False for production
    
    # Application URL - change this for different environments:
    # localhost: http://localhost:8001
    # ngrok: https://xxxx.ngrok-free.app
    # production: https://your-domain.com
    APP_URL: str = "http://localhost:8001"

    # Email Settings (optional - for future use)
    mail_username: str = ""
    mail_password: str = ""
    mail_from: str = ""
    mail_port: int = 587
    mail_server: str = ""
    mail_starttls: bool = True
    mail_ssl_tls: bool = False
    use_credentials: bool = True
    validate_certs: bool = True

    class Config:
        env_file = ".env"
        extra = "ignore"

settings = Settings()
