// src/components/HouseCostsTab.jsx
import { useEffect, useRef, useState } from "react";
import api from "../api/axios";

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
  const [toast, setToast] = useState("");
  const didFetch = useRef(false); // ← prevents StrictMode double fetch

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const fetchData = async (signal) => {
    const [houseRes, landRes] = await Promise.all([
      api.get("/house_costs", { signal }),
      api.get("/land_costs", { signal }),
    ]);
    setHouseCosts(Array.isArray(houseRes.data) ? houseRes.data : []);
    setLandCosts(Array.isArray(landRes.data) ? landRes.data : []);
  };

  useEffect(() => {
    if (didFetch.current) return;
    didFetch.current = true;

    const controller = new AbortController();
    fetchData(controller.signal).catch((e) => {
      if (!controller.signal.aborted) {
        console.error("Failed to fetch costs", e);
        flash("❌ Failed to fetch costs");
      }
    });
    return () => controller.abort();
  }, []);

  const formatSEK = (amount) => {
    const num = Number(amount);
    return Number.isFinite(num) ? `${num.toLocaleString("sv-SE")} SEK` : "";
  };

  const parseAmount = (v) => {
    const n = typeof v === "string" ? v.replace(",", ".") : v;
    const f = parseFloat(n);
    return Number.isFinite(f) ? f : NaN;
  };

  const handleAdd = async (type) => {
    const isHouse = type === "house";
    const src = isHouse ? newHouse : newLand;

    const amt = parseAmount(src.amount);
    if (!src.name.trim() || !Number.isFinite(amt) || amt <= 0) {
      return alert("Please enter a name and a positive amount.");
    }

    const payload = {
      name: src.name.trim(),
      amount: amt,
      status: src.status || "todo",
    };

    // optimistic insert
    const tempId = `temp-${Date.now()}`;
    const optimistic = { id: tempId, ...payload };
    if (isHouse) setHouseCosts((xs) => [optimistic, ...xs]);
    else setLandCosts((xs) => [optimistic, ...xs]);

    try {
      const { data } = await api.post(`/${type}_costs`, payload);
      const real = { id: data?.id ?? tempId, ...payload };

      if (isHouse) {
        setHouseCosts((xs) => [real, ...xs.filter((x) => x.id !== tempId)]);
        setNewHouse({ name: "", amount: "", status: "todo" });
      } else {
        setLandCosts((xs) => [real, ...xs.filter((x) => x.id !== tempId)]);
        setNewLand({ name: "", amount: "", status: "todo" });
      }
      flash("✅ Added");
    } catch (error) {
      // rollback
      if (isHouse) setHouseCosts((xs) => xs.filter((x) => x.id !== tempId));
      else setLandCosts((xs) => xs.filter((x) => x.id !== tempId));
      console.error(`Failed to add ${type} cost:`, error);
      alert(`Failed to add ${type} cost`);
    }
  };

  const handleDelete = async (type, id) => {
    const isHouse = type === "house";
    const prevHouse = houseCosts;
    const prevLand = landCosts;

    // optimistic remove
    if (isHouse) setHouseCosts((xs) => xs.filter((x) => x.id !== id));
    else setLandCosts((xs) => xs.filter((x) => x.id !== id));

    try {
      await api.delete(`/${type}_costs/${id}`);
      flash("🗑️ Deleted");
    } catch (error) {
      // rollback
      setHouseCosts(prevHouse);
      setLandCosts(prevLand);
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
          step="0.01"
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

  const cardHouse =
    "rounded-2xl bg-emerald-50/70 ring-1 ring-emerald-200 p-4 shadow-sm backdrop-blur-sm";
  const cardLand =
    "rounded-2xl bg-sky-50/70 ring-1 ring-sky-200 p-4 shadow-sm backdrop-blur-sm";

  const renderSection = (title, data, form, variant = "house") => {
    const total = data.reduce((sum, item) => sum + Number(item.amount || 0), 0);
    const doneItems = data.filter((item) => item.status === "done");
    const doneTotal = doneItems.reduce((s, i) => s + Number(i.amount || 0), 0);
    const todoTotal = total - doneTotal;

    const isHouse = variant === "house";
    const cardCls = isHouse ? cardHouse : cardLand;

    return (
      <section className="w-full md:w-1/2 p-2">
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
                  <tr
                    key={item.id}
                    className="group border-b border-gray-200 relative"
                  >
                    <td className="py-2 pr-2">{item.name}</td>
                    <td className="py-2 text-right">
                      {formatSEK(item.amount)}
                    </td>
                    <td className="pl-2">
                      <div className="flex items-center justify-between min-w-[130px]">
                        <span>
                          {item.status === "done" ? "✅ Done" : "⏳ Todo"}
                        </span>
                        <button
                          onClick={() => {
                            if (window.confirm(`Delete "${item.name}"?`)) {
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
            <div className="text-emerald-700">
              ✅ Done: {formatSEK(doneTotal)}
            </div>
            <div className="text-slate-600">
              ⏳ Todo: {formatSEK(todoTotal)}
            </div>
          </div>

          {form}
        </div>
      </section>
    );
  };

  const allCosts = [...houseCosts, ...landCosts];
  const totalItems = allCosts.length;
  const completedItems = allCosts.filter((i) => i.status === "done").length;
  const totalAmount = allCosts.reduce(
    (sum, item) => sum + Number(item.amount || 0),
    0,
  );
  const doneAmount = allCosts
    .filter((i) => i.status === "done")
    .reduce((sum, item) => sum + Number(item.amount || 0), 0);
  const percentage = totalAmount > 0 ? (doneAmount / totalAmount) * 100 : 0;

  return (
    <div data-testid="page-house-costs" className="p-2">
      <div className="flex flex-col md:flex-row">
        {renderSection(
          "🏠 House Payments",
          houseCosts,
          renderAddForm("house", newHouse, setNewHouse),
          "house",
        )}
        {renderSection(
          "🌱 Land Payments",
          landCosts,
          renderAddForm("land", newLand, setNewLand),
          "land",
        )}
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

      {toast && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded shadow"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
