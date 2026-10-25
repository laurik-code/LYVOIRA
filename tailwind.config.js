// tailwind.config.js
// Tu sa nastaví, kde Tailwind hľadá triedy (very important).
module.exports = {
  content: [
    "./app/**/*.{js,jsx,ts,tsx}",   // všetky súbory v app/ (App Router)
    "./pages/**/*.{js,jsx,ts,tsx}",
    "./components/**/*.{js,jsx,ts,tsx}"
  ],
  theme: {
    extend: {
      // sem môžeš pridávať vlastné farby, fonty atď.
      colors: {
        // príklad custom farby (voliteľné)
        lyvoiraPurple: "#7C3AED"
      }
    }
  },
  plugins: []
};
