// src/App.jsx
import {
  BrowserRouter as Router,
  Routes,
  Route,
  NavLink,
} from "react-router-dom";

import PastMonths from "./components/PastMonths";
import MonthlyOverview from "./components/MonthlyOverview";
import Investments from "./components/Investments";
import SpendingPlanner from "./components/SpendingPlanner";
import HouseCostsTab from "./components/HouseCostsTab";
import Settings from "./components/Settings";
import CarEvaluation from "./components/CarEvaluation";
import EditAccInfo from "./components/EditAccInfo";

const base =
  "inline-flex items-center gap-2 rounded-xl px-3 py-2 text-sm font-medium ring-1 transition focus:outline-none focus-visible:ring-2 focus-visible:ring-white/80";
const idle =
  "bg-transparent text-white/90 ring-white/30 hover:bg-white/10 hover:text-white";
const active = "bg-white text-emerald-700 ring-white shadow-md font-semibold";

function TabLink({ to, end, label }) {
  return (
    <NavLink
      to={to}
      end={end}
      title={label}
      className={({ isActive }) => `${base} ${isActive ? active : idle}`}
    >
      {label}
    </NavLink>
  );
}

export default function App() {
  return (
    <Router>
      <a
        href="#main"
        className="sr-only focus:not-sr-only focus:fixed focus:top-2 focus:left-2 focus:z-50 bg-black text-white px-3 py-2 rounded"
      >
        Skip to content
      </a>

      {/* ✅ Gradient background for ALL pages */}
      <div className="min-h-screen bg-gradient-to-br from-emerald-50 via-teal-50 to-cyan-50 text-gray-900">
        <nav
          className="sticky top-0 z-40 border-b border-emerald-700/30 bg-gradient-to-r from-sky-500 via-cyan-600 to-emerald-600"
          aria-label="Primary"
        >
          <div className="mx-auto max-w-7xl px-3 py-3">
            <div className="flex flex-wrap gap-2">
              <TabLink to="/" end label="Monthly" />
              <TabLink to="/past-months" label="Past Months" />
              <TabLink to="/spending" label="Spending" />
              <TabLink to="/investments" label="Investments" />
              <TabLink to="/house-costs" label="House Costs" />
              <TabLink to="/settings" label="Settings" />
              <TabLink to="/car-evaluation" label="Car Evaluation" />
            </div>
          </div>
        </nav>

        <main id="main" className="mx-auto max-w-7xl p-4">
          <Routes>
            <Route path="/" element={<MonthlyOverview />} />
            <Route path="/past-months" element={<PastMonths />} />
            <Route path="/spending" element={<SpendingPlanner />} />
            <Route path="/investments" element={<Investments />} />
            <Route path="/house-costs" element={<HouseCostsTab />} />
            <Route path="/settings" element={<Settings />} />
            <Route path="/car-evaluation" element={<CarEvaluation />} />
            <Route path="/edit-acc-info" element={<EditAccInfo />} />
          </Routes>
        </main>
      </div>
    </Router>
  );
}
