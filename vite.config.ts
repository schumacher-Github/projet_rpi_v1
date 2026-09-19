import { defineConfig, loadEnv } from "vite";
import { tanstackStart } from "@tanstack/react-start/plugin/vite";
import viteReact from "@vitejs/plugin-react";
import tailwindcss from "@tailwindcss/vite";
import tsConfigPaths from "vite-tsconfig-paths";
import { nitro } from "nitro/vite";

export default defineConfig(({ mode }) => {
  const env = loadEnv(mode, process.cwd(), "VITE_");
  const envDefine = Object.fromEntries(
    Object.entries(env).map(([key, value]) => [`import.meta.env.${key}`, JSON.stringify(value)]),
  );

  return {
    define: envDefine,
    css: { transformer: "lightningcss" },
    resolve: {
      alias: { "@": `${process.cwd()}/src` },
      dedupe: [
        "react",
        "react-dom",
        "react/jsx-runtime",
        "react/jsx-dev-runtime",
        "@tanstack/react-query",
        "@tanstack/query-core",
      ],
    },
    server: { host: "::", port: 8080 },
    // « npm run preview » sert à contrôler une compilation en local. Sans
    // cette autorisation, Vite répond « 403 Blocked request » dès que la
    // requête porte un autre nom d'hôte que localhost. En production, c'est
    // docker/serveur.mjs qui sert l'application, pas Vite.
    preview: { host: true, allowedHosts: true },
    plugins: [
      tailwindcss(),
      tsConfigPaths({ projects: ["./tsconfig.json"] }),
      tanstackStart({
        server: { entry: "server" },
        importProtection: {
          behavior: "error",
          client: {
            files: ["**/server/**"],
            specifiers: ["server-only"],
          },
        },
      }),
      // Vercel compile l'application au moyen de Nitro, qui produit
      // .vercel/output. Le greffon n'est activé que lorsque la variable
      // VERCEL est présente, c'est-à-dire pendant une construction sur
      // Vercel : en local et dans l'image Docker, la compilation reste
      // celle qui produit dist/, servie par docker/serveur.mjs.
      ...(process.env.VERCEL ? [nitro()] : []),
      viteReact(),
    ],
  };
});
