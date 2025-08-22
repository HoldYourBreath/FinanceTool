// utils/priceStyles.js
export function priceBg(price) {
  const p = Number(price);
  if (!isFinite(p)) return '';

  if (p < 200000)      return 'bg-green-600 text-white'; // dark green
  if (p <= 250000)     return 'bg-green-200';            // lighter green
  if (p <= 300000)     return 'bg-yellow-200';           // yellow
  if (p <= 350000)     return 'bg-red-200';              // light red
  return 'bg-red-600 text-white';                        // dark red
}
