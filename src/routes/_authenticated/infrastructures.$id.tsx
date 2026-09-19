import { createFileRoute, Link, useParams } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { ArrowLeft, Building2, History, Loader2, Wrench } from "lucide-react";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  formatDate,
  prioriteBadgeClass,
  PRIORITE_LABELS,
  STATUT_LABELS,
  statutBadgeClass,
  TYPE_INFRA_LABELS,
} from "@/lib/rpi-helpers";

export const Route = createFileRoute("/_authenticated/infrastructures/$id")({
  head: () => ({ meta: [{ title: "Historique infrastructure — RPI-PAD" }] }),
  component: InfrastructureHistorique,
});

/**
 * Module « Historique par infrastructure » (BF07) — l'un des apports
 * différenciateurs majeurs de la solution par rapport à RPI-GMAO : pour
 * chaque infrastructure, on retrace ici l'intégralité des demandes et
 * interventions passées, avec dates, techniciens intervenus, statuts et
 * coûts, afin d'appuyer les décisions de maintenance préventive.
 */
function InfrastructureHistorique() {
  const { id } = useParams({ from: "/_authenticated/infrastructures/$id" });

  const { data: infra, isLoading: loadingInfra } = useQuery({
    queryKey: ["infrastructure", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("infrastructures")
        .select("*")
        .eq("id", id)
        .single();
      if (error) throw error;
      return data;
    },
  });

  const { data: demandes = [], isLoading: loadingDemandes } = useQuery({
    queryKey: ["infrastructure-demandes", id],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .eq("infrastructure_id", id)
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const technicienIds = Array.from(
    new Set(demandes.map((d) => d.technicien_id).filter((v): v is string => !!v))
  );

  const { data: techniciens = [] } = useQuery({
    queryKey: ["infrastructure-techniciens", technicienIds],
    enabled: technicienIds.length > 0,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("profiles")
        .select("id, nom, prenom")
        .in("id", technicienIds);
      if (error) throw error;
      return data;
    },
  });
  const technicienNom = (idTech: string | null) => {
    if (!idTech) return "—";
    const t = techniciens.find((p) => p.id === idTech);
    return t ? `${t.prenom} ${t.nom}` : "—";
  };

  const stats = {
    total: demandes.length,
    cloturees: demandes.filter((d) => d.statut === "cloturee" || d.statut === "resolue").length,
    coutTotal: demandes.reduce((sum, d) => sum + (d.cout_estime ? Number(d.cout_estime) : 0), 0),
  };

  if (loadingInfra) {
    return (
      <div className="flex items-center justify-center py-20">
        <Loader2 className="h-6 w-6 animate-spin text-primary" />
      </div>
    );
  }

  if (!infra) {
    return (
      <div className="max-w-3xl mx-auto text-center py-20">
        <p className="text-muted-foreground">Infrastructure introuvable.</p>
        <Button asChild variant="outline" className="mt-4">
          <Link to="/infrastructures">Retour aux infrastructures</Link>
        </Button>
      </div>
    );
  }

  return (
    <div className="max-w-5xl space-y-6">
      <div>
        <Button asChild variant="ghost" size="sm" className="mb-2 -ml-2">
          <Link to="/infrastructures">
            <ArrowLeft className="h-4 w-4 mr-1" /> Retour aux infrastructures
          </Link>
        </Button>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="font-mono text-sm text-muted-foreground">{infra.code}</span>
              <Badge variant="outline">{TYPE_INFRA_LABELS[infra.type]}</Badge>
            </div>
            <h1 className="text-2xl md:text-3xl font-bold text-foreground flex items-center gap-2">
              <Building2 className="h-6 w-6 text-primary" />
              {infra.nom}
            </h1>
            {infra.localisation && (
              <p className="text-muted-foreground mt-1">{infra.localisation}</p>
            )}
          </div>
        </div>
      </div>

      <div className="grid grid-cols-3 gap-4">
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Interventions
            </div>
            <div className="text-2xl font-bold mt-1">{stats.total}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Clôturées
            </div>
            <div className="text-2xl font-bold mt-1">{stats.cloturees}</div>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-4">
            <div className="text-xs uppercase tracking-wider text-muted-foreground">
              Coût cumulé
            </div>
            <div className="text-2xl font-bold mt-1">
              {stats.coutTotal.toLocaleString("fr-FR")} FCFA
            </div>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <History className="h-5 w-5 text-primary" />
            Historique des interventions
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {loadingDemandes ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : demandes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucune intervention enregistrée pour cette infrastructure.
            </div>
          ) : (
            <div className="divide-y divide-border">
              {demandes.map((d) => (
                <Link
                  key={d.id}
                  to="/demandes/$id"
                  params={{ id: d.id }}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 p-4 hover:bg-accent/40 transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{d.reference}</span>
                      <Badge className={prioriteBadgeClass(d.priorite)} variant="outline">
                        {PRIORITE_LABELS[d.priorite]}
                      </Badge>
                    </div>
                    <div className="font-medium text-foreground mt-1">{d.titre}</div>
                    <div className="text-xs text-muted-foreground mt-1 flex items-center gap-1">
                      <Wrench className="h-3 w-3" /> {technicienNom(d.technicien_id)}
                    </div>
                  </div>
                  <div className="flex flex-col items-end gap-1 shrink-0">
                    <Badge className={statutBadgeClass(d.statut)} variant="outline">
                      {STATUT_LABELS[d.statut]}
                    </Badge>
                    <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
                    {d.cout_estime != null && (
                      <span className="text-xs text-muted-foreground">
                        {Number(d.cout_estime).toLocaleString("fr-FR")} FCFA
                      </span>
                    )}
                  </div>
                </Link>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
