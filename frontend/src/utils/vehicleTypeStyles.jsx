// utils/vehicleTypeStyles.js
export const TYPE_ROW_BG = {
  EV:     'bg-green-100 hover:bg-green-200',   // darker green
  PHEV:   'bg-violet-200 hover:bg-violet-300', // clearly different from green/blue
  Diesel: 'bg-amber-100 hover:bg-amber-200',   // a bit darker
  Bensin: 'bg-blue-200 hover:bg-blue-300',     // darker blue
  HEV:    'bg-lime-50 hover:bg-lime-100',
  ICE:    'bg-slate-50 hover:bg-slate-100',
};

export function rowBgFor(typeRaw) {
  const t = (typeRaw || '').toString().trim().toLowerCase();
  if (['ev', 'bev', 'electric', 'elbil'].includes(t)) return TYPE_ROW_BG.EV;
  if (['phev', 'plug-in hybrid', 'plugin hybrid', 'plug in hybrid'].includes(t)) return TYPE_ROW_BG.PHEV;
  if (['diesel'].includes(t)) return TYPE_ROW_BG.Diesel;
  if (['bensin', 'petrol', 'gasoline', 'gas'].includes(t)) return TYPE_ROW_BG.Bensin;
  if (['hev', 'hybrid'].includes(t)) return TYPE_ROW_BG.HEV;
  if (['ice', 'icev'].includes(t)) return TYPE_ROW_BG.ICE;
  return 'bg-white';
}

