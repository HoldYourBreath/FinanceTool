# backend/seeds/seed_all.py
# ruff: noqa: E402
from __future__ import annotations

import os
import subprocess
import sys
from collections.abc import Iterable
from pathlib import Path

from dotenv import load_dotenv

from backend.utils.db_bootstrap import ensure_database_exists

# ------------------------------------------------------------
# Paths / env
# ------------------------------------------------------------
THIS_FILE = Path(__file__).resolve()
BACKEND_DIR = THIS_FILE.parents[1]
REPO_ROOT = BACKEND_DIR.parent

# Load .env (APP_ENV, DATABASE_URL, DEMO_DATABASE_URL, etc.)
load_dotenv(BACKEND_DIR / ".env")

DEFAULT_PYTHONPATH = os.environ.get("PYTHONPATH", "")
ENV = os.environ.copy()
ENV["PYTHONPATH"] = (
    f"{REPO_ROOT}{os.pathsep}{DEFAULT_PYTHONPATH}"
    if DEFAULT_PYTHONPATH
    else str(REPO_ROOT)
)


# ------------------------------------------------------------
# Helpers
# ------------------------------------------------------------
def _is_demo(env: dict[str, str]) -> bool:
    return (env.get("APP_ENV") or "").lower() == "demo"


def resolve_db_url(env: dict[str, str]) -> str | None:
    """
    For demo: prefer DEMO_DATABASE_URL; otherwise fallback to DATABASE_URL.
    For dev/other: DATABASE_URL.
    """
    if _is_demo(env):
        return env.get("DEMO_DATABASE_URL") or env.get("DATABASE_URL")
    return env.get("DATABASE_URL")


def _safe(url: str | None) -> str:
    if not url:
        return "<unset>"
    try:
        from urllib.parse import urlsplit, urlunsplit

        parts = urlsplit(url)
        if parts.password or parts.username:
            host = parts.hostname or ""
            user = parts.username or ""
            netloc = host
            if user:
                netloc = f"{user}:***@{netloc}"
            if parts.port:
                netloc = f"{netloc}:{parts.port}"
            return urlunsplit(
                (parts.scheme, netloc, parts.path, parts.query, parts.fragment)
            )
    except Exception:
        pass
    return url


def _run_module(module: str, message: str) -> None:
    print(message, flush=True)
    subprocess.run(
        [sys.executable, "-m", module],
        check=True,
        cwd=str(REPO_ROOT),  # run from repo root so absolute imports work
        env=ENV,
    )


def _has_flag(args: Iterable[str], *flags: str) -> bool:
    s = set(args)
    return any(f in s for f in flags)


# ------------------------------------------------------------
# Decide reset vs non-destructive schema bootstrap
# ------------------------------------------------------------
def build_steps(env: dict[str, str], args: list[str]) -> list[tuple[str, str]]:
    """
    Build the seed/migration plan.
    - If SEED_RESET=0 or --no-reset is passed: we DO NOT drop data.
      We try to 'bootstrap' the schema by adding missing columns/tables (idempotent).
    - Otherwise (default): full reset + create tables.
    """
    no_reset = (env.get("SEED_RESET", "1") in {"0", "false", "False"}) or _has_flag(
        args, "--no-reset", "-n"
    )
    steps: list[tuple[str, str]] = []

    if no_reset:
        # Non-destructive path: ensure DB objects/columns exist
        # These modules should be idempotent and safe on existing DBs.
        # If a step/module is missing in your repo, it's skipped gracefully.
        steps.append(
            (
                "backend.seeds.bootstrap_schema",
                "🛠  Bootstrapping schema (non-destructive)...",
            )
        )
        steps.append(("backend.seeds.create_db", "🧱 Ensuring tables exist..."))
    else:
        # Destructive path: full reset
        steps.append(
            ("backend.seeds.reset_db", "🔄 Resetting database (DROP & CREATE)...")
        )
        steps.append(("backend.seeds.create_db", "🧱 Creating tables..."))

    # Common seeders
    steps.extend(
        [
            ("backend.seeds.seed_months", "🌱 Seeding months..."),
            ("backend.seeds.seed_investments", "🌱 Seeding investments..."),
            ("backend.seeds.seed_house_land", "🌱 Seeding house and land costs..."),
            ("backend.seeds.seed_planned_purchases", "🌱 Seeding planned purchases..."),
            ("backend.seeds.seed_acc_info", "🌱 Seeding Account Info values..."),
            ("backend.seeds.seed_price_settings", "🌱 Seeding price settings..."),
            ("backend.seeds.seed_cars", "🌱 Seeding cars..."),
        ]
    )

    if _is_demo(env):
        steps.append(
            ("backend.seeds.seed_incomes_demo", "🌱 Seeding demo net salaries...")
        )

    return steps


def main() -> None:
    # Allow running a subset by passing module names as args
    # Example:
    #   python -m backend.seeds.seed_all backend.seeds.seed_months backend.seeds.seed_cars
    # Flags:
    #   --no-reset / -n  => run non-destructive bootstrap instead of reset_db
    args = [a for a in sys.argv[1:] if not a.startswith("-")]
    flags = [a for a in sys.argv[1:] if a.startswith("-")]

    eff = resolve_db_url(ENV)
    mode = (ENV.get("APP_ENV") or "dev").lower()

    # Ensure DB exists (create database if missing for Postgres URLs)
    pg_url = os.getenv("DATABASE_URL") or os.getenv("DEMO_DATABASE_URL")
    if pg_url and pg_url.startswith("postgresql+psycopg2://"):
        ensure_database_exists(pg_url)

    print(f"📦 REPO_ROOT: {REPO_ROOT}")
    print(f"🔧 APP_ENV:   {mode}")
    print(f"🔌 DATABASE:  {_safe(eff)}")
    if flags:
        print(f"⚙️  Flags:     {' '.join(flags)}")

    if not eff:
        print(
            "❌ No database URL set (DEMO_DATABASE_URL/DATABASE_URL). Aborting.",
            file=sys.stderr,
        )
        sys.exit(2)

    # Build plan, then optionally filter to only requested modules
    plan = build_steps(ENV, flags)
    if args:
        wanted = set(args)
        plan = [step for step in plan if step[0] in wanted]

    # Execute
    try:
        for module, message in plan:
            try:
                _run_module(module, message)
            except subprocess.CalledProcessError:
                raise
            except ModuleNotFoundError as mnfe:
                # Allow optional steps like bootstrap_schema to be absent
                print(f"⚠️  Optional step '{module}' not found: {mnfe}. Skipping.")
    except subprocess.CalledProcessError as e:
        print(
            f"❌ Seed step failed: {e.args} (returncode={e.returncode})",
            file=sys.stderr,
        )
        sys.exit(e.returncode)

    print("✅ All data seeded successfully.")


if __name__ == "__main__":
    main()
