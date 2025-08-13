import React, { useState } from "react";
import { useLocation, useNavigate } from "react-router-dom";

import api from "../api/axios";

export default function EditAccInfo() {
  const { state } = useLocation();
  const navigate = useNavigate();
  const [entries, setEntries] = useState(state?.entries || []);

  const handleChange = (index, field, value) => {
    const updated = [...entries];
    updated[index][field] = value;
    setEntries(updated);
  };

  const handleSave = async () => {
    try {
      await api.post("/acc_info/bulk", entries);
      navigate("/"); // Redirect back to main page
    } catch (error) {
      console.error("❌ Failed to save:", error);
    }
  };

  return (
    <div className="space-y-4 p-4">
      <h1 className="text-2xl font-bold">Edit Account Information</h1>

      {entries.map((entry, idx) => (
        <div key={idx} className="flex gap-2">
          {["person", "bank", "acc_number", "country", "value"].map((field) => (
            <input
              key={field}
              value={entry[field]}
              onChange={(e) => handleChange(idx, field, e.target.value)}
              placeholder={field}
              className="border p-1 rounded"
            />
          ))}
        </div>
      ))}

      <div className="space-x-2">
        <button
          onClick={handleSave}
          className="bg-green-500 text-white px-3 py-1 rounded"
        >
          Save
        </button>
        <button
          onClick={() => navigate("/")}
          className="bg-gray-500 text-white px-3 py-1 rounded"
        >
          Cancel
        </button>
      </div>
    </div>
  );
}
