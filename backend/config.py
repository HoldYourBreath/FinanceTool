#config.py
import os
from dotenv import load_dotenv

# Load environment variables from .env
load_dotenv()


class Config:
    SECRET_KEY = os.getenv('SECRET_KEY', 'default-secret-key')
    CORS_ORIGIN = os.getenv('CORS_ORIGIN', 'http://localhost:5173')

    SQLALCHEMY_DATABASE_URI = os.getenv('DATABASE_URL')
    SQLALCHEMY_TRACK_MODIFICATIONS = False


class DevelopmentConfig(Config):
    DEBUG = True


class ProductionConfig(Config):
    DEBUG = False
