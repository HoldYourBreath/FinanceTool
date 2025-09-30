# backend/seeds/seed_acc_info.py
# ruff: noqa: E402
from __future__ import annotations

import argparse
import contextlib
import json
import os
import sys
from collections.abc import Iterable
from decimal import Decimal
from pathlib import Path
from typing import Any

from sqlalchemy import delete as sa_delete

# --- Path bootstrap BEFORE importing backend.* ---
THIS_FILE = Path(__file__).resolve()
SCRIPT_DIR = THIS_FILE.parent
BACKEND_DIR = (
    SCRIPT_DIR.parent if SCRIPT_DIR.name in {"seeds", "scripts"} else SCRIPT_DIR
)
REPO_ROOT = BACKEND_DIR.parent
if str(REPO_ROOT) not in sys.path:
    sys.path.insert(0, str(REPO_ROOT))

# Now safe to import app/db
from backend.app import create_app
from backend.models.models import AccInfo, db

# -------------------------------------------------------------------
# Config
# -------------------------------------------------------------------
ENV_FILE_VAR = "SEED_FILE_ACC_INFO"  # direct file override
ENV_DIR_VAR = "SEED_DIR"  # optional extra directory
CAND_FILENAMES = ("seed_acc_info.json", "acc_info.json")

FALLBACK_ROWS: list[dict[str, Any]] = [
    {
        "person": "Demo",
        "bank": "DemoBank",
        "acc_number": "0000",
        "country": "SE",
        "value": 0,
    },
]


# -------------------------------------------------------------------
# Env loading
# -------------------------------------------------------------------
def _load_dotenv_for_env(env_name: str | None) -> None:
    """
    Load .env files with sensible precedence:
      1) repo/.env  and backend/.env
      2) repo/.env.local and backend/.env.local
      3) repo/.env.<env> and backend/.env.<env>  (if env_name provided)
    Later loads override earlier (override=True).
    """
    try:
        from dotenv import load_dotenv  # type: ignore
    except Exception:
        return

    def _load(path: Path) -> None:
        if path.exists():
            load_dotenv(path, override=True)

    # base
    _load(REPO_ROOT / ".env")
    _load(BACKEND_DIR / ".env")
    # local overrides
    _load(REPO_ROOT / ".env.local")
    _load(BACKEND_DIR / ".env.local")
    # env-specific overrides (crucial for demo/dev/test)
    if env_name:
        _load(REPO_ROOT / f".env.{env_name}")
        _load(BACKEND_DIR / f".env.{env_name}")


def _detect_env(cli_env: str | None) -> str | None:
    # CLI wins, else APP_ENV / FLASK_ENV, else None
    return cli_env or os.getenv("APP_ENV") or os.getenv("FLASK_ENV") or None


# -------------------------------------------------------------------
# File resolution
# -------------------------------------------------------------------
def _abs_candidates(bases: Iterable[Path], names: Iterable[str]) -> list[Path]:
    out: list[Path] = []
    for b in bases:
        for n in names:
            out.append((b / n).resolve())
    return out


def _search_roots(env_name: str | None) -> list[Path]:
    """
    New precedence to avoid 'private' hijacking demo runs:
      1) seeds/<env>  (both backend and repo), if env_name set
      2) seeds/common
      3) SEED_DIR (if set)
      4) seeds/private
      5) backend/seeds and repo/seeds (loose)
      6) backend/data and repo/data
    """
    roots: list[Path] = []

    if env_name:
        roots += [
            BACKEND_DIR / "seeds" / env_name,
            REPO_ROOT / "seeds" / env_name,
        ]

    roots += [BACKEND_DIR / "seeds" / "common", REPO_ROOT / "seeds" / "common"]

    env_dir = os.getenv(ENV_DIR_VAR)
    if env_dir:
        p = Path(env_dir)
        roots.append((REPO_ROOT / p) if not p.is_absolute() else p)

    roots += [BACKEND_DIR / "seeds" / "private", REPO_ROOT / "seeds" / "private"]
    roots += [
        BACKEND_DIR / "seeds",
        REPO_ROOT / "seeds",
        BACKEND_DIR / "data",
        REPO_ROOT / "data",
    ]

    # Deduplicate while keeping order
    seen = set()
    uniq: list[Path] = []
    for r in roots:
        rp = r.resolve()
        if rp not in seen:
            uniq.append(rp)
            seen.add(rp)
    return uniq


def _resolve_seed_path(cli_path: str | None, env_name: str | None) -> Path | None:
    # 1) CLI flag (relative resolved against REPO_ROOT, BACKEND_DIR, CWD)
    if cli_path:
        p = Path(cli_path)
        if not p.is_absolute():
            for base in (REPO_ROOT, BACKEND_DIR, Path.cwd()):
                cand = (base / p).resolve()
                if cand.exists():
                    return cand
        return p.resolve() if p.exists() else None

    # 2) Environment variable file
    env_file = os.getenv(ENV_FILE_VAR)
    if env_file:
        p = Path(env_file)
        if not p.is_absolute():
            for base in (REPO_ROOT, BACKEND_DIR, Path.cwd()):
                cand = (base / p).resolve()
                if cand.exists():
                    return cand
        return p.resolve() if p.exists() else None

    # 3) Known filenames in known dirs (env-first, then common, then SEED_DIR, then private)
    for root in _search_roots(env_name):
        for name in CAND_FILENAMES:
            cand = (root / name).resolve()
            if cand.exists():
                return cand

    return None


