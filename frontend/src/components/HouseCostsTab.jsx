import React, { useEffect, useState } from "react";
import axios from "axios";

export default function HouseCostsTab() {
  const [houseCosts, setHouseCosts] = useState([]);
  const [landCosts, setLandCosts] = useState([]);
  const [newHouse, setNewHouse] = useState({
    name: "",
    amount: "",
    status: "todo",
  });
  const [newLand, setNewLand] = useState({
    name: "",
    amount: "",
    status: "todo",
  });

  const fetchData = async () => {
    try {
      const [houseRes, landRes] = await Promise.all([
        axios.get("/api/house_costs"),
        axios.get("/api/land_costs"),
      ]);
      setHouseCosts(houseRes.data);
      console.log("House:", houseRes.data);
      setLandCosts(landRes.data);
      console.log("Land:", landRes.data);
    } catch (error) {
      console.error("Failed to fetch house or land costs:", error);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const formatSEK = (amount) => {
    const num = Number(amount);
    return !isNaN(num) ? num.toLocaleString("sv-SE") + " SEK" : "";
  };

  const handleAdd = async (type) => {
    const newItem = type === "house" ? newHouse : newLand;
    if (!newItem.name || !newItem.amount)
      return alert("Please fill all fields");

    try {
      await axios.post(`/api/${type}_costs`, {
        name: newItem.name,
        amount: Number(newItem.amount),
        status: newItem.status,
      });
      setNewHouse({ name: "", amount: "", status: "todo" });
      setNewLand({ name: "", amount: "", status: "todo" });
      fetchData();
    } catch (error) {
      console.error(`Failed to add ${type} cost:`, error);
      alert(`Failed to add ${type} cost`);
    }
  };

  const renderAddForm = (type, state, setState) => (
    <div className="mt-4">
      <h3 className="font-semibold mb-1">
        ➕ Add {type === "house" ? "House" : "Land"} Payment
      </h3>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Name"
          value={state.name}
          onChange={(e) => setState({ ...state, name: e.target.value })}
          className="border p-1 rounded w-40"
        />
        <input
          type="number"
          placeholder="Amount"
          value={state.amount}
          onChange={(e) => setState({ ...state, amount: e.target.value })}
          className="border p-1 rounded w-32"
        />
        <select
          value={state.status}
          onChange={(e) => setState({ ...state, status: e.target.value })}
          className="border p-1 rounded"
        >
          <option value="todo">⏳ Todo</option>
          <option value="done">✅ Done</option>
        </select>
        <button
          onClick={() => handleAdd(type)}
          className="bg-blue-500 text-white px-3 py-1 rounded hover:bg-blue-600"
        >
          Add
        </button>
      </div>
    </div>
  );

  const handleDelete = async (type, id) => {
    try {
      await axios.delete(`/api/${type}_costs/${id}`);
      fetchData(); // refresh list
    } catch (error) {
      console.error(`Failed to delete ${type} cost:`, error);
      alert(`Failed to delete ${type} cost`);
    }
  };

  const renderSection = (title, data, form) => {
    const total = data.reduce((sum, item) => sum + Number(item.amount), 0);
    const doneItems = data.filter((item) => item.status === "done");
    const doneTotal = doneItems.reduce(
      (sum, item) => sum + Number(item.amount),
      0,
    );
    const todoTotal = total - doneTotal;

    return (
      <div className="w-full md:w-1/2 p-4">
        <h2 className="text-xl font-bold mb-2">{title}</h2>
        <table className="w-full table-auto text-sm">
          <thead>
            <tr className="border-b font-semibold">
              <th className="text-left py-1 pr-2">Name</th>
              <th className="text-right py-1">Amount</th>
              <th className="text-left py-1 pl-2">Status</th>
            </tr>
          </thead>
          <tbody>
            {data.map((item) => (
              <tr
                key={item.id}
                className="group border-b border-gray-200 hover:bg-gray-50 relative"
              >
                <td className="py-1 pr-2">{item.name}</td>
                <td className="py-1 text-right">{formatSEK(item.amount)}</td>
                <td className="pl-2 flex items-center justify-between min-w-[130px]">
                  <span>{item.status === "done" ? "✅ Done" : "⏳ Todo"}</span>
                  <button
                    onClick={() => {
                      const confirmDelete = window.confirm(
                        `Are you sure you want to delete "${item.name}"?`,
                      );
                      if (confirmDelete) {
                        handleDelete(
                          title.includes("House") ? "house" : "land",
                          item.id,
                        );
                      }
                    }}
                    className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-500 text-white px-2 py-1 text-xs rounded hover:bg-red-600 shadow ml-2"
                  >
                    Delete
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>

        <div className="mt-2 text-sm">
          <div>
            <strong>Total:</strong> {formatSEK(total)}
          </div>
          <div className="text-green-600">✅ Done: {formatSEK(doneTotal)}</div>
          <div className="text-gray-500">⏳ Todo: {formatSEK(todoTotal)}</div>
        </div>
        {form}
      </div>
    );
  };

  const allCosts = [...houseCosts, ...landCosts];
  const totalItems = allCosts.length;
  const completedItems = allCosts.filter((i) => i.status === "done").length;
  const totalAmount = allCosts.reduce(
    (sum, item) => sum + Number(item.amount),
    0,
  );
  const doneAmount = allCosts
    .filter((i) => i.status === "done")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const percentage = totalAmount > 0 ? (doneAmount / totalAmount) * 100 : 0;

  return (
    <div className="p-4 bg-white rounded shadow">
      <h1 className="text-2xl font-bold mb-4">🏠 House Cost Overview</h1>
      <div className="flex flex-col md:flex-row">
        {renderSection(
          "🏠 House Payments",
          houseCosts,
          renderAddForm("house", newHouse, setNewHouse),
        )}
        {renderSection(
          "🌱 Land Payments",
          landCosts,
          renderAddForm("land", newLand, setNewLand),
        )}
      </div>
      <div className="mt-4 text-sm">
        <strong>House Build Progress:</strong>
        <br />
        Items Completed: {completedItems} / {totalItems}
        <br />
        Cost Completed: {formatSEK(doneAmount)} / {formatSEK(totalAmount)}
        <br />
        <span className="text-green-700 font-semibold">
          {percentage.toFixed(1)}% of total build and land cost is DONE!
        </span>
      </div>
    </div>
  );
}
