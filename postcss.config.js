// postcss.config.js
// PostCSS config: tu sa registrujú pluginy ktoré prebehnú pred bundlovaním CSS.
module.exports = {
  plugins: {
    // pre Tailwind v3 používame tento zápis
    tailwindcss: {},
    autoprefixer: {}
  }
};
