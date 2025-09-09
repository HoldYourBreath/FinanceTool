# backend/util/db_bootstrap.py
import re

import psycopg2


def ensure_database_exists(pg_url: str):
    # Expect: postgresql+psycopg2://user:pass@host:port/dbname
    m = re.match(r"postgresql\+psycopg2://([^:]+):([^@]+)@([^:/]+)(?::(\d+))?/([^?]+)", pg_url)
    if not m:
        raise ValueError(f"Cannot parse URL: {pg_url}")
    user, pwd, host, port, dbname = m.groups()
    port = port or "5432"
    # connect to default 'postgres' DB
    conn = psycopg2.connect(host=host, port=port, user=user, password=pwd, dbname="postgres")
    conn.autocommit = True
    cur = conn.cursor()
    cur.execute("SELECT 1 FROM pg_database WHERE datname=%s;", (dbname,))
    if cur.fetchone() is None:
        cur.execute(f'CREATE DATABASE "{dbname}";')
    cur.close()
    conn.close()
