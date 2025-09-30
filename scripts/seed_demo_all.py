# scripts/seed_demo_all.py
from __future__ import annotations

import json
import os
import sys
from pathlib import Path
from typing import Iterable, Sequence

from sqlalchemy import MetaData, Table, text
from sqlalchemy.exc import SQLAlchemyError
from flask import Flask

# --- Path bootstrap so we can import backend.* no matter where we run this
THIS_FILE = Path(__file__).resolve()
REPO_ROOT = THIS_FILE.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.models.models import db  # noqa: E402

# ---- Optional dotenv loading
try:
    from dotenv import load_dotenv  # type: ignore

    def _load(p: Path) -> None:
        if p.exists():
            load_dotenv(p, override=True)

    _load(REPO_ROOT / ".env")
    _load(REPO_ROOT / ".env.local")
    env = os.getenv("APP_ENV")
    if env:
        _load(REPO_ROOT / f".env.{env}")
        _load(REPO_ROOT / "backend" / f".env.{env}")
    _load(REPO_ROOT / "backend" / ".env")
    _load(REPO_ROOT / "backend" / ".env.local")
except Exception:
    pass


# Default table list (override via --tables if desired)
DEFAULT_TABLES: Sequence[str] = (
    "acc_info",
    "investments",
    "months",
    "incomes",
    "expenses",
    "financing",
    "planned_purchases",
)

CAND_FILENAMES = (
    "seed_{name}.json",
    "{name}.json",
)


def _search_roots(env_name: str | None) -> list[Path]:
    roots: list[Path] = []
    if env_name:
        roots += [REPO_ROOT / "backend" / "seeds" / env_name, REPO_ROOT / "seeds" / env_name]
    roots += [REPO_ROOT / "backend" / "seeds" / "common", REPO_ROOT / "seeds" / "common"]
    # optional extras (lowest priority)
    roots += [REPO_ROOT / "backend" / "seeds", REPO_ROOT / "seeds"]

    out: list[Path] = []
    seen = set()
    for r in roots:
        rp = r.resolve()
        if rp not in seen:
            out.append(rp)
            seen.add(rp)
    return out


def _resolve_seed_file(name: str, roots: Iterable[Path]) -> Path | None:
    for root in roots:
        for pat in CAND_FILENAMES:
            cand = (root / pat.format(name=name)).resolve()
            if cand.exists():
                return cand
    return None


def _load_rows(path: Path) -> list[dict]:
    with path.open(encoding="utf-8") as f:
        data = json.load(f)
    # support {"<name>": [...]} or plain [...]
    if isinstance(data, dict):
        for v in data.values():
            if isinstance(v, list):
                return v
        raise ValueError(f"{path}: expected a list or an object containing a list.")
    if not isinstance(data, list):
        raise ValueError(f"{path}: expected a JSON list.")
    return data


def seed_all(
    truncate: bool = True,
    env_name: str | None = None,
    tables: Sequence[str] | None = None,
) -> None:
    env_name = env_name or os.getenv("APP_ENV") or os.getenv("FLASK_ENV")
    roots = _search_roots(env_name)

    db_uri = os.getenv("SQLALCHEMY_DATABASE_URI") or os.getenv("DATABASE_URL")
    if not db_uri:
        raise RuntimeError("Set SQLALCHEMY_DATABASE_URI or DATABASE_URL.")

    app = Flask("seed_all")
    app.config["SQLALCHEMY_DATABASE_URI"] = db_uri
    app.config["SQLALCHEMY_TRACK_MODIFICATIONS"] = False
    db.init_app(app)

    print(f"DB: {db_uri}")
    print("Search roots:")
    for r in roots:
        print(f" - {r}")

    with app.app_context():
        # ensure schema exists on a fresh DB
        db.create_all()

        md = MetaData()
        md.reflect(bind=db.engine, schema="public")

        target_tables = list(tables or DEFAULT_TABLES)

        for name in target_tables:
            tbl: Table | None = md.tables.get(f"public.{name}")
            if tbl is None:
                tbl = md.tables.get(name)  # tolerance for non-qualified keys
            if tbl is None:
                print(f"⚠️  Skip '{name}': table not found in DB schema.")
                continue

            seed_path = _resolve_seed_file(name, roots)
            if not seed_path:
                print(f"⚠️  Skip '{name}': no seed file found.")
                continue

            rows = _load_rows(seed_path)
            if not isinstance(rows, list) or not rows:
                print(f"ℹ️  '{name}': 0 rows (seed file empty).")
                continue

            # keep only known columns
            cols = {c.name for c in tbl.columns}
            insert_rows = [{k: v for k, v in r.items() if k in cols} for r in rows]

            try:
                if truncate:
                    db.session.execute(tbl.delete())
                db.session.execute(tbl.insert(), insert_rows)
                db.session.commit()
                print(f"✅ '{name}': inserted {len(insert_rows)} row(s).")
            except SQLAlchemyError as e:
                db.session.rollback()
                print(f"❌ '{name}': insert failed: {e}")

        # print final counts
        print("\nCounts:")
        for name in target_tables:
            try:
                n = db.session.execute(text(f'SELECT COUNT(*) FROM "{name}"')).scalar()
                print(f" - {name}: {n}")
            except Exception as e:
                db.session.rollback()
                print(f" - {name}: (error) {e}")


if __name__ == "__main__":
    import argparse

    ap = argparse.ArgumentParser(description="Seed multiple tables from JSON files.")
    ap.add_argument("--no-truncate", action="store_true", help="Do not delete existing rows first")
    ap.add_argument("--env", choices=["demo", "dev", "test", "prod"], help="Seed files environment to prefer")
    ap.add_argument(
        "--tables",
        help="Comma-separated table list (defaults to acc_info,investments,months,incomes,expenses,financing,planned_purchases)",
    )
    args = ap.parse_args()

    tables = None
    if args.tables:
        tables = tuple(s.strip() for s in args.tables.split(",") if s.strip())

    seed_all(truncate=not args.no_truncate, env_name=args.env, tables=tables)
