# scripts/seed_investments.py
from __future__ import annotations

import argparse
import json
import os
import sys
from decimal import Decimal
from pathlib import Path
from typing import Iterable, Optional, Any, Dict, List, Tuple

# --- locate project roots ----------------------------------------------------
SCRIPT_DIR = Path(__file__).resolve().parent
BACKEND_DIR = SCRIPT_DIR.parent if SCRIPT_DIR.name == "scripts" else SCRIPT_DIR
REPO_ROOT = BACKEND_DIR.parent

for p in (str(BACKEND_DIR), str(REPO_ROOT)):
    if p not in sys.path:
        sys.path.insert(0, p)

# Optional: load .env / .env.local
try:
    from dotenv import load_dotenv  # type: ignore
    load_dotenv()
except Exception:
    pass

# Try both import styles
try:
    from app import create_app  # when running inside backend/
except ImportError:  # running from repo root as a package
    from backend.app import create_app  # type: ignore

try:
    from models.models import Investment, db  # when inside backend/
except ImportError:
    from backend.models.models import Investment, db  # type: ignore

# SQLAlchemy type checks (best-effort)
try:
    from sqlalchemy.sql.sqltypes import Numeric as SANumeric, Float as SAFloat, Integer as SAInteger, String as SAString, Boolean as SABoolean  # type: ignore
except Exception:
    SANumeric = SAFloat = SAInteger = SAString = SABoolean = object  # fallbacks

# ------------------------------------------------------------------------------
# Config
# ------------------------------------------------------------------------------
ENV_FILE_VAR = "SEED_FILE_INVESTMENTS"
ENV_DIR_VAR = "SEED_DIR"
CAND_FILENAMES = ("seed_investments.json", "investments.json")

FALLBACK_ROWS: list[dict] = []

_DB_URL = (os.getenv("DATABASE_URL") or os.getenv("SQLALCHEMY_DATABASE_URI") or "").lower()
USE_SQLITE = "sqlite" in _DB_URL

# ------------------------------------------------------------------------------
# Path resolution
# ------------------------------------------------------------------------------
def _search_roots() -> Iterable[Path]:
    env_dir = os.getenv(ENV_DIR_VAR)
    if env_dir:
        p = Path(env_dir)
        yield (REPO_ROOT / p) if not p.is_absolute() else p
    yield BACKEND_DIR / "seeds" / "private"
    yield BACKEND_DIR / "seeds" / "common"
    yield BACKEND_DIR / "seeds"
    yield BACKEND_DIR / "data"
    yield REPO_ROOT / "seeds"
    yield REPO_ROOT / "data"

def _resolve_seed_path(cli_path: Optional[str]) -> Optional[Path]:
    if cli_path:
        p = Path(cli_path)
        if not p.is_absolute():
            for base in (REPO_ROOT, BACKEND_DIR, Path.cwd()):
                cand = base / p
                if cand.exists():
                    return cand
        return p if p.exists() else None
    env_file = os.getenv(ENV_FILE_VAR)
    if env_file:
        p = Path(env_file)
        if not p.is_absolute():
            for base in (REPO_ROOT, BACKEND_DIR):
                cand = base / p
                if cand.exists():
                    return cand
        if p.exists():
            return p
    for root in _search_roots():
        for name in CAND_FILENAMES:
            cand = root / name
            if cand.exists():
                return cand
    return None

# ------------------------------------------------------------------------------
# Coercion helpers
# ------------------------------------------------------------------------------
def normalize_row(item: dict) -> dict:
    return _sanitize_item(item)

def _to_decimal(v: Any) -> Decimal:
    if v is None or (isinstance(v, str) and v.strip() == ""):
        return Decimal("0")
    if isinstance(v, Decimal):
        return v
    if isinstance(v, (int, float)):
        return Decimal(str(v))
    if isinstance(v, str):
        s = v.strip().replace(",", ".")
        try:
            return Decimal(s)
        except Exception:
            return Decimal("0")
    return Decimal("0")

def _to_float(v: Any) -> float:
    try:
        return float(_to_decimal(v))
    except Exception:
        return 0.0

def _to_int(v: Any) -> int:
    try:
        return int(_to_decimal(v).to_integral_value())
    except Exception:
        try:
            return int(float(_to_decimal(v)))
        except Exception:
            return 0

def _to_bool(v: Any) -> bool:
    if isinstance(v, bool):
        return v
    if isinstance(v, (int, float)):
        return v != 0
    if isinstance(v, str):
        return v.strip().lower() in {"1", "true", "t", "yes", "y", "on"}
    return False