# -------------------------------------------------------------------
# IO helpers
# -------------------------------------------------------------------
def _to_float(v: Any) -> float:
    if v is None or v == "":
        return 0.0
    if isinstance(v, int | float):
        return float(v)
    if isinstance(v, str):
        s = v.strip().replace(",", ".")
        try:
            return float(Decimal(s))
        except Exception:
            return 0.0
    return 0.0


def _norm_country(v: Any) -> str:
    s = str(v or "").strip()
    return {"Sweden": "SE", "Sverige": "SE", "SE": "SE"}.get(s, s or "SE")


def _load_rows(seed_file: Path | None, allow_fallback: bool) -> tuple[list[dict], str]:
    if seed_file and seed_file.exists():
        with seed_file.open(encoding="utf-8") as f:
            data = json.load(f)
        rows = (
            data["acc_info"] if isinstance(data, dict) and "acc_info" in data else data
        )
        if not isinstance(rows, list):
            raise ValueError(
                "Seed JSON must be a list or contain key 'acc_info' as a list."
            )
        return rows, str(seed_file)
    if allow_fallback:
        return FALLBACK_ROWS, "(fallback in code)"
    raise FileNotFoundError(
        "Seed file not found. Pass --file, set SEED_FILE_ACC_INFO, or set APP_ENV / --env "
        "(searching seeds/<env> then seeds/common). Use --allow-fallback to insert demo row."
    )


# -------------------------------------------------------------------
# Seeding
# -------------------------------------------------------------------
def seed(
    seed_path: str | None,
    env_name: str | None,
    truncate: bool,
    dry_run: bool,
    allow_fallback: bool,
) -> None:
    # Load env files now that we know env_name
    _load_dotenv_for_env(env_name)

    # Resolve seed file with env-aware search
    seed_file = _resolve_seed_path(seed_path, env_name)

    print(f"📂 CWD: {Path.cwd()}")
    print(f"🌱 APP_ENV/FLASK_ENV/--env → {env_name or '(none)'}")
    print("🔎 Search roots (env-aware):")
    for r in _search_roots(env_name):
        print(f"   - {r}")
    print(f"📄 Resolved seed file: {seed_file if seed_file else '(not found)'}")
    print(
        f"🧪 Dry run: {'yes' if dry_run else 'no'} / Truncate first: {'yes' if truncate else 'no'}"
    )
    print(
        f"🪪 {ENV_DIR_VAR}={os.getenv(ENV_DIR_VAR)!r}  {ENV_FILE_VAR}={os.getenv(ENV_FILE_VAR)!r}"
    )

    rows, source = _load_rows(seed_file, allow_fallback=allow_fallback)
    print(f"🗂️  Loading {len(rows)} row(s) from: {source}")

    app = create_app()
    with app.app_context():
        with contextlib.suppress(Exception):
            print(f"🗄️  DB URL: {db.engine.url}")

        if truncate and not dry_run:
            db.session.execute(sa_delete(AccInfo))
            db.session.commit()
            print("🧹 Truncated acc_info")

        inserted = 0
        for item in rows:
            db.session.add(
                AccInfo(
                    person=str(item.get("person", "")).strip(),
                    bank=str(item.get("bank", "")).strip(),
                    acc_number=str(item.get("acc_number", "")).strip(),
                    country=_norm_country(item.get("country", "")),
                    value=_to_float(item.get("value", 0)),
                )
            )
            inserted += 1

        if dry_run:
            db.session.rollback()
            print(f"🔍 Dry-run: would insert {inserted} row(s).")
        else:
            db.session.commit()
            print(f"✅ Seeded {inserted} acc_info row(s).")


# -------------------------------------------------------------------
# CLI
# -------------------------------------------------------------------
def _parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Seed AccInfo rows.")
    ap.add_argument(
        "--env", choices=["demo", "dev", "test", "prod"], help="Environment to use"
    )
    ap.add_argument("--file", help=f"Path to seed file (overrides ${ENV_FILE_VAR})")
    ap.add_argument(
        "--no-truncate", action="store_true", help="Do not delete existing rows first"
    )
    ap.add_argument(
        "--dry-run",
        action="store_true",
        help="Validate and show counts without writing",
    )
    ap.add_argument(
        "--allow-fallback",
        action="store_true",
        help="Allow inserting the built-in demo row if no seed file is found",
    )
    return ap.parse_args()


if __name__ == "__main__":
    args = _parse_args()
    env_name = _detect_env(args.env)
    seed(
        seed_path=args.file,
        env_name=env_name,
        truncate=not args.no_truncate,
        dry_run=args.dry_run,
        allow_fallback=args.allow_fallback,
    )
