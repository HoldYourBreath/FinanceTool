# backend/utils/seeds.py
import os

SEED_SEARCH_DIRS = [
    os.getenv("SEED_DIR", "backend/seeds/demo"),
    "backend/seeds/private",
    "backend/seeds/common",
]

def resolve_seed(filename: str) -> str:
    """
    Return the first existing path for filename across:
    1) SEED_DIR (demo by default)
    2) backend/seeds/private (ignored)
    3) backend/seeds/common (committed)
    """
    for root in SEED_SEARCH_DIRS:
        path = os.path.join(root, filename)
        if os.path.exists(path):
            return path
    raise FileNotFoundError(f"Seed file not found in {SEED_SEARCH_DIRS}: {filename}")
