# backend/seeds/seed_all.py
from __future__ import annotations

import os
import subprocess
import sys
from pathlib import Path

# Ensure "import backend.*" works no matter where we run from
REPO_ROOT = Path(__file__).resolve().parents[2]
ENV = os.environ.copy()
ENV["PYTHONPATH"] = str(REPO_ROOT) + (os.pathsep + ENV.get("PYTHONPATH", ""))

STEPS: list[tuple[str, str]] = [
    ("backend.seeds.reset_db",            "🔄 Resetting database..."),
    ("backend.seeds.create_db",           "🧱 Creating tables..."),
    ("backend.seeds.seed_months",         "🌱 Seeding months..."),
    ("backend.seeds.seed_investments",    "🌱 Seeding investments..."),
    ("backend.seeds.seed_house_land",     "🌱 Seeding house and land costs..."),
    ("backend.seeds.seed_planned_purchases", "🌱 Seeding planned purchases..."),
    ("backend.seeds.seed_acc_info",       "🌱 Seeding Account Info values..."),
    ("backend.seeds.seed_price_settings", "🌱 Seeding price settings..."),
    ("backend.seeds.seed_cars",           "🌱 Seeding cars..."),
]


def run_step(module: str, message: str) -> None:
    print(message, flush=True)
    # Run each seeder as a module from the repo root so absolute imports work.
    subprocess.run(
        [sys.executable, "-m", module],
        check=True,
        cwd=str(REPO_ROOT),
        env=ENV,
    )


def main() -> None:
    # Allow: python -m backend.seeds.seed_all backend.seeds.seed_months backend.seeds.seed_cars
    # to run a subset. With no args, run all steps.
    only = set(sys.argv[1:])
    steps = [(m, msg) for (m, msg) in STEPS if not only or m in only]

    try:
        for module, message in steps:
            run_step(module, message)
    except subprocess.CalledProcessError as e:
        print(f"❌ Seed step failed: {e.args} (returncode={e.returncode})", file=sys.stderr)
        sys.exit(e.returncode)

    print("✅ All data seeded successfully.")


if __name__ == "__main__":
    main()
