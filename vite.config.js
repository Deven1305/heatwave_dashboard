import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// Vite builds and serves the website. The react() plugin is the only thing we need: it understands JSX and
// refreshes the page while you edit. (Port 5173 is Vite's default, so it isn't set here.)
export default defineConfig({
  plugins: [react()],
});