# ------------------------------------------------------------------------------
# Sanitize per column type
# ------------------------------------------------------------------------------
def _sanitize_item(item: dict) -> dict:
    cols = {c.name: c for c in Investment.__table__.columns}  # type: ignore[attr-defined]
    out: dict = {}
    for name, col in cols.items():
        if name not in item:
            continue
        raw = item[name]
        t = col.type
        try:
            if isinstance(t, (SANumeric, SAFloat)):
                out[name] = _to_float(raw)  # avoid Decimal with SQLite
            elif isinstance(t, SAInteger):
                out[name] = _to_int(raw)
            elif isinstance(t, SABoolean):
                out[name] = _to_bool(raw)
            else:
                out[name] = raw.strip() if isinstance(raw, str) else raw
        except Exception:
            out[name] = raw
    return out

# ------------------------------------------------------------------------------
# Row discovery utilities
# ------------------------------------------------------------------------------
_LIST_KEYS_HINT = (
    "investments", "items", "holdings", "positions", "assets", "portfolio",
    "securities", "entries", "rows", "data", "records", "list", "values", "table"
)
_COL_KEYS = ("columns", "cols", "headers", "fields", "schema")
_ROW_KEYS = ("data", "rows", "values")

def _extract_colnames(cols: Any) -> Optional[List[str]]:
    if isinstance(cols, list) and cols and all(isinstance(c, str) for c in cols):
        return [str(c) for c in cols]
    if isinstance(cols, list) and cols and all(isinstance(c, dict) for c in cols):
        names: List[str] = []
        for c in cols:
            name = c.get("name") or c.get("field") or c.get("id")
            names.append(str(name) if name is not None else "")
        return names if any(n for n in names) else None
    if isinstance(cols, dict):
        inner = cols.get("fields") or cols.get("columns")
        return _extract_colnames(inner)
    return None

def _rows_from_columns_and_data(obj: dict) -> Optional[List[dict]]:
    colnames: Optional[List[str]] = None
    for ck in _COL_KEYS:
        if ck in obj:
            colnames = _extract_colnames(obj[ck])
            if colnames:
                break
    if not colnames:
        return None
    for rk in _ROW_KEYS:
        rows = obj.get(rk)
        if isinstance(rows, list) and rows:
            if isinstance(rows[0], (list, tuple)):
                out = []
                for r in rows:
                    out.append({colnames[i]: r[i] for i in range(min(len(colnames), len(r)))})
                return out
            if isinstance(rows[0], dict):
                return rows
    return None

def _dict_of_arrays_to_rows(d: dict) -> Optional[List[dict]]:
    # e.g. {"symbol":["AAPL","TSLA"], "qty":[10,5], "price":[...]}
    keys = list(d.keys())
    if not keys:
        return None
    arrays = [d[k] for k in keys if isinstance(d[k], list)]
    if not arrays or len(arrays) != len(keys):
        return None
    lengths = {len(a) for a in arrays}
    if len(lengths) != 1:
        return None
    n = lengths.pop()
    rows: List[dict] = []
    for i in range(n):
        rows.append({k: d[k][i] for k in keys})
    return rows

def _list_of_lists_to_rows(lst: list) -> Optional[List[dict]]:
    # if first row looks like header (all strings), use it; else generate col1..colN
    if not lst or not isinstance(lst[0], (list, tuple)):
        return None
    first = lst[0]
    if all(isinstance(x, str) for x in first):
        headers = [str(x) for x in first]
        data = lst[1:]
    else:
        m = max(len(r) for r in lst if isinstance(r, (list, tuple)))
        headers = [f"col{i+1}" for i in range(m)]
        data = lst
    out: List[dict] = []
    for r in data:
        if isinstance(r, (list, tuple)):
            out.append({headers[i]: r[i] for i in range(min(len(headers), len(r)))})
    return out if out else None

def _flatten_dict_of_lists(d: dict) -> List[dict]:
    out: List[dict] = []
    for v in d.values():
        if isinstance(v, list):
            out.extend([x for x in v if isinstance(x, dict)])
    return out

def _flatten_dict_of_dicts(d: dict) -> List[dict]:
    out: List[dict] = []
    for v in d.values():
        if isinstance(v, dict):
            vals = list(v.values())
            if vals and all(isinstance(x, dict) for x in vals):
                out.extend(vals)
    return out

def _walk_candidates(obj: Any, path: Tuple[str, ...], found: List[Tuple[Tuple[str, ...], List[dict]]]) -> None:
    if isinstance(obj, list):
        if obj and isinstance(obj[0], dict):
            found.append((path, obj))
        elif obj and isinstance(obj[0], (list, tuple)):
            rows = _list_of_lists_to_rows(obj)
            if rows:
                found.append((path + ("<list-of-lists>",), rows))
        else:
            for i, it in enumerate(obj):
                _walk_candidates(it, path + (f"[{i}]",), found)
    elif isinstance(obj, dict):
        tab = _rows_from_columns_and_data(obj)
        if tab:
            found.append((path + ("<columns+rows>",), tab))
        colar = _dict_of_arrays_to_rows(obj)
        if colar:
            found.append((path + ("<dict-of-arrays>",), colar))
        for k, v in obj.items():
            _walk_candidates(v, path + (k,), found)

