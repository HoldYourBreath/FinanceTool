// src/components/TopNav.tsx
import { NavLink } from "react-router-dom";

type Tab = { to: string; label: string; end?: boolean };

const TABS: Tab[] = [
  { to: "/", label: "Monthly", end: true },
  { to: "/past-months", label: "Past Months" },
  { to: "/spending", label: "Spending" },
  { to: "/investments", label: "Investments" },
  { to: "/house-costs", label: "House Costs" },
  { to: "/settings", label: "Settings" },
  { to: "/car-evaluation", label: "Car Evaluation" },
];

const base =
  "relative inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium transition ring-1 ring-gray-200";
const active = "bg-indigo-600 text-white ring-indigo-700 shadow-sm";
const idle = "bg-white text-gray-700 hover:bg-gray-50";

export default function TopNav() {
  return (
    <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b" aria-label="Primary">
      <div className="mx-auto max-w-7xl px-3 py-3 flex flex-wrap gap-2">
        {TABS.map(({ to, label, end }) => (
          <NavLink
            key={to}
            to={to}
            end={end}
            className={({ isActive }) => `${base} ${isActive ? active : idle}`}
            title={label}
          >
            {label}
          </NavLink>
        ))}
      </div>
    </nav>
  );
}
