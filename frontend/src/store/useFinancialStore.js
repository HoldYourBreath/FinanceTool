// src/store/useFinancialStore.js
import { create } from "zustand";

export const useFinancialStore = create((set) => ({
  monthsData: [],
  acc_infoData: [],
  setMonthsData: (data) => set({ monthsData: data }),
  setacc_infoData: (data) => set({ acc_infoData: data }),
}));
