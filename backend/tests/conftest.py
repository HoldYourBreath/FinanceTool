# backend/tests/conftest.py
import pathlib
import sys

# repo root = two levels up from this file
ROOT = pathlib.Path(__file__).resolve().parents[2]
p = str(ROOT)
if p not in sys.path:
    sys.path.insert(0, p)
