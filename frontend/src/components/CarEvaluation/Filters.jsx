import MultiToggle from "../MultiToggle";
import { TYPE_CHOICES } from "../../utils/normalizers";

export default function Filters({ filters, setFilters, catChoices }) {
  const clearFilters = () =>
    setFilters({
      body_style: [],
      eu_segment: [],
      suv_tier: [],
      type_of_vehicle: [],
      q: "",
      year_min: "",
      year_max: "",
    });

  return (
    <div className="p-3 bg-gray-50 rounded border space-y-2">
      {/* Top toolbar: Search + Year + Type + Clear */}
      <div className="flex flex-wrap items-end gap-2">
        {/* Search */}
        <div className="flex-1 min-w-[260px]">
          <label htmlFor="filter-q" className="block text-sm font-semibold mb-1">
            Search model
          </label>
          <input
            id="filter-q"
            className="w-full border rounded px-2 py-1"
            placeholder="e.g., Model Y, Ioniq 5"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>

        {/* Year range */}
        <div className="w-[200px]">
          {/* Use a span (not a label) for the section heading */}
          <span className="block text-sm font-semibold mb-1" id="year-range-label">
            Year (min–max)
          </span>
          <div
            className="flex items-center gap-1"
            aria-labelledby="year-range-label"
          >
            <label htmlFor="year-min" className="sr-only">
              Year minimum
            </label>
            <input
              id="year-min"
              type="number"
              inputMode="numeric"
              placeholder="Min"
              className="w-24 border rounded px-2 py-1"
              value={filters.year_min}
              onChange={(e) =>
                setFilters((f) => ({ ...f, year_min: e.target.value }))
              }
            />
            <span className="text-gray-400">–</span>
            <label htmlFor="year-max" className="sr-only">
              Year maximum
            </label>
            <input
              id="year-max"
              type="number"
              inputMode="numeric"
              placeholder="Max"
              className="w-24 border rounded px-2 py-1"
              value={filters.year_max}
              onChange={(e) =>
                setFilters((f) => ({ ...f, year_max: e.target.value }))
              }
            />
          </div>
        </div>

        {/* Type – horizontally scrollable chips to keep height tiny */}
        <div className="flex-1 min-w-[240px]">
          <div className="text-sm font-semibold mb-1">Type</div>
          <div className="overflow-x-auto whitespace-nowrap [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
            <MultiToggle
              label=""
              options={TYPE_CHOICES}
              value={filters.type_of_vehicle}
              onChange={(v) => setFilters((f) => ({ ...f, type_of_vehicle: v }))}
            />
          </div>
        </div>

        {/* Clear */}
        <button className="ml-auto border px-3 py-2 rounded" onClick={clearFilters}>
          Clear filters
        </button>
      </div>

      {/* Advanced (collapsed by default) */}
      <details className="group">
        <summary className="cursor-pointer select-none text-sm text-gray-700 hover:text-gray-900 flex items-center gap-2">
          <span className="inline-block px-2 py-1 border rounded bg-white">
            Advanced filters
          </span>
          <span className="text-gray-400 group-open:hidden">▼</span>
          <span className="text-gray-400 hidden group-open:inline">▲</span>
        </summary>

        <div className="pt-2 grid grid-cols-1 md:grid-cols-3 gap-3">
          <div className="col-span-1">
            <MultiToggle
              label="Body style"
              options={catChoices.body}
              value={filters.body_style}
              onChange={(v) => setFilters((f) => ({ ...f, body_style: v }))}
            />
          </div>
          <div className="col-span-1">
            <MultiToggle
              label="EU segment"
              options={catChoices.seg}
              value={filters.eu_segment}
              onChange={(v) => setFilters((f) => ({ ...f, eu_segment: v }))}
            />
          </div>
          <div className="col-span-1">
            <MultiToggle
              label="SUV tier"
              options={catChoices.suv}
              value={filters.suv_tier}
              onChange={(v) => setFilters((f) => ({ ...f, suv_tier: v }))}
            />
          </div>
        </div>
      </details>
    </div>
  );
}
