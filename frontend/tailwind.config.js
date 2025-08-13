// tailwind.config.js
/** @type {import('tailwindcss').Config} */
module.exports = {
  content: ['./index.html', './src/**/*.{js,jsx,ts,tsx}'],
  theme: {
    extend: {},
  },
  safelist: [
    'text-green-700',
    'text-blue-700',
    'text-orange-600',
    'text-red-700',
    'text-orange-500',
    'text-purple-700',
    'text-pink-700',
    'text-gray-700',
    'bg-green-500',
    'bg-red-500',
  ],
  plugins: [],
}
