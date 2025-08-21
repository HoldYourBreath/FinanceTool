import MultiToggle from "../MultiToggle";
import { TYPE_CHOICES } from "../../utils/normalizers";

export default function Filters({ filters, setFilters, catChoices }) {
  return (
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4 p-3 bg-gray-50 rounded border">
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
      <div className="col-span-1">
        <MultiToggle
          label="Type"
          options={TYPE_CHOICES}
          value={filters.type_of_vehicle}
          onChange={(v) => setFilters((f) => ({ ...f, type_of_vehicle: v }))}
        />
      </div>

      <div className="col-span-1 md:col-span-2 lg:col-span-4 flex items-end gap-2">
        <div className="flex-1">
          <label htmlFor="filter-q" className="block text-sm font-semibold mb-1">Search model</label>
          <input
            id="filter-q"
            className="w-full border rounded px-2 py-1"
            placeholder="e.g., Model Y, Ioniq 5"
            value={filters.q}
            onChange={(e) => setFilters((f) => ({ ...f, q: e.target.value }))}
          />
        </div>
        <button
          className="border px-3 py-2 rounded"
          onClick={() => setFilters({ body_style: [], eu_segment: [], suv_tier: [], type_of_vehicle: [], q: "" })}
        >
          Clear filters
        </button>
      </div>
    </div>
  );
}
