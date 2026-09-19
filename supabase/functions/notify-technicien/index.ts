// Fonction Edge Supabase — envoi d'un email de notification au technicien
// affecté à une nouvelle demande d'intervention (besoin fonctionnel BF09
// du mémoire : « Notification par email à chaque changement »).
//
// Appelée depuis le client via supabase.functions.invoke("notify-technicien", ...)
// au moment de l'affectation (voir src/lib/notifications.ts).
//
// Nécessite la variable d'environnement RESEND_API_KEY, à configurer avec :
//   npx supabase secrets set RESEND_API_KEY=your_resend_api_key
// (créer une clé sur https://resend.com après avoir vérifié un domaine
// d'envoi, ou utiliser le domaine de test onboarding@resend.dev en
// développement).

import { serve } from "https://deno.land/std@0.224.0/http/server.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

interface Payload {
  technicienEmail: string;
  technicienNom: string;
  demandeReference: string;
  demandeTitre: string;
  demandeId: string;
}

serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { headers: corsHeaders });
  }

  try {
    const payload = (await req.json()) as Payload;
    const { technicienEmail, technicienNom, demandeReference, demandeTitre } = payload;

    if (!technicienEmail) {
      return new Response(JSON.stringify({ error: "technicienEmail manquant" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const resendApiKey = Deno.env.get("RESEND_API_KEY");
    if (!resendApiKey) {
      console.error("RESEND_API_KEY n'est pas configurée — email non envoyé.");
      // On répond 200 quand même : l'absence d'email ne doit jamais faire
      // échouer l'affectation côté application (voir sendAssignmentEmail,
      // qui est appelé en best-effort).
      return new Response(JSON.stringify({ skipped: true }), {
        status: 200,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const appUrl = Deno.env.get("APP_URL") ?? "";
    const lienDemande = appUrl ? `${appUrl}/demandes/${payload.demandeId}` : "";

    const res = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: "RPI-PAD <onboarding@resend.dev>",
        to: [technicienEmail],
        subject: `Nouvelle affectation — ${demandeReference}`,
        html: `
          <div style="font-family: sans-serif; max-width: 480px;">
            <h2 style="color:#0f172a;">Nouvelle intervention à traiter</h2>
            <p>Bonjour ${technicienNom},</p>
            <p>Vous avez été affecté(e) à la demande d'intervention suivante :</p>
            <p style="background:#f1f5f9;border-radius:6px;padding:12px;">
              <strong>${demandeReference}</strong><br/>
              ${demandeTitre}
            </p>
            ${lienDemande ? `<p><a href="${lienDemande}">Consulter la demande</a></p>` : ""}
            <p style="color:#64748b;font-size:12px;margin-top:24px;">
              Régie du Patrimoine Immobilier — Port Autonome de Douala
            </p>
          </div>
        `,
      }),
    });

    if (!res.ok) {
      const text = await res.text();
      console.error("Resend error:", text);
      return new Response(JSON.stringify({ error: text }), {
        status: 502,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    return new Response(JSON.stringify({ sent: true }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    console.error("notify-technicien error:", e);
    return new Response(JSON.stringify({ error: String(e) }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
