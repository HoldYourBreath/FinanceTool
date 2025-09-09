import { useCallback, useEffect, useMemo, useState } from "react";
import PropTypes from "prop-types";
import MultiToggle from "../MultiToggle";
import { TYPE_CHOICES } from "../../utils/normalizers";

const labelCls = "block text-sm font-semibold mb-1 text-slate-700";
const inputCls =
  "w-full rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 text-sm shadow-inner " +
  "focus:outline-none focus:ring-2 focus:ring-emerald-400";
const chipScrollCls =
  "overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden";

const EMPTY = Object.freeze({
  body_style: [],
  eu_segment: [],
  suv_tier: [],
  type_of_vehicle: [],
  q: "",
  year_min: "",
  year_max: "",
});

export default function Filters({ filters, setFilters, catChoices }) {
  // Local state for debounced search (prevents thrashing parent state)
  const [qLocal, setQLocal] = useState(filters.q ?? "");

  // Keep local search in sync if filters change from outside
  useEffect(() => {
    setQLocal(filters.q ?? "");
  }, [filters.q]);

  // Debounce search -> pushes to parent after 250ms of idle
  useEffect(() => {
    const t = setTimeout(() => {
      setFilters((f) => (f.q === qLocal ? f : { ...f, q: qLocal }));
    }, 250);
    return () => clearTimeout(t);
  }, [qLocal, setFilters]);

  const clearFilters = useCallback(() => setFilters({ ...EMPTY }), [setFilters]);

  const isPristine = useMemo(() => {
    return (
      (filters.q ?? "") === "" &&
      (filters.year_min ?? "") === "" &&
      (filters.year_max ?? "") === "" &&
      (filters.type_of_vehicle?.length ?? 0) === 0 &&
      (filters.body_style?.length ?? 0) === 0 &&
      (filters.eu_segment?.length ?? 0) === 0 &&
      (filters.suv_tier?.length ?? 0) === 0
    );
  }, [filters]);

  const onYearMin = useCallback(
    (e) => {
      const v = e.target.value;
      // allow empty; otherwise clamp to a reasonable range
      setFilters((f) => ({ ...f, year_min: v === "" ? "" : String(Math.max(1980, +v)) }));
    },
    [setFilters]
  );

  const onYearMax = useCallback(
    (e) => {
      const v = e.target.value;
      setFilters((f) => ({ ...f, year_max: v === "" ? "" : String(Math.max(1980, +v)) }));
    },
    [setFilters]
  );

  const onTypeChange = useCallback(
    (v) => setFilters((f) => ({ ...f, type_of_vehicle: v })),
    [setFilters]
  );
  const onBodyChange = useCallback(
    (v) => setFilters((f) => ({ ...f, body_style: v })),
    [setFilters]
  );
  const onSegChange = useCallback(
    (v) => setFilters((f) => ({ ...f, eu_segment: v })),
    [setFilters]
  );
  const onSuvChange = useCallback(
    (v) => setFilters((f) => ({ ...f, suv_tier: v })),
    [setFilters]
  );

  return (
    <section
      className="rounded-2xl bg-emerald-50/70 ring-1 ring-emerald-200 p-4 shadow-sm backdrop-blur-sm space-y-3"
      aria-label="Car filters"
    >
      {/* Top toolbar: Search + Year + Type + Clear */}
      <div className="flex flex-wrap items-end gap-3">
        {/* Search */}
        <div className="flex-1 min-w-[260px]">
          <label htmlFor="filter-q" className={labelCls}>
            Search model
          </label>
          <input
            id="filter-q"
            className={inputCls}
            placeholder="e.g., Model Y, Ioniq 5"
            value={qLocal}
            onChange={(e) => setQLocal(e.target.value)}
            autoComplete="off"
            inputMode="search"
            aria-label="Search model"
          />
        </div>

        {/* Year range */}
        <div className="w-[220px]">
          <span className={labelCls} id="year-range-label">
            Year (min–max)
          </span>
          <div className="flex items-center gap-2" aria-labelledby="year-range-label">
            <label htmlFor="year-min" className="sr-only">
              Year minimum
            </label>
            <input
              id="year-min"
              type="number"
              inputMode="numeric"
              placeholder="Min"
              className={inputCls + " w-24"}
              value={filters.year_min}
              onChange={onYearMin}
              min={1980}
            />
            <span className="text-slate-400">–</span>
            <label htmlFor="year-max" className="sr-only">
              Year maximum
            </label>
            <input
              id="year-max"
              type="number"
              inputMode="numeric"
              placeholder="Max"
              className={inputCls + " w-24"}
              value={filters.year_max}
              onChange={onYearMax}
              min={1980}
            />
          </div>
        </div>

        {/* Type – horizontally scrollable chips */}
        <div className="flex-1 min-w-[240px]">
          <div className={labelCls}>Type</div>
          <div className={chipScrollCls}>
            <MultiToggle
              label=""
              options={TYPE_CHOICES}
              value={filters.type_of_vehicle}
              onChange={onTypeChange}
            />
          </div>
        </div>

        {/* Clear */}
        <button
          type="button"
          onClick={clearFilters}
          disabled={isPristine}
          className={
            "ml-auto rounded-lg border border-emerald-300 px-3 py-2 text-sm shadow-sm focus:outline-none focus:ring-2 focus:ring-emerald-400 " +
            (isPristine
              ? "bg-white/50 text-slate-400 cursor-not-allowed"
              : "bg-white/70 hover:bg-white")
          }
          title="Reset all filters"
          aria-disabled={isPristine}
        >
          Clear filters
        </button>
      </div>

      {/* Advanced (collapsed by default) */}
      <details className="group">
        <summary className="cursor-pointer select-none text-sm text-slate-700 hover:text-slate-900 flex items-center gap-2">
          <span className="inline-block px-2 py-1 rounded-lg bg-white/70 ring-1 ring-emerald-200 shadow-sm">
            Advanced filters
          </span>
          <span className="text-slate-400 group-open:hidden" aria-hidden="true">
            ▼
          </span>
          <span className="text-slate-400 hidden group-open:inline" aria-hidden="true">
            ▲
          </span>
        </summary>

        <div className="pt-3 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-1">
            <MultiToggle
              label="Body style"
              options={catChoices.body}
              value={filters.body_style}
              onChange={onBodyChange}
            />
          </div>
          <div className="col-span-1">
            <MultiToggle
              label="EU segment"
              options={catChoices.seg}
              value={filters.eu_segment}
              onChange={onSegChange}
            />
          </div>
          <div className="col-span-1">
            <MultiToggle
              label="SUV tier"
              options={catChoices.suv}
              value={filters.suv_tier}
              onChange={onSuvChange}
            />
          </div>
        </div>
      </details>
    </section>
  );
}

Filters.propTypes = {
  filters: PropTypes.shape({
    body_style: PropTypes.arrayOf(PropTypes.string).isRequired,
    eu_segment: PropTypes.arrayOf(PropTypes.string).isRequired,
    suv_tier: PropTypes.arrayOf(PropTypes.string).isRequired,
    type_of_vehicle: PropTypes.arrayOf(PropTypes.string).isRequired,
    q: PropTypes.string.isRequired,
    year_min: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
    year_max: PropTypes.oneOfType([PropTypes.string, PropTypes.number]).isRequired,
  }).isRequired,
  setFilters: PropTypes.func.isRequired,
  catChoices: PropTypes.shape({
    body: PropTypes.array.isRequired,
    seg: PropTypes.array.isRequired,
    suv: PropTypes.array.isRequired,
  }).isRequired,
};
