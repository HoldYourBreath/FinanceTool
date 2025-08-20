export default function MultiToggle({ label, options, value, onChange }) {
  return (
    <div>
      <div className="font-semibold mb-1">{label}</div>
      <div className="flex flex-wrap gap-2">
        {options.map((opt) => {
          const checked = value.includes(opt);
          const id = `${label}-${opt}`.replace(/\s+/g, "-").toLowerCase();
          return (
            <label
              key={opt}
              htmlFor={id}
              className={`flex items-center gap-1 border rounded px-2 py-1 cursor-pointer ${
                checked ? "bg-blue-50 border-blue-400" : ""
              }`}
            >
              <input
                id={id}
                type="checkbox"
                checked={checked}
                onChange={(e) => {
                  if (e.target.checked) onChange([...value, opt]);
                  else onChange(value.filter((v) => v !== opt));
                }}
              />
              <span>{opt}</span>
            </label>
          );
        })}
      </div>
    </div>
  );
}
