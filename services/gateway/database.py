import os
from sqlalchemy import create_engine
from sqlalchemy.ext.declarative import declarative_base
from sqlalchemy.orm import sessionmaker

# LOGIC: We'll use a hardcoded fallback to rule out .env loading issues
# If the environment variable fails, this string is 100% correct for Docker.
# services/gateway/database.py
DATABASE_URL = "postgresql://postgres:password@db:5432/careerflow_db"

# LOGIC: Add 'client_encoding' to ensure the handshake is clean
engine = create_engine(
    DATABASE_URL,
    connect_args={"client_encoding": "utf8"} 
)

SessionLocal = sessionmaker(autocommit=False, autoflush=False, bind=engine)
Base = declarative_base()

DRY_RUN_MODE = os.getenv("DRY_RUN", "True").lower() == "true"

def get_db():
    db = SessionLocal()
    try:
        yield db
    finally:
        db.close()