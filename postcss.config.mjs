// Tailwind v4 through PostCSS: works with both Turbopack and webpack builds,
// unlike the turbopack-only loader the scaffold ships with.
const config = {
  plugins: ["@tailwindcss/postcss"],
};

export default config;
