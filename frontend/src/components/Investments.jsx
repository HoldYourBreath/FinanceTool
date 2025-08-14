import { useEffect, useState } from "react";

import api from "../api/axios";
import { fetchaccinfo } from "../api/acc_info";

import CsvUpload from "./CsvUpload";

export default function Investments() {
  const [investments, setInvestments] = useState([]);
  const [acc_infoData, setacc_infoData] = useState([]);

  useEffect(() => {
    async function fetchInvestments() {
      try {
        const res = await api.get("/investments");
        const data = res.data;
        if (Array.isArray(data)) {
          setInvestments(data);
        } else {
          console.error("❌ Expected array from /investments, got:", data);
          setInvestments([]);
        }
      } catch (err) {
        console.error("❌ Failed to fetch investments:", err);
      }
    }

    async function loadacc_info() {
      try {
        const data = await fetchaccinfo();
        setacc_infoData(data);
      } catch (err) {
        console.error("❌ Failed to fetch acc_info:", err);
      }
    }

    fetchInvestments();
    loadacc_info();
  }, []);

  return (
    <div className="p-6 bg-white rounded-lg shadow space-y-8">
      {/* acc_info Financial Data Section */}
      <section>
        <h1 className="text-3xl font-bold mb-4 text-blue-600">
          📄 acc_info Financial Data
        </h1>
        <CsvUpload onUpdateacc_info={setacc_infoData} />
        {acc_infoData.length === 0 ? (
          <div className="text-center text-red-600 mt-4">
            No acc_info data available.
          </div>
        ) : (
          <div className="space-y-2">
            {acc_infoData.map((acc_infoItem, index) => (
              <div
                key={`${acc_infoItem.person || "acc_info"}-${index}`}
                className="flex justify-between border-b pb-2"
              >
                <span className="capitalize">
                  {`${acc_infoItem.person} ${acc_infoItem.bank ?? ""} (${acc_infoItem.country ?? ""})`}
                </span>
                <span className="font-bold">
                  {Number(acc_infoItem.value).toLocaleString()} SEK
                </span>
              </div>
            ))}
          </div>
        )}
      </section>

      {/* Investments Section */}
      <section>
        <h1 className="text-3xl font-bold mb-6 text-blue-700">
          💼 Investments
        </h1>
        {investments.length === 0 ? (
          <div className="text-center text-red-600">
            No investments available.
          </div>
        ) : (
          <div className="space-y-4">
            {investments.map((inv, index) => (
              <div
                key={inv.id || `investment-${index}`}
                className="p-4 bg-gray-100 rounded-xl border border-gray-300 hover:shadow-md transition-transform hover:scale-[1.02] space-y-4"
              >
                <h2 className="text-xl font-semibold">{inv.name}</h2>

                <div className="flex justify-between">
                  <span>Value:</span>
                  <span className="font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
                    {Number(inv.value).toLocaleString()} SEK
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Paid:</span>
                  <span className="font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
                    {Number(inv.paid).toLocaleString()} SEK
                  </span>
                </div>

                <div className="flex justify-between">
                  <span>Rent:</span>
                  <span className="font-bold text-green-700 bg-green-100 px-2 py-1 rounded">
                    {Number(inv.rent).toLocaleString()} SEK
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
