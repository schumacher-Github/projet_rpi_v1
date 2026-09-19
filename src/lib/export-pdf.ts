import { PRIORITE_LABELS, STATUT_LABELS, formatDateTime } from "@/lib/rpi-helpers";
import type { Tables } from "@/integrations/supabase/types";

type Demande = Tables<"demandes">;
type Historique = Tables<"historique">;

interface ExportParams {
  demande: Demande;
  infra: { code: string; nom: string; localisation: string | null } | null;
  demandeurNom: string;
  technicienNom: string | null;
  historique: Historique[];
}

/**
 * Génère et télécharge une fiche d'intervention PDF pour une demande
 * (besoin fonctionnel BF10 du mémoire — export des rapports en PDF).
 * Purement côté client (jsPDF) : aucun service backend requis.
 *
 * La bibliothèque est chargée à la demande plutôt qu'au chargement du
 * module : elle pèse plusieurs centaines de kilo-octets, inutiles tant
 * que l'agent ne demande pas d'export, et un problème sur celle-ci ne
 * peut plus empêcher l'affichage de la fiche d'intervention elle-même.
 */
export async function exportDemandePdf({
  demande,
  infra,
  demandeurNom,
  technicienNom,
  historique,
}: ExportParams) {
  const { jsPDF } = await import("jspdf");
  const doc = new jsPDF({ unit: "mm", format: "a4" });
  const marginX = 18;
  let y = 20;

  const line = (h = 7) => {
    y += h;
  };

  // En-tête
  doc.setFontSize(9);
  doc.setTextColor(120);
  doc.text("Régie du Patrimoine Immobilier — Port Autonome de Douala", marginX, y);
  doc.text(new Date().toLocaleDateString("fr-FR"), 210 - marginX, y, { align: "right" });
  line(8);
  doc.setDrawColor(200);
  doc.line(marginX, y, 210 - marginX, y);
  line(8);

  doc.setTextColor(20);
  doc.setFontSize(16);
  doc.setFont("helvetica", "bold");
  doc.text("Fiche d'intervention", marginX, y);
  line(6);
  doc.setFontSize(10);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(100);
  doc.text(demande.reference, marginX, y);
  line(10);

  const field = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    doc.setFontSize(10);
    doc.text(`${label} :`, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    const lines = doc.splitTextToSize(value || "—", 210 - marginX * 2 - 42);
    doc.text(lines, marginX + 44, y);
    line(Math.max(6, lines.length * 5));
  };

  field("Titre", demande.titre);
  field("Priorité", PRIORITE_LABELS[demande.priorite]);
  field("Statut", STATUT_LABELS[demande.statut]);
  field(
    "Infrastructure",
    infra ? `${infra.code} — ${infra.nom}${infra.localisation ? ` (${infra.localisation})` : ""}` : "Non précisée"
  );
  field("Demandeur", demandeurNom);
  field("Technicien affecté", technicienNom ?? "Non affecté");
  field("Créée le", formatDateTime(demande.created_at));
  if (demande.date_resolution) field("Résolue le", formatDateTime(demande.date_resolution));
  if (demande.cout_estime != null)
    field("Coût estimé", `${Number(demande.cout_estime).toLocaleString("fr-FR")} FCFA`);

  line(4);
  doc.setFont("helvetica", "bold");
  doc.text("Description", marginX, y);
  line(6);
  doc.setFont("helvetica", "normal");
  doc.setTextColor(40);
  const descLines = doc.splitTextToSize(demande.description, 210 - marginX * 2);
  doc.text(descLines, marginX, y);
  line(descLines.length * 5 + 4);

  if (demande.rapport_intervention) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    doc.text("Rapport d'intervention", marginX, y);
    line(6);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    const rapportLines = doc.splitTextToSize(demande.rapport_intervention, 210 - marginX * 2);
    doc.text(rapportLines, marginX, y);
    line(rapportLines.length * 5 + 4);
  }

  if (historique.length > 0) {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    doc.text("Historique", marginX, y);
    line(6);
    doc.setFontSize(9);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(60);
    historique
      .slice()
      .reverse()
      .forEach((h) => {
        if (y > 275) {
          doc.addPage();
          y = 20;
        }
        const entry = `${formatDateTime(h.created_at)} — ${h.action}`;
        const entryLines = doc.splitTextToSize(entry, 210 - marginX * 2);
        doc.text(entryLines, marginX, y);
        line(entryLines.length * 4.5 + 1.5);
      });
  }

  doc.save(`fiche-intervention-${demande.reference}.pdf`);
}
