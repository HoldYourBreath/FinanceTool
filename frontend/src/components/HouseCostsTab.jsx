import { useEffect, useState } from "react";
import axios from "axios";

export default function HouseCostsTab() {
  const [houseCosts, setHouseCosts] = useState([]);
  const [landCosts, setLandCosts] = useState([]);
  const [newHouse, setNewHouse] = useState({ name: "", amount: "", status: "todo" });
  const [newLand, setNewLand] = useState({ name: "", amount: "", status: "todo" });

  const fetchData = async () => {
    try {
      const [houseRes, landRes] = await Promise.all([
        axios.get("/api/house_costs"),
        axios.get("/api/land_costs"),
      ]);
      setHouseCosts(houseRes.data);
      setLandCosts(landRes.data);
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
    if (!newItem.name || !newItem.amount) return alert("Please fill all fields");

    try {
      await axios.post(`/api/${type}_costs`, {
        name: newItem.name,
        amount: Number(newItem.amount),
        status: newItem.status,
      });
      // reset only the one we added
      type === "house"
        ? setNewHouse({ name: "", amount: "", status: "todo" })
        : setNewLand({ name: "", amount: "", status: "todo" });
      fetchData();
    } catch (error) {
      console.error(`Failed to add ${type} cost:`, error);
      alert(`Failed to add ${type} cost`);
    }
  };

  const handleDelete = async (type, id) => {
    try {
      await axios.delete(`/api/${type}_costs/${id}`);
      fetchData();
    } catch (error) {
      console.error(`Failed to delete ${type} cost:`, error);
      alert(`Failed to delete ${type} cost`);
    }
  };

  const inputCls =
    "rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-400";
  const selectCls =
    "rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400";
  const addBtnCls =
    "rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400";

  const renderAddForm = (type, state, setState) => (
    <div className="mt-4">
      <h3 className="font-semibold mb-2 text-slate-700">
        ➕ Add {type === "house" ? "House" : "Land"} Payment
      </h3>
      <div className="flex flex-wrap gap-2">
        <input
          type="text"
          placeholder="Name"
          value={state.name}
          onChange={(e) => setState({ ...state, name: e.target.value })}
          className={`${inputCls} w-48`}
          autoComplete="off"
        />
        <input
          type="number"
          placeholder="Amount"
          value={state.amount}
          onChange={(e) => setState({ ...state, amount: e.target.value })}
          className={`${inputCls} w-36`}
          inputMode="decimal"
        />
        <select
          value={state.status}
          onChange={(e) => setState({ ...state, status: e.target.value })}
          className={selectCls}
        >
          <option value="todo">⏳ Todo</option>
          <option value="done">✅ Done</option>
        </select>
        <button onClick={() => handleAdd(type)} className={addBtnCls}>
          Add
        </button>
      </div>
    </div>
  );

  // Colored cards for sections (static class strings to avoid Tailwind purge)
  const cardHouse =
    "rounded-2xl bg-emerald-50/70 ring-1 ring-emerald-200 p-4 shadow-sm backdrop-blur-sm";
  const cardLand =
    "rounded-2xl bg-sky-50/70 ring-1 ring-sky-200 p-4 shadow-sm backdrop-blur-sm";

  const renderSection = (title, data, form, variant = "house") => {
    const total = data.reduce((sum, item) => sum + Number(item.amount), 0);
    const doneItems = data.filter((item) => item.status === "done");
    const doneTotal = doneItems.reduce((sum, item) => sum + Number(item.amount), 0);
    const todoTotal = total - doneTotal;

    const isHouse = variant === "house";
    const cardCls = isHouse ? cardHouse : cardLand;

    return (
      <section className={`w-full md:w-1/2 p-2`}>
        <div className={cardCls}>
          <h2 className="text-lg font-bold mb-2 text-slate-800">{title}</h2>

          <div className="overflow-auto rounded-lg ring-1 ring-white/50">
            <table className="w-full table-auto text-sm border-separate border-spacing-0">
              <thead>
                <tr className="border-b font-semibold">
                  <th className="text-left py-2 pr-2 sticky top-0 bg-white/70 text-slate-700">
                    Name
                  </th>
                  <th className="text-right py-2 sticky top-0 bg-white/70 text-slate-700">
                    Amount
                  </th>
                  <th className="text-left py-2 pl-2 sticky top-0 bg-white/70 text-slate-700">
                    Status
                  </th>
                </tr>
              </thead>
              <tbody className="[&>tr:hover]:bg-white/60 [&>tr]:odd:bg-white/40">
                {data.map((item) => (
                  <tr key={item.id} className="group border-b border-gray-200 relative">
                    <td className="py-2 pr-2">{item.name}</td>
                    <td className="py-2 text-right">{formatSEK(item.amount)}</td>
                    <td className="pl-2">
                      <div className="flex items-center justify-between min-w-[130px]">
                        <span>{item.status === "done" ? "✅ Done" : "⏳ Todo"}</span>
                        <button
                          onClick={() => {
                            const confirmDelete = window.confirm(
                              `Are you sure you want to delete "${item.name}"?`,
                            );
                            if (confirmDelete) {
                              handleDelete(isHouse ? "house" : "land", item.id);
                            }
                          }}
                          className="opacity-0 group-hover:opacity-100 transition-opacity duration-200 bg-red-500 text-white px-2 py-1 text-xs rounded hover:bg-red-600 shadow ml-2"
                        >
                          Delete
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="mt-3 text-sm">
            <div>
              <strong>Total:</strong> {formatSEK(total)}
            </div>
            <div className="text-emerald-700">✅ Done: {formatSEK(doneTotal)}</div>
            <div className="text-slate-600">⏳ Todo: {formatSEK(todoTotal)}</div>
          </div>

          {form}
        </div>
      </section>
    );
  };

  const allCosts = [...houseCosts, ...landCosts];
  const totalItems = allCosts.length;
  const completedItems = allCosts.filter((i) => i.status === "done").length;
  const totalAmount = allCosts.reduce((sum, item) => sum + Number(item.amount), 0);
  const doneAmount = allCosts
    .filter((i) => i.status === "done")
    .reduce((sum, item) => sum + Number(item.amount), 0);
  const percentage = totalAmount > 0 ? (doneAmount / totalAmount) * 100 : 0;

  return (
    <div className="p-2">
      <div className="flex flex-col md:flex-row">
        {renderSection("🏠 House Payments", houseCosts, renderAddForm("house", newHouse, setNewHouse), "house")}
        {renderSection("🌱 Land Payments", landCosts, renderAddForm("land", newLand, setNewLand), "land")}
      </div>

      <section className="mt-4 rounded-2xl bg-white/70 ring-1 ring-emerald-200 p-4 shadow-sm backdrop-blur-sm text-sm">
        <strong>House Build Progress:</strong>
        <br />
        Items Completed: {completedItems} / {totalItems}
        <br />
        Cost Completed: {formatSEK(doneAmount)} / {formatSEK(totalAmount)}
        <br />
        <span className="text-emerald-700 font-semibold">
          {percentage.toFixed(1)}% of total build and land cost is DONE!
        </span>
      </section>
    </div>
  );
}
