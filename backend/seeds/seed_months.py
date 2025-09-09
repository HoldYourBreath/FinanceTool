# backend/seeds/seed_months.py
from __future__ import annotations

import argparse
import json
import os
import sys
from collections.abc import Iterable
from datetime import date, datetime
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import text

# ------------------------------------------------------------------------------
# Resolve paths so the module works when run from repo root or backend/
# ------------------------------------------------------------------------------
THIS_FILE = Path(__file__).resolve()
BACKEND_DIR = THIS_FILE.parents[1]          # .../backend
REPO_ROOT = BACKEND_DIR.parent              # repo root

# Ensure repo root on sys.path so `backend.*` imports work
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Optionally load .env files (ignore if dotenv not installed)
try:
    from dotenv import load_dotenv  # type: ignore

    # Load typical locations (repo root and backend/)
    for env_file in (REPO_ROOT / ".env", BACKEND_DIR / ".env", REPO_ROOT / ".env.local", BACKEND_DIR / ".env.local"):
        if env_file.exists():
            load_dotenv(env_file)
except Exception:
    pass

# Use explicit package imports (consistent everywhere)
from backend.app import create_app  # noqa: E402
from backend.models.models import Expense, Income, LoanAdjustment, Month, db  # noqa: E402

# ------------------------------------------------------------------------------
# Config
# ------------------------------------------------------------------------------
ENV_FILE_VAR = "SEED_FILE_MONTHS"  # direct file override
ENV_DIR_VAR = "SEED_DIR"           # directory override (demo/private/common)
CAND_FILENAMES = ("seed_months.json", "months.json")

CATEGORY_MAP = {
    "Rent": "Housing",
    "Loan Payment": "Housing",
    "Staffanstorps kommun": "Housing",
    "Anslutning EL": "Housing",
    "House Costs": "Housing",
    "Car Insurance": "Transportation",
    "Car Diesel": "Transportation",
    "Car Tax": "Transportation",
    "Car Maintenance": "Transportation",
    "Car tire change": "Transportation",
    "Car Parking": "Transportation",
    "Public Transport": "Transportation",
    "Foods": "Food",
    "Groceries": "Food",
    "Daycare": "Childcare and Family",
    "Phones": "Phones",
    "Subscriptions": "Subscriptions",
    "Union": "Union and Insurance",
    "Dentist": "Other",
    "Olivers Birthday": "Entertainment and Leisure",
    "Moving Company": "Entertainment and Leisure",
    "Presents": "Entertainment and Leisure",
    "Christmas Extra Costs": "Entertainment and Leisure",
    "New Years Party": "Entertainment and Leisure",
    "Vacation": "Entertainment and Leisure",
    "Other": "Other",
}

FALLBACK_MONTHS: list[dict[str, Any]] = []  # If no seed file, seed nothing


# ------------------------------------------------------------------------------
# Path resolution
# ------------------------------------------------------------------------------
def _search_roots() -> Iterable[Path]:
    """Directories to search when only a filename is known."""
    env_dir = os.getenv(ENV_DIR_VAR)
    if env_dir:
        yield (REPO_ROOT / env_dir) if not os.path.isabs(env_dir) else Path(env_dir)

    # Conventional locations in this repo layout
    yield BACKEND_DIR / "seeds" / "private"  # ignored in VCS, real data (if present)
    yield BACKEND_DIR / "seeds" / "common"   # committed (shared)
    yield BACKEND_DIR / "seeds"              # committed (demo)
    yield BACKEND_DIR / "data"               # legacy
    yield REPO_ROOT / "seeds"
    yield REPO_ROOT / "data"


def _resolve_seed_path(cli_path: str | None) -> Path | None:
    # 1) CLI argument
    if cli_path:
        p = Path(cli_path)
        if not p.is_absolute():
            rp = REPO_ROOT / p
            if rp.exists():
                return rp
        return p if p.exists() else None

    # 2) Direct file via env var
    env_file = os.getenv(ENV_FILE_VAR)
    if env_file:
        p = Path(env_file)
        if not p.is_absolute():
            rp = REPO_ROOT / p
            if rp.exists():
                return rp
        if p.exists():
            return p

    # 3) Search known roots for known filenames
    for root in _search_roots():
        for name in CAND_FILENAMES:
            cand = root / name
            if cand.exists():
                return cand

    return None


# ------------------------------------------------------------------------------
# Helpers
# ------------------------------------------------------------------------------
def _to_amount(v: Any) -> float:
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return 0.0
    if isinstance(v, (int, float)):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace(",", ".")
        try:
            return float(Decimal(s))
        except Exception:
            return 0.0
    return 0.0


