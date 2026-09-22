import { PRIORITE_LABELS, STATUT_LABELS, formatDateTime } from "@/lib/rpi-helpers";
import type { Tables } from "@/integrations/supabase/types";
import { formatDecimal, formatDms, lienGoogleMaps, lienItineraire, positionDeReference } from "@/lib/geolocalisation";

type Demande = Tables<"demandes">;
type Historique = Tables<"historique">;

interface ExportParams {
  demande: Demande;
  infra: {
    code: string;
    nom: string;
    localisation: string | null;
    latitude?: number | null;
    longitude?: number | null;
  } | null;
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

  // Les polices standard de jsPDF ne contiennent pas l'espace fine insécable
  // que le format français place entre les milliers (1 875 000) : sans cette
  // substitution, le montant s'affiche lettre par lettre, séparé par des barres.
  const lisible = (t: string) => t.replace(/[\u202f\u00a0]/g, " ");

  const field = (label: string, value: string) => {
    doc.setFont("helvetica", "bold");
    doc.setTextColor(20);
    doc.setFontSize(10);
    doc.text(`${label} :`, marginX, y);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    const lines = doc.splitTextToSize(lisible(value || "—"), 210 - marginX * 2 - 42);
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

  // Emplacement exact : encadré avec coordonnées et liens Google Maps,
  // pour que le technicien retrouve le point même sur une fiche imprimée.
  const position = positionDeReference(demande, infra);
  if (position) {
    line(3);
    const hauteur = 30;
    doc.setDrawColor(31, 58, 95);
    doc.setFillColor(238, 243, 249);
    doc.roundedRect(marginX, y - 5, 210 - marginX * 2, hauteur, 2, 2, "FD");
    doc.setFont("helvetica", "bold");
    doc.setFontSize(10);
    doc.setTextColor(31, 58, 95);
    doc.text("Emplacement de l'intervention", marginX + 4, y + 1);
    doc.setFont("helvetica", "normal");
    doc.setTextColor(40);
    doc.setFontSize(9.5);
    doc.text(
      `GPS : ${formatDecimal(position.latitude, position.longitude)}   (${formatDms(position.latitude, position.longitude)})`,
      marginX + 4,
      y + 7
    );
    const origine =
      position.source === "demande"
        ? position.precision_m != null
          ? `Relevé sur place par le demandeur, précision d'environ ${Math.round(position.precision_m)} m`
          : "Position saisie avec la demande"
        : "Position de référence de l'infrastructure (demande non géolocalisée)";
    doc.setTextColor(100);
    doc.text(origine, marginX + 4, y + 12.5);
    doc.setTextColor(31, 58, 95);
    doc.textWithLink("Ouvrir dans Google Maps", marginX + 4, y + 19, {
      url: lienGoogleMaps(position.latitude, position.longitude),
    });
    doc.textWithLink("Itinéraire jusqu'au point", marginX + 60, y + 19, {
      url: lienItineraire(position.latitude, position.longitude),
    });
    doc.setFontSize(7.5);
    doc.setTextColor(120);
    doc.text(lienGoogleMaps(position.latitude, position.longitude), marginX + 4, y + 23.5);
    doc.setFontSize(10);
    y += hauteur - 2;
  }

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
