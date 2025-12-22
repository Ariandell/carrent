from app.config import settings

print("--- App Config Check ---")
print(f"MAIL_USERNAME: '{settings.mail_username}'")
print(f"MAIL_SERVER: '{settings.mail_server}'")
print(f"MAIL_PORT: {settings.mail_port}")
print(f"MAIL_FROM: '{settings.mail_from}'")
print(f"Env file used: {settings.Config.env_file}")
