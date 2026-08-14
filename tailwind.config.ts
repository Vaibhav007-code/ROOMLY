import type { Config } from 'tailwindcss';

const config: Config = {
  darkMode: 'class',
  content: [
    './app/**/*.{js,ts,jsx,tsx,mdx}',
    './pages/**/*.{js,ts,jsx,tsx,mdx}',
    './components/**/*.{js,ts,jsx,tsx,mdx}',
  ],
  theme: {
    extend: {
      colors: {
        navy: {
          950: '#070C16',
          900: '#0B1220',
          850: '#0F1A2E',
          800: '#141F35',
          750: '#1B2740',
          700: '#233252',
          600: '#2E4168',
        },
        brand: {
          500: '#6366F1',
          600: '#4F46E5',
          700: '#4338CA',
        },
      },
    },
  },
  plugins: [],
};

export default config;
