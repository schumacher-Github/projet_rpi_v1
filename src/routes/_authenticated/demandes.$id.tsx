import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import {
  ArrowLeft,
  Download,
  Loader2,
  History,
  MapPin,
  User as UserIcon,
  Wrench,
} from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import type { TablesUpdate } from "@/integrations/supabase/types";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDateTime,
  prioriteBadgeClass,
  PRIORITE_LABELS,
  PRIORITES,
  STATUT_LABELS,
  STATUTS,
  statutBadgeClass,
  type Priorite,
  type Statut,
} from "@/lib/rpi-helpers";
import { notifyUser, sendAssignmentEmail } from "@/lib/notifications";
import { exportDemandePdf } from "@/lib/export-pdf";
import { formatDecimal, lienGoogleMaps, lienItineraire, positionDeReference } from "@/lib/geolocalisation";

export const Route = createFileRoute("/_authenticated/demandes/$id")({
  head: () => ({ meta: [{ title: "Demande — RPI-PAD" }] }),
  component: DemandeDetail,
});

// ✅ Statuts pour lesquels on interdit toute (ré)affectation de technicien
const STATUTS_VERROUILLES: Statut[] = ["resolue", "cloturee"];

function DemandeDetail() {
  const { id } = useParams({ from: "/_authenticated/demandes/$id" });
  const { user, hasAnyRole } = useAuth();
  const qc = useQueryClient();

  const canManage = hasAnyRole(["admin", "chef_service"]);
  const isTechnicien = hasAnyRole(["technicien", "admin", "chef_service"]);

  const [updating, setUpdating] = useState(false);
  const [newStatut, setNewStatut] = useState<Statut | "">("");
  const [commentaire, setCommentaire] = useState("");
  const [rapportIntervention, setRapportIntervention] = useState("");
  const [coutEstime, setCoutEstime] = useState("");
  const [changingPriorite, setChangingPriorite] = useState(false);

  const invalidateAll = () => {
    qc.invalidateQueries({ queryKey: ["demande", id] });
    qc.invalidateQueries({ queryKey: ["historique", id] });
    qc.invalidateQueries({ queryKey: ["demandes-list"] });
    qc.invalidateQueries({ queryKey: ["dashboard-demandes"] });
  };

  const { data: demande, isLoading } = useQuery({
    queryKey: ["demande", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*, infrastructures(*)")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: historique = [] } = useQuery({
    queryKey: ["historique", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("historique")
        .select("*")
        .eq("demande_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const { data: demandeurProfile } = useQuery({
    queryKey: ["profile", demande?.demandeur_id],
    enabled: !!demande?.demandeur_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nom, prenom, email, service")
        .eq("id", demande!.demandeur_id)
        .maybeSingle();
      return data;
    },
  });

  const { data: technicienProfile } = useQuery({
    queryKey: ["profile", demande?.technicien_id],
    enabled: !!demande?.technicien_id,
    queryFn: async () => {
      const { data } = await supabase
        .from("profiles")
        .select("nom, prenom, service")
        .eq("id", demande!.technicien_id!)
        .maybeSingle();
      return data;
    },
  });

  const handleUpdate = async () => {
    if (!demande || !user || !newStatut) return;
    setUpdating(true);
    const ancien = demande.statut;
    const estCloture = newStatut === "resolue" || newStatut === "cloturee";

    const updates: TablesUpdate<"demandes"> = { statut: newStatut };

    if (estCloture) {
      updates.date_resolution = new Date().toISOString();
      if (commentaire) updates.commentaire_resolution = commentaire;
      if (rapportIntervention) updates.rapport_intervention = rapportIntervention;
      if (coutEstime) updates.cout_estime = Number(coutEstime);
    }

    const { error } = await supabase
      .from("demandes")
      .update(updates)
      .eq("id", demande.id);

    if (!error) {
      await supabase.from("historique").insert({
        demande_id: demande.id,
        user_id: user.id,
        action: `Statut changé : ${STATUT_LABELS[ancien]} → ${STATUT_LABELS[newStatut]}`,
        ancien_statut: ancien,
        nouveau_statut: newStatut,
        commentaire: commentaire || null,
      });

      // BF09 — le demandeur est notifié à chaque changement de statut de
      // sa propre demande.
      if (demande.demandeur_id !== user.id) {
        void notifyUser({
          userId: demande.demandeur_id,
          demandeId: demande.id,
          type: "statut",
          message: `Votre demande "${demande.titre}" est maintenant ${STATUT_LABELS[newStatut].toLowerCase()}.`,
        });
      }
    }

    setUpdating(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Demande mise à jour");
    setCommentaire("");
    setRapportIntervention("");
    setCoutEstime("");
    setNewStatut("");
    invalidateAll();
  };

  const handlePrioriteChange = async (priorite: Priorite) => {
    if (!demande || !user || priorite === demande.priorite) return;
    setChangingPriorite(true);
    const ancienne = demande.priorite;
    const { error } = await supabase
      .from("demandes")
      .update({ priorite })
      .eq("id", demande.id);

    if (!error) {
      await supabase.from("historique").insert({
        demande_id: demande.id,
        user_id: user.id,
        action: `Priorité changée : ${PRIORITE_LABELS[ancienne]} → ${PRIORITE_LABELS[priorite]}`,
      });
    }

    setChangingPriorite(false);
    if (error) { toast.error(error.message); return; }
    toast.success("Priorité mise à jour");
    invalidateAll();
  };

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!demande) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-muted-foreground">Demande introuvable.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/demandes">Retour aux demandes</Link>
        </Button>
      </div>
    );
  }

  const infra = (demande as {
    infrastructures?: {
      code: string;
      nom: string;
      localisation: string | null;
      latitude?: number | null;
      longitude?: number | null;
    };
  }).infrastructures;
  const position = positionDeReference(demande, infra);

  // ✅ Demande verrouillée = plus d'affectation possible
  const isVerrouillee = STATUTS_VERROUILLES.includes(demande.statut as Statut);

  return (
    <div className="max-w-5xl space-y-6">
      {/* En-tête */}
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/demandes">
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-muted-foreground">
                {demande.reference}
              </span>
              <Badge
                className={prioriteBadgeClass(demande.priorite)}
                variant="outline"
              >
                {PRIORITE_LABELS[demande.priorite]}
              </Badge>
              <Badge
                className={statutBadgeClass(demande.statut)}
                variant="outline"
              >
                {STATUT_LABELS[demande.statut]}
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">
              {demande.titre}
            </h1>
          </div>
          <Button
            variant="outline"
            size="sm"
            onClick={async () => {
              try {
                await exportDemandePdf({
                  demande,
                  infra: infra ?? null,
                  demandeurNom: demandeurProfile
                    ? `${demandeurProfile.prenom} ${demandeurProfile.nom}`
                    : "—",
                  technicienNom: technicienProfile
                    ? `${technicienProfile.prenom} ${technicienProfile.nom}`
                    : null,
                  historique,
                });
              } catch (e) {
                console.error("export PDF:", e);
                toast.error("La fiche PDF n'a pas pu être générée.");
              }
            }}
          >
            <Download className="h-4 w-4 mr-1" /> Exporter en PDF
          </Button>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        {/* Colonne principale */}
        <div className="lg:col-span-2 space-y-6">

          {/* Description */}
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed">
                {demande.description}
              </p>
            </CardContent>
          </Card>

          {/* ── BLOC AFFECTATION TECHNICIEN ── */}
          {canManage && (
            <Card className="border-primary/30">
              <CardHeader>
                <CardTitle className="flex items-center gap-2 text-base">
                  <Wrench className="h-4 w-4 text-primary" />
                  Affecter un technicien
                </CardTitle>
              </CardHeader>
              <CardContent>
                {/* ✅ Blocage si demande résolue/clôturée */}
                {isVerrouillee ? (
                  <p className="text-xs text-muted-foreground bg-muted px-3 py-2 rounded-md border">
                    Cette demande est {STATUT_LABELS[demande.statut as Statut].toLowerCase()}.
                    Aucune réaffectation n'est possible.
                  </p>
                ) : (
                  <TechnicienSelect
                    demandeId={demande.id}
                    demandeReference={demande.reference}
                    demandeTitre={demande.titre}
                    currentTechnicienId={demande.technicien_id ?? null}
                    currentStatut={demande.statut as Statut}
                    currentUserId={user!.id}
                    onAssigned={invalidateAll}
                  />
                )}
              </CardContent>
            </Card>
          )}

          {/* ── BLOC CHANGEMENT DE STATUT ── */}
          {(canManage || isTechnicien) && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">
                  Mettre à jour le statut
                </CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <Select
                  value={newStatut}
                  onValueChange={(v) => setNewStatut(v as Statut)}
                >
                  <SelectTrigger>
                    <SelectValue placeholder="Choisir un nouveau statut…" />
                  </SelectTrigger>
                  <SelectContent>
                    {STATUTS.filter((s) => s !== demande.statut).map((s) => (
                      <SelectItem key={s} value={s}>
                        {STATUT_LABELS[s]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <Textarea
                  placeholder="Commentaire (optionnel)"
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
                {(newStatut === "resolue" || newStatut === "cloturee") && (
                  <div className="space-y-3 rounded-md border border-border bg-muted/30 p-3">
                    <p className="text-xs font-medium text-muted-foreground">
                      Rapport d'intervention (clôture)
                    </p>
                    <Textarea
                      placeholder="Rapport technique : diagnostic, travaux réalisés, pièces utilisées…"
                      value={rapportIntervention}
                      onChange={(e) => setRapportIntervention(e.target.value)}
                      rows={4}
                      maxLength={2000}
                    />
                    <div className="space-y-1.5">
                      <label className="text-xs text-muted-foreground">
                        Coût estimé (FCFA)
                      </label>
                      <Input
                        type="number"
                        min="0"
                        step="0.01"
                        placeholder="Ex : 25000"
                        value={coutEstime}
                        onChange={(e) => setCoutEstime(e.target.value)}
                      />
                    </div>
                  </div>
                )}
                <Button
                  onClick={handleUpdate}
                  disabled={!newStatut || updating}
                >
                  {updating && (
                    <Loader2 className="h-4 w-4 animate-spin mr-2" />
                  )}
                  Appliquer
                </Button>
              </CardContent>
            </Card>
          )}

          {/* Historique */}
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Historique
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historique.length === 0 ? (
                <p className="text-sm text-muted-foreground">
                  Aucun historique.
                </p>
              ) : (
                <ol className="relative border-l-2 border-border ml-2 space-y-4">
                  {historique.map((h) => (
                    <li key={h.id} className="ml-4">
                      <div className="absolute -left-[7px] h-3 w-3 rounded-full bg-primary" />
                      <div className="text-sm font-medium">{h.action}</div>
                      {h.commentaire && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {h.commentaire}
                        </p>
                      )}
                      <div className="text-xs text-muted-foreground mt-1">
                        {formatDateTime(h.created_at)}
                      </div>
                    </li>
                  ))}
                </ol>
              )}
            </CardContent>
          </Card>
        </div>

        {/* Colonne latérale */}
        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <InfoRow
                label="Créée le"
                value={formatDateTime(demande.created_at)}
              />
              {demande.date_souhaitee && (
                <InfoRow
                  label="Date souhaitée"
                  value={new Date(demande.date_souhaitee).toLocaleDateString(
                    "fr-FR"
                  )}
                />
              )}
              {demande.date_resolution && (
                <InfoRow
                  label="Résolue le"
                  value={formatDateTime(demande.date_resolution)}
                />
              )}

              {/* Demandeur */}
              {demandeurProfile && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <UserIcon className="h-3 w-3 inline mr-1" />
                    Demandeur
                  </div>
                  <div className="font-medium">
                    {demandeurProfile.prenom} {demandeurProfile.nom}
                  </div>
                  {demandeurProfile.service && (
                    <div className="text-xs text-muted-foreground">
                      {demandeurProfile.service}
                    </div>
                  )}
                </div>
              )}

              {/* Technicien affecté */}
              {technicienProfile && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <Wrench className="h-3 w-3 inline mr-1" />
                    Technicien affecté
                  </div>
                  <div className="font-medium">
                    {technicienProfile.prenom} {technicienProfile.nom}
                  </div>
                  {technicienProfile.service && (
                    <div className="text-xs text-muted-foreground">
                      {technicienProfile.service}
                    </div>
                  )}
                </div>
              )}

              {/* Infrastructure */}
              {infra && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <MapPin className="h-3 w-3 inline mr-1" />
                    Infrastructure
                  </div>
                  <div className="font-medium">
                    {infra.code} — {infra.nom}
                  </div>
                  {infra.localisation && (
                    <div className="text-xs text-muted-foreground">
                      {infra.localisation}
                    </div>
                  )}
                </div>
              )}

              {/* Emplacement exact de l'intervention */}
              {position && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    <MapPin className="h-3 w-3 inline mr-1" />
                    Emplacement
                  </div>
                  <div className="font-mono text-xs">
                    {formatDecimal(position.latitude, position.longitude)}
                  </div>
                  <div className="text-xs text-muted-foreground">
                    {position.source === "demande"
                      ? position.precision_m != null
                        ? `Relevé sur place, à ${Math.round(position.precision_m)} m près`
                        : "Position saisie avec la demande"
                      : "Position de référence de l'infrastructure"}
                  </div>
                  <div className="flex gap-3 mt-1 text-xs">
                    <a href={lienGoogleMaps(position.latitude, position.longitude)} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                      Voir sur Google Maps
                    </a>
                    <a href={lienItineraire(position.latitude, position.longitude)} target="_blank" rel="noreferrer" className="text-primary underline underline-offset-2">
                      Itinéraire
                    </a>
                  </div>
                </div>
              )}

              {demande.rapport_intervention && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Rapport d'intervention
                  </div>
                  <p className="text-sm whitespace-pre-wrap">{demande.rapport_intervention}</p>
                </div>
              )}

              {demande.cout_estime != null && (
                <InfoRow
                  label="Coût estimé"
                  value={`${Number(demande.cout_estime).toLocaleString("fr-FR")} FCFA`}
                />
              )}

              {demande.commentaire_resolution && (
                <div>
                  <div className="text-xs uppercase tracking-wider text-muted-foreground mb-1">
                    Commentaire de résolution
                  </div>
                  <p className="text-sm">{demande.commentaire_resolution}</p>
                </div>
              )}
            </CardContent>
          </Card>

          {/* ── BLOC PRIORISATION (chef de service / admin) ── */}
          {canManage && !isVerrouillee && (
            <Card>
              <CardHeader>
                <CardTitle className="text-base">Priorisation</CardTitle>
              </CardHeader>
              <CardContent>
                <Select
                  value={demande.priorite}
                  onValueChange={(v) => handlePrioriteChange(v as Priorite)}
                  disabled={changingPriorite}
                >
                  <SelectTrigger>
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent>
                    {PRIORITES.map((p) => (
                      <SelectItem key={p} value={p}>
                        {PRIORITE_LABELS[p]}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
                <p className="text-xs text-muted-foreground mt-2">
                  Ajustez la priorité selon l'urgence réelle constatée sur le
                  terrain.
                </p>
              </CardContent>
            </Card>
          )}
        </div>
      </div>
    </div>
  );
}

// ── Composant TechnicienSelect ────────────────────────────
function TechnicienSelect({
  demandeId,
  demandeReference,
  demandeTitre,
  currentTechnicienId,
  currentStatut, // ✅ nouveau prop : statut réel de la demande
  currentUserId,
  onAssigned,
}: {
  demandeId: string;
  demandeReference: string;
  demandeTitre: string;
  currentTechnicienId: string | null;
  currentStatut: Statut;
  currentUserId: string;
  onAssigned: () => void;
}) {
  const [techId, setTechId] = useState(currentTechnicienId ?? "");
  const [assigning, setAssigning] = useState(false);

  const { data: techniciens = [], isLoading } = useQuery({
    queryKey: ["techniciens-list"],
    queryFn: async () => {
      const { data: roles, error: e1 } = await supabase
        .from("user_roles")
        .select("user_id")
        .eq("role", "technicien");

      if (e1 || !roles || roles.length === 0) return [];

      const ids = roles.map((r) => r.user_id);
      const { data: profiles, error: e2 } = await supabase
        .from("profiles")
        .select("id, nom, prenom, email, service")
        .in("id", ids)
        .order("nom");

      if (e2) return [];
      return profiles ?? [];
    },
  });

  const handleAssign = async () => {
    if (!techId) return;
    setAssigning(true);

    // ✅ On ne bascule vers "assignee" que si la demande est encore "nouvelle".
    // Si elle est déjà "en_cours" (ou autre), on garde le statut existant :
    // changer de technicien ne doit pas faire régresser le workflow.
    const nouveauStatut: Statut =
      currentStatut === "nouvelle" ? "assignee" : currentStatut;

    const { error } = await supabase
      .from("demandes")
      .update({
        technicien_id: techId,
        statut: nouveauStatut,
      })
      .eq("id", demandeId);

    if (!error) {
      await supabase.from("historique").insert({
        demande_id: demandeId,
        user_id: currentUserId,
        // ✅ Libellé différent selon affectation initiale ou réaffectation
        action: currentTechnicienId
          ? "Technicien réaffecté"
          : "Technicien affecté",
        // ✅ Vrai statut courant au lieu de "nouvelle" en dur
        ancien_statut: currentStatut,
        nouveau_statut: nouveauStatut,
      });

      // BF09 — notification in-app + email au technicien nouvellement affecté
      const technicien = techniciens.find((t) => t.id === techId);
      void notifyUser({
        userId: techId,
        demandeId,
        type: "affectation",
        message: `Vous avez été affecté à la demande ${demandeReference} : ${demandeTitre}`,
      });
      if (technicien?.email) {
        void sendAssignmentEmail({
          technicienEmail: technicien.email,
          technicienNom: `${technicien.prenom} ${technicien.nom}`,
          demandeReference,
          demandeTitre,
          demandeId,
        });
      }

      toast.success("Technicien affecté avec succès");
      onAssigned();
    } else {
      toast.error(error.message);
    }

    setAssigning(false);
  };

  return (
    <div className="space-y-3">
      {currentTechnicienId && (
        <p className="text-xs text-amber-600 bg-amber-50 px-3 py-2 rounded-md border border-amber-200">
          Un technicien est déjà affecté. Vous pouvez le remplacer.
        </p>
      )}
      <div className="flex gap-3">
        <Select value={techId} onValueChange={setTechId}>
          <SelectTrigger className="flex-1">
            <SelectValue placeholder="Choisir un technicien…" />
          </SelectTrigger>
          <SelectContent>
            {isLoading ? (
              <SelectItem value="loading" disabled>
                Chargement…
              </SelectItem>
            ) : techniciens.length === 0 ? (
              <SelectItem value="none" disabled>
                Aucun technicien disponible — ajoutez-en via Utilisateurs
              </SelectItem>
            ) : (
              techniciens.map((t) => (
                <SelectItem key={t.id} value={t.id}>
                  {t.prenom} {t.nom}
                  {t.service ? ` — ${t.service}` : ""}
                </SelectItem>
              ))
            )}
          </SelectContent>
        </Select>
        <Button
          onClick={handleAssign}
          disabled={!techId || assigning || techId === currentTechnicienId}
          size="sm"
        >
          {assigning ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            "Affecter"
          )}
        </Button>
      </div>
    </div>
  );
}

// ── Composant InfoRow ─────────────────────────────────────
function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">
        {label}
      </span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
