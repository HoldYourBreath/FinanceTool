# scripts/seed_demo_all.py
from __future__ import annotations

import json
import os
import sys
from datetime import datetime, date
from pathlib import Path
from typing import Iterable, Sequence

from flask import Flask
from sqlalchemy import MetaData, text
from sqlalchemy.exc import SQLAlchemyError
from sqlalchemy.sql.sqltypes import Integer, Float, Numeric, String, Boolean

# ---- nullish handling ---------------------------------------------------------

NULLISH = {"", "null", "none", "nan", "n/a", "na"}


def _coerce_nullish(v):
    if isinstance(v, str) and v.strip().lower() in NULLISH:
        return None
    return v


def _default_for(col):
    """Provide a safe default only when necessary. Never synthesize FK values."""
    if col.nullable:
        return None
    if col.name.endswith("_id"):
        return None  # don't invent foreign keys
    t = col.type
    if isinstance(t, (Integer, Float, Numeric)):
        return 0
    if isinstance(t, Boolean):
        return False
    if isinstance(t, String):
        return ""
    return None


# --- Path bootstrap so we can import backend.* no matter where we run this ----

THIS_FILE = Path(__file__).resolve()
REPO_ROOT = THIS_FILE.parent.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

from backend.models.models import db  # noqa: E402

# ---- Optional dotenv loading --------------------------------------------------

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
    "cars",
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


def _to_datetime(obj) -> datetime:
    """Accept datetime/date or strings 'YYYY-MM-DD', 'YYYY/MM/DD', and 'YYYY-MM'/'YYYY/MM' (assume day 01)."""
    if isinstance(obj, datetime):
        return obj
    if isinstance(obj, date):
        return datetime(obj.year, obj.month, obj.day)
    s = str(obj).strip()
    # Accept YYYY-MM or YYYY/MM
    if len(s) == 7 and s[4] in "-/":
        s = s.replace("/", "-") + "-01"
    # Normalize YYYY/MM/DD -> YYYY-MM-DD
    if len(s) == 10 and s[4] in "-/" and s[7] in "-/":
        s = s.replace("/", "-")
    return datetime.fromisoformat(s)


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

        def _build_month_map() -> dict[tuple[int, int], int]:
            d: dict[tuple[int, int], int] = {}
            for mid, mdate in db.session.execute(
                text('SELECT id, month_date FROM "months" ORDER BY month_date')
            ).all():
                dt = _to_datetime(mdate)
                d[(dt.year, dt.month)] = mid
            return d

        target_tables = list(tables or DEFAULT_TABLES)
        skipped_samples: dict[str, list[dict]] = {}

        for name in target_tables:
            tbl = md.tables.get(f"public.{name}")
            if tbl is None:
                tbl = md.tables.get(name)

            seed_path = _resolve_seed_file(name, roots)
            if not seed_path:
                print(f"⚠️  Skip '{name}': no seed file found.")
                continue
            print(f"→ Using seed file for '{name}': {seed_path}")

            raw_rows = _load_rows(seed_path)
            if not isinstance(raw_rows, list) or not raw_rows:
                print(f"ℹ️  '{name}': 0 rows (seed file empty).")
                # still respect truncate for deterministic dev runs
                try:
                    if tbl is not None and truncate:
                        db.session.execute(tbl.delete())
                        db.session.commit()
                except Exception:
                    db.session.rollback()
                continue

            if tbl is None:
                print(f"❌ '{name}': table not found in metadata; skipping.")
                continue

            cols = {c.name: c for c in tbl.columns}
            pk_names = {c.name for c in tbl.primary_key.columns}  # e.g., {"id"}

            # Rebuild month map right before we need it (after 'months' is possibly inserted)
            month_id_by_ym = _build_month_map() if name in {"incomes", "expenses"} else None

            normalized_rows = []
            skipped = 0
            skipped_samples[name] = []

            for raw in raw_rows:
                # Start with only columns present in the table, excluding PKs
                r = {k: _coerce_nullish(v) for k, v in raw.items() if k in cols and k not in pk_names}

                # Coerce "*_id" == 0 -> None so we don't violate FKs
                for k in list(r.keys()):
                    if k.endswith("_id") and r[k] in (0, "0"):
                        r[k] = None

                # Special mapping for incomes/expenses: resolve month_id from year/month or month_date
                if name in {"incomes", "expenses"}:
                    if not r.get("month_id"):
                        y = raw.get("year")
                        m = raw.get("month")
                        mdate = raw.get("month_date")
                        resolved = None
                        if y and m:
                            try:
                                resolved = month_id_by_ym.get((int(y), int(m))) if month_id_by_ym else None
                            except Exception:
                                resolved = None
                        elif mdate:
                            try:
                                dt = _to_datetime(mdate)
                                resolved = month_id_by_ym.get((dt.year, dt.month)) if month_id_by_ym else None
                            except Exception:
                                resolved = None

                        if resolved:
                            r["month_id"] = resolved
                        else:
                            # can't safely map -> skip this row
                            skipped += 1
                            if len(skipped_samples[name]) < 10:
                                skipped_samples[name].append(
                                    {
                                        "raw_year": y,
                                        "raw_month": m,
                                        "raw_month_date": raw.get("month_date"),
                                    }
                                )
                            continue

                # Fill missing columns with defaults (but never for PKs)
                for cname, col in cols.items():
                    if cname in pk_names:
                        continue
                    if cname not in r:
                        r[cname] = _default_for(col)

                normalized_rows.append(r)

            try:
                if truncate:
                    db.session.execute(tbl.delete())
                if normalized_rows:
                    db.session.execute(tbl.insert(), normalized_rows)
                db.session.commit()
                msg = f"✅ '{name}': inserted {len(normalized_rows)} row(s)."
                if skipped:
                    msg += f" (skipped {skipped} unmapped row(s))"
                print(msg)
                if skipped and skipped_samples.get(name):
                    print(f"   ↳ examples of unmapped rows (up to 10): {skipped_samples[name]}")
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
        help=(
            "Comma-separated table list "
            "(defaults to acc_info,investments,months,incomes,expenses,financing,planned_purchases,cars)"
        ),
    )
    args = ap.parse_args()

    tables = None
    if args.tables:
        tables = tuple(s.strip() for s in args.tables.split(",") if s.strip())

    seed_all(truncate=not args.no_truncate, env_name=args.env, tables=tables)
