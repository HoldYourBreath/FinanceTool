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
  "relative inline-flex items-center px-3 py-2 rounded-lg text-sm font-medium ring-1 ring-gray-200 transition";
const active = "bg-indigo-600 text-white ring-indigo-700 shadow-sm";
const idle = "bg-white text-gray-700 hover:bg-gray-50";

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 text-gray-800">
        {/* Top nav with active highlight */}
        <nav className="sticky top-0 z-40 bg-white/80 backdrop-blur border-b">
          <div className="mx-auto max-w-7xl px-3 py-3 flex flex-wrap gap-2">
            <NavLink
              to="/past-months"
              className={({ isActive }) => `${base} ${isActive ? active : idle}`}
              title="Past Months"
            >
              Past Months
            </NavLink>
            <NavLink
              to="/"
              end
              className={({ isActive }) => `${base} ${isActive ? active : idle}`}
              title="Monthly"
            >
              Monthly
            </NavLink>
            <NavLink
              to="/spending"
              className={({ isActive }) => `${base} ${isActive ? active : idle}`}
              title="Spending"
            >
              Spending
            </NavLink>
            <NavLink
              to="/investments"
              className={({ isActive }) => `${base} ${isActive ? active : idle}`}
              title="Investments"
            >
              Investments
            </NavLink>
            <NavLink
              to="/house-costs"
              className={({ isActive }) => `${base} ${isActive ? active : idle}`}
              title="House Costs"
            >
              House Costs
            </NavLink>
            <NavLink
              to="/settings"
              className={({ isActive }) => `${base} ${isActive ? active : idle}`}
              title="Settings"
            >
              Settings
            </NavLink>
            <NavLink
              to="/car-evaluation"
              className={({ isActive }) => `${base} ${isActive ? active : idle}`}
              title="Car Evaluation"
            >
              Car Evaluation
            </NavLink>
          </div>
        </nav>

        {/* Page content */}
        <main className="mx-auto max-w-7xl p-4">
          <Routes>
            <Route path="/past-months" element={<PastMonths />} />
            <Route path="/" element={<MonthlyOverview />} />
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
