# backend/tools/create_pg_db.py
import os
from urllib.parse import urlparse

import psycopg2

dsn = os.environ["DEMO_DATABASE_URL"]  # e.g. postgresql+psycopg2://postgres:admin@localhost:5432/financial_tracker_demo
u = urlparse(dsn.replace("+psycopg2",""))
db = u.path.lstrip("/") or "postgres"

admin = f"{u.scheme}://{u.username}:{u.password}@{u.hostname}:{u.port}/postgres"
conn = psycopg2.connect(admin)
conn.autocommit = True
cur = conn.cursor()
cur.execute("SELECT 1 FROM pg_database WHERE datname=%s", (db,))
if not cur.fetchone():
    cur.execute(f'CREATE DATABASE "{db}"')
    print("✅ created", db)
else:
    print("ℹ️  exists", db)
cur.close(); conn.close()
