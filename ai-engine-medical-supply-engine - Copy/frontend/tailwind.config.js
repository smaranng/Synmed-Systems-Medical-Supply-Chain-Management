/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      colors: {
        brand: {
          ink: '#0f172a',
          mist: '#d8f2ee',
          teal: '#0f766e',
          cyan: '#155e75',
          sand: '#f4e7cf',
          coral: '#f97316'
        }
      },
      boxShadow: {
        panel: '0 24px 60px rgba(15, 23, 42, 0.18)'
      }
    }
  },
  plugins: []
};
