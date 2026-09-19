// Routeur principal de l'Edge Runtime auto-hébergé.
//
// Le runtime démarre ce service unique ; pour chaque requête
// /functions/v1/<nom>, il lance la fonction correspondante du dossier
// supabase/functions/<nom> dans un worker isolé.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

serve(async (req: Request) => {
  const url = new URL(req.url);
  const nom = url.pathname.split("/").filter(Boolean)[0];

  if (!nom || !/^[a-z0-9-]+$/.test(nom)) {
    return new Response(JSON.stringify({ error: "fonction introuvable" }), {
      status: 404,
      headers: { "Content-Type": "application/json" },
    });
  }

  try {
    // @ts-ignore EdgeRuntime est fourni par l'environnement d'exécution
    const worker = await EdgeRuntime.userWorkers.create({
      servicePath: `/home/deno/functions/${nom}`,
      memoryLimitMb: 150,
      workerTimeoutMs: 60_000,
      noModuleCache: false,
      importMapPath: null,
      envVars: Object.entries(Deno.env.toObject()),
    });
    return await worker.fetch(req);
  } catch (e) {
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { "Content-Type": "application/json" },
    });
  }
});
