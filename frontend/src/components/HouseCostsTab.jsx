// src/components/HouseCostsTab.jsx
import { useEffect, useMemo, useState } from "react";
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
  const [loading, setLoading] = useState(false);
  const [toast, setToast] = useState("");

  const flash = (msg) => {
    setToast(msg);
    setTimeout(() => setToast(""), 2200);
  };

  const formatSEK = (amount) =>
    Number.isFinite(Number(amount))
      ? new Intl.NumberFormat("sv-SE", {
          style: "currency",
          currency: "SEK",
          maximumFractionDigits: 0,
        }).format(Number(amount))
      : "";

  const parseAmount = (v) => {
    const s =
      typeof v === "string" ? v.replace(/\s/g, "").replace(",", ".") : v;
    const n = parseFloat(s);
    return Number.isFinite(n) ? n : NaN;
  };

  // ✅ Plain fetch function (does NOT return cleanup)
  const fetchData = async () => {
    setLoading(true);
    try {
      const [h, l] = await Promise.all([
        api.get("/house_costs"),
        api.get("/land_costs"),
      ]);
      setHouseCosts(Array.isArray(h.data) ? h.data : []);
      setLandCosts(Array.isArray(l.data) ? l.data : []);
    } catch (e) {
      console.error("Failed to fetch costs", e);
      flash("❌ Failed to fetch costs");
    } finally {
      setLoading(false);
    }
  };

  // ✅ Effect owns the cleanup (ignore state updates after unmount)
  useEffect(() => {
    let cancelled = false;

    (async () => {
      setLoading(true);
      try {
        const [h, l] = await Promise.all([
          api.get("/house_costs"),
          api.get("/land_costs"),
        ]);
        if (!cancelled) {
          setHouseCosts(Array.isArray(h.data) ? h.data : []);
          setLandCosts(Array.isArray(l.data) ? l.data : []);
        }
      } catch (e) {
        console.error("Failed to fetch costs", e);
        if (!cancelled) flash("❌ Failed to fetch costs");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();

    return () => {
      cancelled = true; // don’t abort the requests in StrictMode; just ignore results
    };
  }, []);

  const handleAdd = async (kind) => {
    const isHouse = kind === "house";
    const src = isHouse ? newHouse : newLand;

    const amt = parseAmount(src.amount);
    if (!src.name.trim() || !Number.isFinite(amt) || amt <= 0) {
      flash("❌ Please enter a name and a positive amount.");
      return;
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
      const { data } = await api.post(`/${kind}_costs`, payload, {
        headers: { "Content-Type": "application/json" },
      });
      const realId = data?.id ?? tempId;
      const swap = (xs) => [
        { id: realId, ...payload },
        ...xs.filter((x) => x.id !== tempId),
      ];
      if (isHouse) {
        setHouseCosts(swap);
        setNewHouse({ name: "", amount: "", status: "todo" });
      } else {
        setLandCosts(swap);
        setNewLand({ name: "", amount: "", status: "todo" });
      }
      flash("✅ Added");
    } catch (e) {
      console.error(`Failed to add ${kind} cost`, e);
      if (isHouse) setHouseCosts((xs) => xs.filter((x) => x.id !== tempId));
      else setLandCosts((xs) => xs.filter((x) => x.id !== tempId));
      flash(`❌ Failed to add ${isHouse ? "house" : "land"} cost`);
    }
  };

  const handleDelete = async (kind, id) => {
    const isHouse = kind === "house";
    const prevH = houseCosts;
    const prevL = landCosts;

    if (isHouse) setHouseCosts((xs) => xs.filter((x) => x.id !== id));
    else setLandCosts((xs) => xs.filter((x) => x.id !== id));

    try {
      await api.delete(`/${kind}_costs/${id}`);
      flash("🗑️ Deleted");
    } catch (e) {
      console.error(`Failed to delete ${kind} cost`, e);
      setHouseCosts(prevH);
      setLandCosts(prevL);
      flash("❌ Delete failed");
    }
  };

  const totals = useMemo(() => {
    const all = [...houseCosts, ...landCosts];
    const totalAmount = all.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const doneAmount = all
      .filter((i) => i.status === "done")
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const pct = totalAmount > 0 ? (doneAmount / totalAmount) * 100 : 0;
    return {
      totalItems: all.length,
      completedItems: all.filter((i) => i.status === "done").length,
      totalAmount,
      doneAmount,
      pct,
    };
  }, [houseCosts, landCosts]);

  const inputCls =
    "rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 text-sm shadow-inner focus:outline-none focus:ring-2 focus:ring-emerald-400";
  const selectCls =
    "rounded-lg border border-emerald-200 bg-white/70 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-400";
  const addBtnCls =
    "rounded-lg bg-emerald-600 text-white px-3 py-2 text-sm shadow hover:bg-emerald-700 focus:outline-none focus:ring-2 focus:ring-emerald-400";
  const cardHouse =
    "rounded-2xl bg-emerald-50/70 ring-1 ring-emerald-200 p-4 shadow-sm backdrop-blur-sm";
  const cardLand =
    "rounded-2xl bg-sky-50/70 ring-1 ring-sky-200 p-4 shadow-sm backdrop-blur-sm";

  const AddForm = ({ kind, state, setState }) => (
    <div className="mt-4" data-testid={`form-add-${kind}`}>
      <h3 className="font-semibold mb-2 text-slate-700">
        ➕ Add {kind === "house" ? "House" : "Land"} Payment
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
        <button
          onClick={() => handleAdd(kind)}
          className={addBtnCls}
          disabled={loading}
        >
          Add
        </button>
      </div>
    </div>
  );

  const Section = ({ title, rows, kind }) => {
    const total = rows.reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const done = rows
      .filter((i) => i.status === "done")
      .reduce((s, i) => s + (Number(i.amount) || 0), 0);
    const todo = total - done;
    const cardCls = kind === "house" ? cardHouse : cardLand;

    return (
      <section className="w-full md:w-1/2 p-2" data-testid={`section-${kind}`}>
        <div className={cardCls}>
          <div className="flex items-center justify-between mb-2">
            <h2 className="text-lg font-bold text-slate-800">{title}</h2>
            <button
              type="button"
              onClick={fetchData}
              className="text-xs rounded bg-white/70 ring-1 ring-emerald-300 px-2 py-1 hover:bg-white"
              disabled={loading}
            >
              {loading ? "Loading…" : "Refresh"}
            </button>
          </div>

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
                {rows.map((item) => (
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
                              handleDelete(kind, item.id);
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
                {rows.length === 0 && (
                  <tr>
                    <td className="px-3 py-4 text-gray-500 italic" colSpan={3}>
                      No items.
                    </td>
                  </tr>
                )}
              </tbody>
              {rows.length > 0 && (
                <tfoot>
                  <tr className="bg-gray-50">
                    <td className="px-3 py-2 text-right font-medium">Total</td>
                    <td className="px-3 py-2 text-right font-semibold">
                      {formatSEK(total)}
                    </td>
                    <td className="px-3 py-2"></td>
                  </tr>
                </tfoot>
              )}
            </table>
          </div>

          <div className="mt-3 text-sm">
            <div>
              <strong>Total:</strong> {formatSEK(total)}
            </div>
            <div className="text-emerald-700">✅ Done: {formatSEK(done)}</div>
            <div className="text-slate-600">⏳ Todo: {formatSEK(todo)}</div>
          </div>

          {kind === "house" ? (
            <AddForm kind="house" state={newHouse} setState={setNewHouse} />
          ) : (
            <AddForm kind="land" state={newLand} setState={setNewLand} />
          )}
        </div>
      </section>
    );
  };

  return (
    <div data-testid="page-house-costs" className="p-2">
      <div className="flex flex-col md:flex-row">
        <Section title="🏠 House Payments" rows={houseCosts} kind="house" />
        <Section title="🌱 Land Payments" rows={landCosts} kind="land" />
      </div>

      <section
        className="mt-4 rounded-2xl bg-white/70 ring-1 ring-emerald-200 p-4 shadow-sm backdrop-blur-sm text-sm"
        data-testid="summary-progress"
      >
        <strong>House Build Progress:</strong>
        <br />
        Items Completed: {totals.completedItems} / {totals.totalItems}
        <br />
        Cost Completed: {formatSEK(totals.doneAmount)} /{" "}
        {formatSEK(totals.totalAmount)}
        <br />
        <span className="text-emerald-700 font-semibold">
          {totals.pct.toFixed(1)}% of total build and land cost is DONE!
        </span>
      </section>

      {toast && (
        <div
          role="status"
          aria-live="polite"
          data-testid="toast"
          className="fixed bottom-4 right-4 bg-black/80 text-white px-4 py-2 rounded shadow"
        >
          {toast}
        </div>
      )}
    </div>
  );
}
