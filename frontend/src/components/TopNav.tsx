// src/components/TopNav.tsx
import { NavLink } from "react-router-dom";
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
  to: string;
  label: string;
  icon: React.ElementType;
  end?: boolean;
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

export default function TopNav() {
  return (
    <nav className="sticky top-0 z-40 border-b bg-gradient-to-r from-indigo-600 via-violet-600 to-fuchsia-600">
      <div className="mx-auto max-w-7xl px-3 py-3">
        <div className="flex flex-wrap gap-2">
          {TABS.map(({ to, label, icon: Icon, end }) => (
            <NavLink
              key={to}
              to={to}
              end={end}
              className={({ isActive }) =>
                `${base} ${isActive ? active : idle}`
              }
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
