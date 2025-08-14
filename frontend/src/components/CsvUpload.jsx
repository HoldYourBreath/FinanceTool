import { useState } from "react";
import api from "../api/axios";

export default function CsvUpload({ onUpdateacc_info }) {
  const [file, setFile] = useState(null);
  const [busy, setBusy] = useState(false);
  const [msg, setMsg] = useState("");

  const onSubmit = async (e) => {
    e.preventDefault(); // ✅ stay on the same page
    if (!file) return setMsg("Pick a CSV first");

    setBusy(true);
    setMsg("");
    try {
      const form = new FormData();
      form.append("file", file);
      await api.post("/upload/csv", form, {
        headers: { "Content-Type": "multipart/form-data" },
      });

      setMsg("✅ Uploaded and updated balance.");
      // ✅ tell parent to re-fetch acc_info from the server
      if (typeof onUpdateacc_info === "function") {
        await onUpdateacc_info();
      }
    } catch (err) {
      const errMsg = err?.response?.data?.error || "Upload failed";
      setMsg("❌ " + errMsg);
    } finally {
      setBusy(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className="flex items-center gap-2">
      <input
        type="file"
        accept=".csv"
        onChange={(e) => setFile(e.target.files?.[0] || null)}
      />
      <button
        type="submit"
        disabled={busy}
        className="bg-blue-600 text-white px-3 py-1 rounded"
      >
        {busy ? "Uploading…" : "Upload"}
      </button>
      {msg && <span className="text-sm">{msg}</span>}
    </form>
  );
}
