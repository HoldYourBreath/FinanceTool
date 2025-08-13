// src/App.jsx
import { BrowserRouter as Router, Routes, Route, NavLink } from "react-router-dom";
import PastMonths from './components/PastMonths';
import MonthlyOverview from "./components/MonthlyOverview";
import Investments from "./components/Investments";
import SpendingPlanner from "./components/SpendingPlanner";
import HouseCostsTab from "./components/HouseCostsTab";
import Settings from "./components/Settings";
import CarEvaluation from './components/CarEvaluation';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-100 text-gray-800 p-4">
        <nav className="flex gap-4 mb-6">
          <NavLink to="/past-months" className="px-4 py-2 rounded bg-purple-500 text-white hover:bg-purple-600">Past Months</NavLink>
          <NavLink to="/" className="px-4 py-2 rounded bg-blue-500 text-white hover:bg-blue-600">Monthly</NavLink>
          <NavLink to="/spending" className="px-4 py-2 rounded bg-yellow-500 text-white hover:bg-yellow-600">Spending</NavLink>
          <NavLink to="/investments" className="px-4 py-2 rounded bg-green-500 text-white hover:bg-green-600">Investments</NavLink>
          <NavLink to="/house-costs" className="px-4 py-2 rounded bg-purple-500 text-white hover:bg-purple-600">House Costs</NavLink>
          <NavLink to="/settings" className="px-4 py-2 rounded bg-purple-500 text-white hover:bg-purple-600">Settings</NavLink>
          <NavLink to="/car-evaluation" className="px-4 py-2 rounded bg-teal-500 text-white hover:bg-teal-600">Car Evaluation</NavLink>
        </nav>

        <Routes>
          <Route path="/past-months" element={<PastMonths />} />
          <Route path="/" element={<MonthlyOverview />} />
          <Route path="/spending" element={<SpendingPlanner />} />
          <Route path="/investments" element={<Investments />} />
          <Route path="/house-costs" element={<HouseCostsTab />} />
          <Route path="/settings" element={<Settings />} />
          <Route path="/car-evaluation" element={<CarEvaluation />} />
        </Routes>
      </div>
    </Router>
  );
}
