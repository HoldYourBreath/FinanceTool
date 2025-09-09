// src/components/EditAccInfo.jsx
import { useEffect, useState } from "react";
import api from "../api/axios";

export default function EditAccInfo() {
  const [rows, setRows] = useState([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const r = await api.get("/acc_info");
        setRows(r.data || []);
      } catch (e) {
        console.error("Failed to load acc_info:", e);
      }
    })();
  }, []);

  const onChange = (i, k, v) =>
    setRows((prev) =>
      prev.map((row, idx) => (idx === i ? { ...row, [k]: v } : row)),
    );

  const save = async () => {
    setSaving(true);
    try {
      await api.post("/settings/accounts", rows);
    } catch (e) {
      console.error("Failed to save accounts:", e);
    } finally {
      setSaving(false);
    }
  };

  return (
    <div className="p-4 space-y-3">
      <h1 className="text-2xl font-bold">Edit Account Info</h1>
      {rows.map((row, i) => (
        <div key={row.id ?? i} className="flex flex-wrap gap-2">
          <input
            className="border p-1"
            value={row.person || ""}
            onChange={(e) => onChange(i, "person", e.target.value)}
          />
          <input
            className="border p-1"
            value={row.bank || ""}
            onChange={(e) => onChange(i, "bank", e.target.value)}
          />
          <input
            className="border p-1"
            value={row.acc_number || ""}
            onChange={(e) => onChange(i, "acc_number", e.target.value)}
          />
          <input
            className="border p-1"
            value={row.country || ""}
            onChange={(e) => onChange(i, "country", e.target.value)}
          />
        </div>
      ))}
      <button
        onClick={save}
        disabled={saving}
        className="bg-blue-600 text-white px-3 py-1 rounded"
      >
        {saving ? "Saving…" : "Save"}
      </button>
    </div>
  );
}
