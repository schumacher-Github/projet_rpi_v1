import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Timer,
  TrendingUp,
  Wrench,
} from "lucide-react";
import { useMemo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  formatDate,
  prioriteBadgeClass,
  PRIORITE_LABELS,
  STATUT_LABELS,
  STATUTS,
  statutBadgeClass,
  type Statut,
} from "@/lib/rpi-helpers";

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord — RPI-PAD" }] }),
  component: Dashboard,
});

function Dashboard() {
  const { profile, hasAnyRole } = useAuth();
  const canManage = hasAnyRole(["admin", "chef_service"]);

  const { data: demandes = [], isLoading } = useQuery({
    queryKey: ["dashboard-demandes"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const kpis = useMemo(() => {
    const total = demandes.length;
    const byStatut = (s: Statut) => demandes.filter((d) => d.statut === s).length;
    const urgentes = demandes.filter((d) => d.priorite === "urgente" && d.statut !== "cloturee" && d.statut !== "resolue").length;
    const enCours = byStatut("en_cours") + byStatut("assignee");
    const resolues = byStatut("resolue") + byStatut("cloturee");
    const nouvelles = byStatut("nouvelle");
    const tauxResolution = total === 0 ? 0 : Math.round((resolues / total) * 100);

    // Délai moyen de résolution (en jours), calculé sur les demandes déjà
    // clôturées/résolues qui portent une date_resolution.
    const delais = demandes
      .filter((d) => d.date_resolution)
      .map(
        (d) =>
          (new Date(d.date_resolution!).getTime() - new Date(d.created_at).getTime()) /
          (1000 * 60 * 60 * 24)
      );
    const delaiMoyen =
      delais.length === 0 ? null : delais.reduce((a, b) => a + b, 0) / delais.length;

    return { total, urgentes, enCours, resolues, nouvelles, tauxResolution, delaiMoyen };
  }, [demandes]);

  // Répartition par statut, pour le graphique en barres (figure « Tableau
  // de bord KPI » du mémoire).
  const repartitionStatuts = useMemo(
    () =>
      STATUTS.map((s) => ({
        statut: STATUT_LABELS[s],
        total: demandes.filter((d) => d.statut === s).length,
      })),
    [demandes]
  );

  // Urgences actives : demandes de priorité "urgente" non encore closes.
  const urgencesActives = demandes
    .filter((d) => d.priorite === "urgente" && d.statut !== "cloturee" && d.statut !== "resolue")
    .slice(0, 5);

  const recentes = demandes.slice(0, 6);

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Bonjour, {profile?.prenom} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Vue d'ensemble des interventions techniques de la RPI.
          </p>
        </div>
        <Button asChild>
          <Link to="/demandes/nouvelle">Nouvelle demande</Link>
        </Button>
      </div>

      {/* KPI cards */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
        <KpiCard
          title={canManage ? "Total demandes" : "Mes demandes"}
          value={kpis.total}
          icon={ClipboardList}
          tone="primary"
          loading={isLoading}
        />
        <KpiCard
          title="Urgentes en attente"
          value={kpis.urgentes}
          icon={AlertOctagon}
          tone="destructive"
          loading={isLoading}
        />
        <KpiCard
          title="En cours"
          value={kpis.enCours}
          icon={Wrench}
          tone="gold"
          loading={isLoading}
        />
        <KpiCard
          title="Nouvelles"
          value={kpis.nouvelles}
          icon={Clock}
          tone="info"
          loading={isLoading}
        />
        <KpiCard
          title="Délai moyen résolution"
          value={kpis.delaiMoyen == null ? "—" : `${kpis.delaiMoyen.toFixed(1)} j`}
          icon={Timer}
          tone="info"
          loading={isLoading}
        />
        <KpiCard
          title="Taux résolution"
          value={`${kpis.tauxResolution}%`}
          icon={CheckCircle2}
          tone="success"
          loading={isLoading}
        />
      </div>

      {/* Répartition par statut + urgences actives */}
      {canManage && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-base">Répartition par statut</CardTitle>
            </CardHeader>
            <CardContent className="h-64">
              <ResponsiveContainer width="100%" height="100%">
                <BarChart data={repartitionStatuts}>
                  <CartesianGrid strokeDasharray="3 3" vertical={false} className="stroke-border" />
                  <XAxis
                    dataKey="statut"
                    tick={{ fontSize: 11 }}
                    interval={0}
                    angle={-15}
                    textAnchor="end"
                    height={50}
                  />
                  <YAxis tick={{ fontSize: 11 }} allowDecimals={false} />
                  <Tooltip />
                  {/* Les couleurs du thème sont déclarées en oklch (Tailwind v4) :
                      on référence la variable telle quelle, sans wrapper hsl(). */}
                  <Bar dataKey="total" fill="var(--primary)" radius={[4, 4, 0, 0]} />
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="text-base flex items-center gap-2">
                <AlertOctagon className="h-4 w-4 text-destructive" />
                Urgences actives
              </CardTitle>
            </CardHeader>
            <CardContent>
              {urgencesActives.length === 0 ? (
                <p className="text-sm text-muted-foreground py-6 text-center">
                  Aucune urgence en attente. 🎉
                </p>
              ) : (
                <div className="space-y-3">
                  {urgencesActives.map((d) => (
                    <Link
                      key={d.id}
                      to="/demandes/$id"
                      params={{ id: d.id }}
                      className="block rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 hover:bg-destructive/10 transition-colors"
                    >
                      <div className="font-medium text-sm">{d.titre}</div>
                      <div className="text-xs text-muted-foreground mt-0.5">
                        Depuis le {formatDate(d.created_at)} — {STATUT_LABELS[d.statut]}
                      </div>
                    </Link>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}

      {/* Recent interventions */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Demandes récentes
            </CardTitle>
          </div>
          <Button asChild variant="outline" size="sm">
            <Link to="/demandes">Tout voir</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-sm text-muted-foreground py-8 text-center">Chargement…</div>
          ) : recentes.length === 0 ? (
            <div className="text-sm text-muted-foreground py-8 text-center">
              Aucune demande pour le moment.{" "}
              <Link to="/demandes/nouvelle" className="text-primary underline">
                Créer la première
              </Link>
            </div>
          ) : (
            <div className="divide-y divide-border">
              {recentes.map((d) => (
                <Link
                  key={d.id}
                  to="/demandes/$id"
                  params={{ id: d.id }}
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 hover:bg-accent/40 -mx-3 px-3 rounded-md transition-colors"
                >
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{d.reference}</span>
                      <Badge className={prioriteBadgeClass(d.priorite)} variant="outline">
                        {PRIORITE_LABELS[d.priorite]}
                      </Badge>
                    </div>
                    <div className="font-medium text-foreground mt-1 truncate">{d.titre}</div>
                  </div>
                  <div className="flex items-center gap-3 shrink-0">
                    <Badge className={statutBadgeClass(d.statut)} variant="outline">
                      {STATUT_LABELS[d.statut]}
                    </Badge>
                    <span className="text-xs text-muted-foreground hidden sm:inline">
                      {formatDate(d.created_at)}
                    </span>
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

function KpiCard({
  title,
  value,
  icon: Icon,
  tone,
  loading,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "destructive" | "gold" | "info" | "success";
  loading?: boolean;
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
    gold: "bg-gold/15 text-gold-foreground",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
  }[tone];

  return (
    <Card className="overflow-hidden">
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <div className="text-xs uppercase tracking-wider text-muted-foreground">{title}</div>
            <div className="text-2xl md:text-3xl font-bold text-foreground mt-1">
              {loading ? "—" : value}
            </div>
          </div>
          <div className={`h-10 w-10 rounded-md flex items-center justify-center ${toneClasses}`}>
            <Icon className="h-5 w-5" />
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
