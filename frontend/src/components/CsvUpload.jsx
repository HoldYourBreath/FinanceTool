import React, { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import Papa from 'papaparse';
import api from '../api/axios';

export default function CsvUpload() {
  const [file, setFile] = useState(null);
  const navigate = useNavigate();

  const handleFileChange = (e) => {
    setFile(e.target.files[0]);
  };

  const handleUpload = () => {
    if (!file) return;

    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: async (result) => {
        try {
          const parsedData = result.data;

          // Check existing records to avoid duplicates
          const res = await api.get('/acc_info');
          const existing = res.data;

          const newEntries = parsedData.filter(entry => 
            !existing.some(e => 
              e.person === entry.person &&
              e.bank === entry.bank &&
              e.acc_number === entry.acc_number &&
              e.country === entry.country
            )
          );

          // Navigate to edit page with newEntries as state
          navigate('/edit-acc-info', { state: { entries: newEntries } });

        } catch (error) {
          console.error('❌ Error checking existing records:', error);
        }
      }
    });
  };

  return (
    <div className="space-y-2">
      <input type="file" accept=".csv" onChange={handleFileChange} />
      <button onClick={handleUpload} className="bg-blue-500 text-white px-3 py-1 rounded">
        Upload and Edit
      </button>
    </div>
  );
}
