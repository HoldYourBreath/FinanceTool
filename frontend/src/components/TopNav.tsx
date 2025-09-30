// src/components/TopNav.tsx
import { NavLink, useResolvedPath } from "react-router-dom";
import type React from "react";
import {
  Home,
  CalendarDays,
  Wallet,
  BarChart3,
  Wrench,
  Settings,
  Car,
} from "lucide-react";

type Tab = {
  to: string; // absolute path ("/x") or relative ("x")
  label: string;
  icon: React.ElementType;
  end?: boolean; // exact match? true only for "/"
};

const TABS: Tab[] = [
  { to: "/", label: "Monthly", icon: Home, end: true },
  { to: "/past-months", label: "Past Months", icon: CalendarDays },
  { to: "/spending", label: "Spending", icon: BarChart3 },
  { to: "/investments", label: "Investments", icon: Wallet },
  { to: "/house-costs", label: "House Costs", icon: Wrench },
  { to: "/settings", label: "Settings", icon: Settings },
  { to: "/car-evaluation", label: "Car Evaluation", icon: Car },
];

const base =
  "group inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition";
const idle =
  "bg-white/70 text-gray-700 ring-gray-200 hover:bg-white hover:shadow-sm";
const active = "bg-indigo-600 text-white ring-indigo-700 shadow-md";

// Safer helper to keep TS happy and avoid repeating the string concat
function linkClasses({
  isActive,
  isPending,
}: {
  isActive: boolean;
  isPending: boolean;
  // (react-router v6.22+ also supplies isTransitioning; we don't need it here)
}) {
  return `${base} ${isActive ? active : idle} ${isPending ? "opacity-60" : ""}`;
}

export default function TopNav() {
  // If your app uses <BrowserRouter basename="/app">, it’s safer to resolve paths.
  // This lets absolute-looking "to" work under a basename.
  const resolve = (to: string) => useResolvedPath(to).pathname;

  return (
    <nav className="sticky top-0 z-40 border-b bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600">
      <div className="mx-auto max-w-7xl px-3 py-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={resolve(to)}
              // pass `end` only when true (exact match for "/")
              {...(end ? { end: true } : {})}
              className={linkClasses}
              title={label}
            >
              <Icon size={16} className="opacity-90" />
              <span>{label}</span>
            </NavLink>
          ))}
        </div>
      </div>
    </nav>
  );
}
