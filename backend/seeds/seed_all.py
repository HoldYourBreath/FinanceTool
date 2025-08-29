# backend/seeds/seed_all.py
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

# ----- paths / env -----
REPO_ROOT = Path(__file__).resolve().parents[2]  # project root
DEFAULT_PYTHONPATH = os.environ.get("PYTHONPATH", "")
ENV = os.environ.copy()
ENV["PYTHONPATH"] = f"{REPO_ROOT}{os.pathsep}{DEFAULT_PYTHONPATH}" if DEFAULT_PYTHONPATH else str(REPO_ROOT)

def _is_demo(env: dict[str, str]) -> bool:
    return (env.get("APP_ENV") or "").lower() == "demo"

def _effective_db_url(env: dict[str, str]) -> str | None:
    """
    For demo: prefer DEMO_DATABASE_URL; otherwise DATABASE_URL.
    For dev/other: DATABASE_URL.
    """
    if _is_demo(env):
        return env.get("DEMO_DATABASE_URL") or env.get("DATABASE_URL")
    return env.get("DATABASE_URL")

def _safe(url: str | None) -> str:
    if not url:
        return "<unset>"
    # redact password if any
    try:
        from urllib.parse import urlsplit, urlunsplit
        parts = urlsplit(url)
        if parts.password:
            netloc = parts.hostname or ""
            if parts.username:
                netloc = f"{parts.username}:***@{netloc}"
            if parts.port:
                netloc = f"{netloc}:{parts.port}"
            return urlunsplit((parts.scheme, netloc, parts.path, parts.query, parts.fragment))
    except Exception:
        pass
    return url

# ----- seed plan -----
STEPS: list[tuple[str, str]] = [
    ("backend.seeds.reset_db",               "🔄 Resetting database..."),
    ("backend.seeds.create_db",              "🧱 Creating tables..."),
    ("backend.seeds.seed_months",            "🌱 Seeding months..."),
    ("backend.seeds.seed_investments",       "🌱 Seeding investments..."),
    ("backend.seeds.seed_house_land",        "🌱 Seeding house and land costs..."),
    ("backend.seeds.seed_planned_purchases", "🌱 Seeding planned purchases..."),
    ("backend.seeds.seed_acc_info",          "🌱 Seeding Account Info values..."),
    ("backend.seeds.seed_price_settings",    "🌱 Seeding price settings..."),
    ("backend.seeds.seed_cars",              "🌱 Seeding cars..."),
]

# Append demo-only incomes seeder (net salaries only) when APP_ENV=demo
if _is_demo(ENV):
    STEPS.append(("backend.seeds.seed_incomes_demo", "🌱 Seeding demo net salaries..."))

def run_step(module: str, message: str) -> None:
    print(message, flush=True)
    subprocess.run(
        [sys.executable, "-m", module],
        check=True,
        cwd=str(REPO_ROOT),  # run from repo root so absolute imports work
        env=ENV,
    )

def main() -> None:
    # Allow running a subset: e.g.
    #   python -m backend.seeds.seed_all backend.seeds.seed_months backend.seeds.seed_incomes_demo
    only = set(sys.argv[1:])
    steps = [(m, msg) for (m, msg) in STEPS if not only or m in only]

    # Log target DB for safety (redacted)
    eff = _effective_db_url(ENV)
    mode = (ENV.get("APP_ENV") or "dev").lower()
    print(f"📦 REPO_ROOT: {REPO_ROOT}")
    print(f"🔧 APP_ENV:   {mode}")
    print(f"🔌 DATABASE:  {_safe(eff)}")

    if not eff:
        print("❌ No database URL set (DEMO_DATABASE_URL/DATABASE_URL). Aborting.", file=sys.stderr)
        sys.exit(2)

    try:
        for module, message in steps:
            run_step(module, message)
    except subprocess.CalledProcessError as e:
        print(f"❌ Seed step failed: {e.args} (returncode={e.returncode})", file=sys.stderr)
        sys.exit(e.returncode)

    print("✅ All data seeded successfully.")

if __name__ == "__main__":
    main()
