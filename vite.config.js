import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// base "./" so the build works at any path, including GitHub Pages under /cs218-noisy-neighbour/.
export default defineConfig({ plugins: [react()], base: "./" });
