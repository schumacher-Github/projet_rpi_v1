import { supabase } from "@/integrations/supabase/client";

export type NotificationType = "nouvelle_demande" | "affectation" | "statut" | "info";

/**
 * Crée une notification en base pour un destinataire donné. Utilisée par
 * les mutations de demandes.nouvelle / demandes.$id pour prévenir les
 * bonnes personnes (chef de service, technicien affecté, demandeur) à
 * chaque étape du cycle de vie d'une demande (besoin BF09 du mémoire).
 */
export async function notifyUser(params: {
  userId: string;
  message: string;
  demandeId?: string;
  type?: NotificationType;
}) {
  const { error } = await supabase.from("notifications").insert({
    user_id: params.userId,
    message: params.message,
    demande_id: params.demandeId ?? null,
    type: params.type ?? "info",
  });
  if (error) {
    // Une notification manquée ne doit jamais faire échouer l'action
    // métier principale (création de demande, affectation…) : on se
    // contente de logger l'erreur.
    console.error("notifyUser failed:", error.message);
  }
}

/**
 * Notifie tous les utilisateurs disposant d'un rôle de supervision
 * (chef de service, administrateur) — par exemple à la création d'une
 * nouvelle demande.
 */
export async function notifySupervisors(message: string, demandeId?: string) {
  // La liste des superviseurs est établie côté base de données : un
  // demandeur n'a pas le droit de lire la table des rôles, de sorte
  // qu'un calcul côté client ne renvoyait aucun destinataire et que la
  // notification se perdait silencieusement. La fonction SQL
  // notifier_superviseurs s'exécute avec les droits de son propriétaire
  // et insère une notification pour chaque chef de service et
  // administrateur, sans exposer la composition des rôles.
  const { error } = await supabase.rpc("notifier_superviseurs", {
    _message: message,
    _demande_id: demandeId ?? null,
    _type: "nouvelle_demande",
  });

  if (error) {
    console.error("notifySupervisors failed:", error.message);
  }
}

/**
 * Appelle la fonction Edge Supabase chargée d'envoyer un email (via
 * Resend) au technicien nouvellement affecté à une demande. L'appel est
 * best-effort : une erreur d'envoi d'email ne bloque jamais l'affectation
 * elle-même.
 */
export async function sendAssignmentEmail(params: {
  technicienEmail: string;
  technicienNom: string;
  demandeReference: string;
  demandeTitre: string;
  demandeId: string;
}) {
  try {
    const { error } = await supabase.functions.invoke("notify-technicien", {
      body: params,
    });
    if (error) console.error("sendAssignmentEmail failed:", error.message);
  } catch (e) {
    console.error("sendAssignmentEmail failed:", e);
  }
}
