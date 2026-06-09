import type { Database } from "@/integrations/supabase/types";

export type Priorite = Database["public"]["Enums"]["priorite_demande"];
export type Statut = Database["public"]["Enums"]["statut_demande"];
export type TypeInfra = Database["public"]["Enums"]["type_infrastructure"];

export const PRIORITE_LABELS: Record<Priorite, string> = {
  urgente: "Urgente",
  normale: "Normale",
  planifiee: "Planifiée",
};

export const STATUT_LABELS: Record<Statut, string> = {
  nouvelle: "Nouvelle",
  assignee: "Assignée",
  en_cours: "En cours",
  resolue: "Résolue",
  cloturee: "Clôturée",
  rejetee: "Rejetée",
};

export const TYPE_INFRA_LABELS: Record<TypeInfra, string> = {
  batiment: "Bâtiment",
  quai: "Quai",
  entrepot: "Entrepôt",
  reseau: "Réseau",
  equipement: "Équipement",
  autre: "Autre",
};

export const STATUTS: Statut[] = [
  "nouvelle",
  "assignee",
  "en_cours",
  "resolue",
  "cloturee",
  "rejetee",
];

export const PRIORITES: Priorite[] = ["urgente", "normale", "planifiee"];

export function prioriteBadgeClass(p: Priorite) {
  switch (p) {
    case "urgente":
      return "bg-destructive/10 text-destructive border border-destructive/30";
    case "normale":
      return "bg-info/10 text-info border border-info/30";
    case "planifiee":
      return "bg-muted text-muted-foreground border border-border";
  }
}

export function statutBadgeClass(s: Statut) {
  switch (s) {
    case "nouvelle":
      return "bg-info/10 text-info border border-info/30";
    case "assignee":
      return "bg-warning/15 text-warning-foreground border border-warning/40";
    case "en_cours":
      return "bg-gold/15 text-gold-foreground border border-gold/40";
    case "resolue":
      return "bg-success/15 text-success border border-success/40";
    case "cloturee":
      return "bg-muted text-muted-foreground border border-border";
    case "rejetee":
      return "bg-destructive/10 text-destructive border border-destructive/30";
  }
}

export function formatDate(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });
}

export function formatDateTime(iso: string | null | undefined) {
  if (!iso) return "—";
  return new Date(iso).toLocaleString("fr-FR", {
    day: "2-digit",
    month: "short",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  });
}