def _best_candidate(cands: List[Tuple[Tuple[str, ...], List[dict]]]) -> Optional[Tuple[Tuple[str, ...], List[dict]]]:
    if not cands:
        return None
    def score(c: Tuple[Tuple[str, ...], List[dict]]) -> Tuple[int, int]:
        path, rows = c
        bonus = any(k in path for k in _LIST_KEYS_HINT)
        return (1 if bonus else 0, len(rows))
    cands.sort(key=score, reverse=True)
    return cands[0]

def _maybe_parse_text_blob(s: str) -> Any:
    # Try stringified JSON; else NDJSON; else CSV
    st = s.strip()
    if not st:
        return []
    # stringified JSON inside quotes?
    try:
        return json.loads(st)
    except Exception:
        pass
    # NDJSON
    lines = [ln for ln in st.splitlines() if ln.strip()]
    docs: List[Any] = []
    ndjson_ok = True
    for ln in lines:
        try:
            docs.append(json.loads(ln))
        except Exception:
            ndjson_ok = False
            break
    if ndjson_ok and docs and all(isinstance(d, dict) for d in docs):
        return docs
    # crude CSV (no quotes/escapes parsing)
    if "," in st:
        parts = [row.split(",") for row in lines]
        rows = _list_of_lists_to_rows(parts)
        if rows:
            return rows
    return []

def _discover_rows(data):
    # Accept top-level list or {"investments": [...]}, even if empty
    if isinstance(data, list):
        return data, "$"

    if isinstance(data, dict):
        for key in ("investments", "rows", "data"):
            if key in data:  # ← key existence, not truthiness
                val = data[key]
                if val is None:
                    return [], f"$.{key}"
                if isinstance(val, list):
                    return val, f"$.{key}"
                raise ValueError(f"Expected a list under '{key}', got {type(val).__name__}")
        # No recognized key? Treat as empty, not an error.
        return [], "$"

    raise ValueError(f"Unsupported seed data type: {type(data).__name__}")

# ------------------------------------------------------------------------------
# Data loading
# ------------------------------------------------------------------------------
def _load_rows(seed_file: Optional[Path]) -> Tuple[List[dict], str]:
    if not (seed_file and seed_file.exists()):
        return (FALLBACK_ROWS, "(missing)")
    with seed_file.open(encoding="utf-8") as f:
        data = json.load(f)
    rows, path = _discover_rows(data)
    return rows, path

# ------------------------------------------------------------------------------
# Seeding
# ------------------------------------------------------------------------------
# Seeding
def seed(seed_path: Optional[str], truncate: bool = True, dry_run: bool = False):
    resolved = _resolve_seed_path(seed_path)          # ← use your resolver
    print(f"📄 Seed file: {resolved if resolved else '(missing)'}")

    rows, from_path = _load_rows(resolved)            # ← pass Path|None
    print(f"🔎 Discovered {len(rows)} row(s) from {from_path}")

    with create_app().app_context():
        if truncate:
            print("🧹 Truncating investments table...")
            db.session.query(Investment).delete()
            if dry_run:
                db.session.rollback()
            else:
                db.session.commit()
            print("✅ Truncate complete.")

        if not rows:
            print("ℹ️ Seed file has no investments. Nothing to insert.")
            return

        for r in rows:
            db.session.add(Investment(**normalize_row(r)))

        if dry_run:
            db.session.rollback()
            print(f"✅ Dry-run complete. Would insert {len(rows)} rows.")
        else:
            db.session.commit()
            print(f"✅ Inserted {len(rows)} rows.")


# ------------------------------------------------------------------------------
# CLI
# ------------------------------------------------------------------------------
def _parse_args() -> argparse.Namespace:
    ap = argparse.ArgumentParser(description="Seed Investment rows.")
    ap.add_argument("--file", help=f"Path to seed file (overrides ${ENV_FILE_VAR})", default=None)
    ap.add_argument("--no-truncate", action="store_true", help="Do not delete existing rows first")
    ap.add_argument("--dry-run", action="store_true", help="Validate and show counts without writing")
    return ap.parse_args()

if __name__ == "__main__":
    args = _parse_args()
    seed(seed_path=args.file, truncate=not args.no_truncate, dry_run=args.dry_run)