def _to_bool(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    if isinstance(v, str):
        return v.strip().lower() in {"1", "true", "t", "yes", "y", "on"}
    return False


def _parse_date(v: Any) -> date | None:
    if v is None:
        return None
    if isinstance(v, date) and not isinstance(v, datetime):
        return v
    if isinstance(v, datetime):
        return v.date()
    if isinstance(v, str):
        s = v.strip()
        if not s:
            return None
        # ISO (support trailing Z)
        try:
            iso = s.replace("Z", "+00:00") if s.endswith("Z") else s
            return datetime.fromisoformat(iso).date()
        except Exception:
            pass
        # YYYY-MM -> first of month
        try:
            return datetime.strptime(s, "%Y-%m").date().replace(day=1)
        except Exception:
            pass
        for fmt in ("%Y-%m-%d", "%Y/%m/%d", "%d.%m.%Y", "%d/%m/%Y", "%m/%d/%Y"):
            try:
                return datetime.strptime(s, fmt).date()
            except Exception:
                continue
    return None


def _cat(name: str) -> str:
    return CATEGORY_MAP.get(name, "Other")


def _load_months(seed_file: Path | None) -> list[dict[str, Any]]:
    """
    Supports:
      1) {"months":[...]}  (preferred)
      2) [{"name": "...", ...}, ...]  (top-level list)
    """
    if seed_file and seed_file.exists():
        data = json.loads(seed_file.read_text(encoding="utf-8") or "[]")
        rows = data["months"] if isinstance(data, dict) and "months" in data else data
        if not isinstance(rows, list):
            raise ValueError("Seed JSON must be a list or contain key 'months' as a list.")
        return rows
    return FALLBACK_MONTHS


# ------------------------------------------------------------------------------
# Seeding
# ------------------------------------------------------------------------------
def seed(seed_path: str | None = None, *, truncate: bool = True, dry_run: bool = False) -> None:
    app = create_app()
    seed_file = _resolve_seed_path(seed_path)

    print(f"📂 CWD: {Path.cwd()}")
    print(f"📄 Seed file: {seed_file if seed_file else '(missing → seeding nothing)'}")
    print(f"🧪 Dry run: {'yes' if dry_run else 'no'} / Truncate first: {'yes' if truncate else 'no'}")

    months_data = _load_months(seed_file)
    print(f"📦 Parsed months: {len(months_data)}")

    with app.app_context():
        if truncate and not dry_run:
            # Delete children first, then parent, to satisfy FK constraints
            db.session.execute(text("DELETE FROM incomes"))
            db.session.execute(text("DELETE FROM expenses"))
            db.session.execute(text("DELETE FROM loan_adjustments"))
            db.session.execute(text("DELETE FROM months"))
            db.session.commit()

        ins_months = ins_incomes = ins_expenses = ins_adjusts = 0

        for m in months_data:
            month = Month(
                name=str(m.get("name", "")).strip(),
                starting_funds=_to_amount(m.get("starting_funds", 0)),
                month_date=_parse_date(m.get("month_date")),
                is_current=_to_bool(m.get("is_current", False)),
            )

            for inc in m.get("incomes", []):
                month.incomes.append(
                    Income(
                        name=str(inc.get("name", "")).strip(),
                        amount=_to_amount(inc.get("amount", 0)),
                        source=str(inc.get("source", inc.get("name", ""))).strip(),
                    )
                )
                ins_incomes += 1

            for exp in m.get("expenses", []):
                nm = str(exp.get("name", "")).strip()
                month.expenses.append(
                    Expense(
                        amount=_to_amount(exp.get("amount", 0)),
                        description=nm,
                        category=_cat(nm),
                    )
                )
                ins_expenses += 1

            for adj in m.get("loan_adjustments", []):
                month.loan_adjustments.append(
                    LoanAdjustment(
                        name=str(adj.get("name", "")).strip(),
                        amount=_to_amount(adj.get("amount", 0)),
                        note=adj.get("note"),
                        type=adj.get("type"),
                    )
                )
                ins_adjusts += 1

            db.session.add(month)
            ins_months += 1

        if dry_run:
            db.session.rollback()
            print(
                "🔍 Dry-run complete: would insert "
                f"{ins_months} months, {ins_incomes} incomes, {ins_expenses} expenses, {ins_adjusts} loan adjustments."
            )
        else:
            db.session.commit()
            print(
                "✅ Seeded "
                f"{ins_months} months, {ins_incomes} incomes, {ins_expenses} expenses, {ins_adjusts} loan adjustments."
            )


# ------------------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------------------
def _parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Seed Month, Income, Expense, and LoanAdjustment rows.")
    ap.add_argument("--file", help=f"Path to seed file (overrides ${ENV_FILE_VAR})", default=None)
    ap.add_argument("--no-truncate", action="store_true", help="Do not delete existing rows first")
    ap.add_argument("--dry-run", action="store_true", help="Validate and show counts without writing")
    return ap.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    seed(seed_path=args.file, truncate=not args.no_truncate, dry_run=args.dry_run)
