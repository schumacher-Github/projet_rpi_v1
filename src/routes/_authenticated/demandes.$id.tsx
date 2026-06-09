import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { ArrowLeft, Loader2, History, MapPin, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
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
  STATUT_LABELS,
  STATUTS,
  statutBadgeClass,
  type Statut,
} from "@/lib/rpi-helpers";

export const Route = createFileRoute("/_authenticated/demandes/$id")({
  head: () => ({ meta: [{ title: "Demande — RPI-PAD" }] }),
  component: DemandeDetail,
});

function DemandeDetail() {
  const { id } = useParams({ from: "/_authenticated/demandes/$id" });
  const { user, hasAnyRole } = useAuth();
  const qc = useQueryClient();
  const canManage = hasAnyRole(["admin", "chef_service", "technicien"]);

  const [updating, setUpdating] = useState(false);
  const [newStatut, setNewStatut] = useState<Statut | "">("");
  const [commentaire, setCommentaire] = useState("");

  const { data: demande, isLoading } = useQuery({
    queryKey: ["demande", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*, infrastructures(code, nom, localisation)")
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

  const handleUpdate = async () => {
    if (!demande || !user || !newStatut) return;
    setUpdating(true);
    const ancien = demande.statut;
    const updates: { statut: Statut; technicien_id?: string; date_resolution?: string | null; commentaire_resolution?: string | null } = {
      statut: newStatut,
    };
    if ((newStatut === "assignee" || newStatut === "en_cours") && !demande.technicien_id) {
      updates.technicien_id = user.id;
    }
    if (newStatut === "resolue" || newStatut === "cloturee") {
      updates.date_resolution = new Date().toISOString();
      if (commentaire) updates.commentaire_resolution = commentaire;
    }

    const { error } = await supabase.from("demandes").update(updates).eq("id", demande.id);
    if (!error) {
      await supabase.from("historique").insert({
        demande_id: demande.id,
        user_id: user.id,
        action: `Statut changé : ${STATUT_LABELS[ancien]} → ${STATUT_LABELS[newStatut]}`,
        ancien_statut: ancien,
        nouveau_statut: newStatut,
        commentaire: commentaire || null,
      });
    }
    setUpdating(false);
    if (error) {
      toast.error(error.message);
      return;
    }
    toast.success("Demande mise à jour");
    setCommentaire("");
    setNewStatut("");
    qc.invalidateQueries({ queryKey: ["demande", id] });
    qc.invalidateQueries({ queryKey: ["historique", id] });
    qc.invalidateQueries({ queryKey: ["dashboard-demandes"] });
    qc.invalidateQueries({ queryKey: ["demandes-list"] });
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
        <p className="text-muted-foreground">Demande introuvable ou inaccessible.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/demandes">Retour aux demandes</Link>
        </Button>
      </div>
    );
  }

  const infra = (demande as { infrastructures?: { code: string; nom: string; localisation: string | null } }).infrastructures;

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/demandes">
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-muted-foreground">{demande.reference}</span>
              <Badge className={prioriteBadgeClass(demande.priorite)} variant="outline">
                {PRIORITE_LABELS[demande.priorite]}
              </Badge>
              <Badge className={statutBadgeClass(demande.statut)} variant="outline">
                {STATUT_LABELS[demande.statut]}
              </Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground">{demande.titre}</h1>
          </div>
        </div>
      </div>

      <div className="grid lg:grid-cols-3 gap-6">
        <div className="lg:col-span-2 space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Description</CardTitle>
            </CardHeader>
            <CardContent>
              <p className="whitespace-pre-wrap text-sm leading-relaxed text-foreground">
                {demande.description}
              </p>
            </CardContent>
          </Card>

          {canManage && (
            <Card>
              <CardHeader>
                <CardTitle>Mettre à jour la demande</CardTitle>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="grid md:grid-cols-2 gap-3">
                  <Select value={newStatut} onValueChange={(v) => setNewStatut(v as Statut)}>
                    <SelectTrigger>
                      <SelectValue placeholder="Choisir un nouveau statut" />
                    </SelectTrigger>
                    <SelectContent>
                      {STATUTS.filter((s) => s !== demande.statut).map((s) => (
                        <SelectItem key={s} value={s}>
                          {STATUT_LABELS[s]}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <Textarea
                  placeholder="Commentaire (optionnel)"
                  value={commentaire}
                  onChange={(e) => setCommentaire(e.target.value)}
                  rows={3}
                  maxLength={1000}
                />
                <Button onClick={handleUpdate} disabled={!newStatut || updating}>
                  {updating && <Loader2 className="h-4 w-4 animate-spin mr-2" />}
                  Appliquer la modification
                </Button>
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <History className="h-5 w-5 text-primary" />
                Historique
              </CardTitle>
            </CardHeader>
            <CardContent>
              {historique.length === 0 ? (
                <p className="text-sm text-muted-foreground">Aucun historique.</p>
              ) : (
                <ol className="relative border-l-2 border-border ml-2 space-y-4">
                  {historique.map((h) => (
                    <li key={h.id} className="ml-4">
                      <div className="absolute -left-[7px] h-3 w-3 rounded-full bg-primary" />
                      <div className="text-sm font-medium">{h.action}</div>
                      {h.commentaire && (
                        <p className="text-sm text-muted-foreground mt-1">{h.commentaire}</p>
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

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle>Informations</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4 text-sm">
              <InfoRow label="Créée le" value={formatDateTime(demande.created_at)} />
              {demande.date_souhaitee && (
                <InfoRow label="Date souhaitée" value={new Date(demande.date_souhaitee).toLocaleDateString("fr-FR")} />
              )}
              {demande.date_resolution && (
                <InfoRow label="Résolue le" value={formatDateTime(demande.date_resolution)} />
              )}
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
                    <div className="text-xs text-muted-foreground">{demandeurProfile.service}</div>
                  )}
                </div>
              )}
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
                    <div className="text-xs text-muted-foreground">{infra.localisation}</div>
                  )}
                </div>
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
        </div>
      </div>
    </div>
  );
}

function InfoRow({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-xs uppercase tracking-wider text-muted-foreground">{label}</span>
      <span className="font-medium text-right">{value}</span>
    </div>
  );
}
