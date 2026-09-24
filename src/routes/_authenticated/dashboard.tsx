import { createFileRoute, Link, useNavigate } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import {
  ClipboardList,
  AlertOctagon,
  CheckCircle2,
  Clock,
  Timer,
  TrendingUp,
  Wrench,
  ArrowUpRight,
  ActivitySquare,
} from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
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
  type Priorite,
  type Statut,
} from "@/lib/rpi-helpers";

interface EquipementSurveille {
  id: string;
  code: string;
  nom: string;
  interventions_12m: number;
  interventions_6m: number;
  urgences_12m: number;
  cout_12m: number | string | null;
  derniere_intervention: string;
  intervalle_moyen_jours: number | null;
}

export const Route = createFileRoute("/_authenticated/dashboard")({
  head: () => ({ meta: [{ title: "Tableau de bord — RPI-PAD" }] }),
  component: Dashboard,
});

/** Respecte le réglage système « réduire les animations ». */
function useAnimationsReduites() {
  const [reduites, setReduites] = useState(false);
  useEffect(() => {
    if (typeof window === "undefined" || !window.matchMedia) return;
    const requete = window.matchMedia("(prefers-reduced-motion: reduce)");
    setReduites(requete.matches);
    const surChangement = (e: MediaQueryListEvent) => setReduites(e.matches);
    requete.addEventListener("change", surChangement);
    return () => requete.removeEventListener("change", surChangement);
  }, []);
  return reduites;
}

/** Fait grimper un nombre de 0 jusqu'à sa valeur, en décélérant à l'arrivée. */
function useCompteur(cible: number, actif: boolean, duree = 800) {
  const [valeur, setValeur] = useState(actif ? 0 : cible);

  useEffect(() => {
    if (!actif) {
      setValeur(cible);
      return;
    }
    let debut: number | null = null;
    let image = 0;
    const etape = (horodatage: number) => {
      if (debut === null) debut = horodatage;
      const avancement = Math.min((horodatage - debut) / duree, 1);
      const adouci = 1 - Math.pow(1 - avancement, 3);
      setValeur(Math.round(cible * adouci));
      if (avancement < 1) image = requestAnimationFrame(etape);
    };
    image = requestAnimationFrame(etape);
    return () => cancelAnimationFrame(image);
  }, [cible, actif, duree]);

  return valeur;
}

function Dashboard() {
  const { profile, hasAnyRole } = useAuth();
  const navigate = useNavigate();
  const canManage = hasAnyRole(["admin", "chef_service"]);
  const animationsReduites = useAnimationsReduites();

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
    const urgentes = demandes.filter(
      (d) => d.priorite === "urgente" && d.statut !== "cloturee" && d.statut !== "resolue"
    ).length;
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
  // de bord KPI » du mémoire). La clé brute accompagne le libellé afin que
  // le clic sur une barre sache vers quel filtre renvoyer.
  const repartitionStatuts = useMemo(
    () =>
      STATUTS.map((s) => ({
        cle: s,
        statut: STATUT_LABELS[s],
        total: demandes.filter((d) => d.statut === s).length,
      })),
    [demandes]
  );

  // ── Équipements à surveiller ──────────────────────────────────────────
  // Première lecture des tendances : les infrastructures qui concentrent
  // les interventions sur les douze derniers mois. Le regroupement est
  // fait par la base (vue vue_equipements_surveiller), pas ici : la page
  // ne reçoit que quelques lignes, déjà comptées et déjà triées.
  const { data: aSurveiller = [] } = useQuery({
    queryKey: ["equipements-surveiller"],
    enabled: canManage,
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("vue_equipements_surveiller" as never)
        .select("*")
        .limit(5);
      // La vue peut ne pas exister sur une base qui n'a pas encore reçu la
      // migration : dans ce cas l'encadré disparaît au lieu de tout casser.
      if (error) return [] as EquipementSurveille[];
      return (data ?? []) as unknown as EquipementSurveille[];
    },
  });

  // Urgences actives : demandes de priorité "urgente" non encore closes.
  const urgencesActives = demandes
    .filter((d) => d.priorite === "urgente" && d.statut !== "cloturee" && d.statut !== "resolue")
    .slice(0, 5);

  const recentes = demandes.slice(0, 6);

  const animer = !isLoading && !animationsReduites;

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4 animate-in fade-in slide-in-from-top-2 duration-500">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">
            Bonjour, {profile?.prenom} 👋
          </h1>
          <p className="text-muted-foreground mt-1">
            Vue d'ensemble des interventions techniques de la RPI.
          </p>
        </div>
        <Button asChild className="transition-transform hover:scale-[1.02] active:scale-95">
          <Link to="/demandes/nouvelle">Nouvelle demande</Link>
        </Button>
      </div>

      {/* Indicateurs. Chaque carte qui porte un lien ouvre la liste des
          demandes déjà filtrée sur ce qu'elle compte. */}
      <div className="grid gap-4 grid-cols-2 lg:grid-cols-3 2xl:grid-cols-6">
        <KpiCard
          title={canManage ? "Total demandes" : "Mes demandes"}
          value={kpis.total}
          icon={ClipboardList}
          tone="primary"
          loading={isLoading}
          animer={animer}
          rang={0}
          lien={{ to: "/demandes", search: {} }}
          aide="Voir toutes les demandes"
        />
        <KpiCard
          title="Urgentes en attente"
          value={kpis.urgentes}
          icon={AlertOctagon}
          tone="destructive"
          loading={isLoading}
          animer={animer}
          rang={1}
          lien={{ to: "/demandes", search: { priorite: "urgente" as Priorite } }}
          aide="Voir les demandes urgentes"
        />
        <KpiCard
          title="En cours"
          value={kpis.enCours}
          icon={Wrench}
          tone="gold"
          loading={isLoading}
          animer={animer}
          rang={2}
          lien={{ to: "/demandes", search: { statut: "en_cours" as Statut } }}
          aide="Voir les interventions en cours"
        />
        <KpiCard
          title="Nouvelles"
          value={kpis.nouvelles}
          icon={Clock}
          tone="info"
          loading={isLoading}
          animer={animer}
          rang={3}
          lien={{ to: "/demandes", search: { statut: "nouvelle" as Statut } }}
          aide="Voir les demandes nouvelles"
        />
        <KpiCard
          title="Délai moyen résolution"
          value={kpis.delaiMoyen == null ? "—" : `${kpis.delaiMoyen.toFixed(1)} j`}
          icon={Timer}
          tone="info"
          loading={isLoading}
          animer={animer}
          rang={4}
        />
        <KpiCard
          title="Taux résolution"
          value={`${kpis.tauxResolution}%`}
          icon={CheckCircle2}
          tone="success"
          loading={isLoading}
          animer={animer}
          rang={5}
          lien={{ to: "/demandes", search: { statut: "resolue" as Statut } }}
          aide="Voir les demandes résolues"
        />
      </div>

      {/* Répartition par statut + urgences actives */}
      {canManage && (
        <div className="grid lg:grid-cols-2 gap-4">
          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500">
            <CardHeader>
              <CardTitle className="text-base">Répartition par statut</CardTitle>
              <p className="text-xs text-muted-foreground">
                Cliquez sur une barre pour filtrer la liste des demandes.
              </p>
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
                  <Tooltip
                    cursor={{ fill: "var(--accent)", opacity: 0.3 }}
                    contentStyle={{
                      background: "var(--popover)",
                      border: "1px solid var(--border)",
                      borderRadius: "var(--radius-md)",
                      color: "var(--popover-foreground)",
                      fontSize: 12,
                    }}
                  />
                  {/* Les couleurs du thème sont déclarées en oklch (Tailwind v4) :
                      on référence la variable telle quelle, sans wrapper hsl(). */}
                  <Bar
                    dataKey="total"
                    fill="var(--primary)"
                    radius={[4, 4, 0, 0]}
                    isAnimationActive={!animationsReduites}
                    animationDuration={700}
                    className="cursor-pointer"
                    onClick={(donnees: unknown) => {
                      const entree = donnees as { payload?: { cle?: Statut } };
                      const cle = entree?.payload?.cle;
                      if (cle) navigate({ to: "/demandes", search: { statut: cle } });
                    }}
                  >
                    {repartitionStatuts.map((entree) => (
                      <Cell key={entree.cle} className="transition-opacity hover:opacity-80" />
                    ))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </CardContent>
          </Card>

          <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-100">
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
                      className="block rounded-md border border-destructive/30 bg-destructive/5 px-3 py-2 transition-all duration-200 hover:bg-destructive/10 hover:translate-x-1 active:scale-[0.99]"
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

      {/* Équipements à surveiller */}
      {canManage && aSurveiller.length > 0 && (
        <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-150">
          <CardHeader className="flex flex-row items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <ActivitySquare className="h-5 w-5 text-primary" />
                Équipements à surveiller
              </CardTitle>
              <p className="text-xs text-muted-foreground mt-1">
                Infrastructures les plus sollicitées sur les douze derniers mois. Au-delà de
                trois interventions, un remplacement mérite d'être étudié.
              </p>
            </div>
          </CardHeader>
          <CardContent className="space-y-2">
            {aSurveiller.map((e) => {
              const aRisque = e.interventions_12m >= 3;
              const cout = Number(e.cout_12m ?? 0);
              return (
                <Link
                  key={e.id}
                  to="/infrastructures/$id"
                  params={{ id: e.id }}
                  className="flex flex-wrap items-center justify-between gap-3 rounded-lg border border-border p-3 transition-colors hover:bg-accent/30"
                >
                  <div className="min-w-0">
                    <div className="font-medium flex items-center gap-2">
                      <span className="font-mono text-xs text-muted-foreground">{e.code}</span>
                      <span className="truncate">{e.nom}</span>
                      {aRisque && (
                        <Badge variant="outline" className="border-destructive/40 text-destructive">
                          À surveiller
                        </Badge>
                      )}
                    </div>
                    <div className="text-xs text-muted-foreground mt-0.5">
                      {e.intervalle_moyen_jours
                        ? `Une intervention tous les ${e.intervalle_moyen_jours} jours en moyenne`
                        : "Interventions trop récentes pour dégager un rythme"}
                      {e.urgences_12m > 0 &&
                        ` · ${e.urgences_12m} urgence${e.urgences_12m > 1 ? "s" : ""}`}
                      {` · dernière le ${formatDate(e.derniere_intervention)}`}
                    </div>
                  </div>
                  <div className="text-right">
                    <div className="font-semibold">
                      {e.interventions_12m} intervention{e.interventions_12m > 1 ? "s" : ""}
                    </div>
                    {cout > 0 && (
                      <div className="text-xs text-muted-foreground">
                        {cout.toLocaleString("fr-FR")} FCFA cumulés
                      </div>
                    )}
                  </div>
                </Link>
              );
            })}
          </CardContent>
        </Card>
      )}

      {/* Demandes récentes */}
      <Card className="animate-in fade-in slide-in-from-bottom-3 duration-500 delay-200">
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle className="flex items-center gap-2">
              <TrendingUp className="h-5 w-5 text-primary" />
              Demandes récentes
            </CardTitle>
          </div>
          <Button asChild variant="outline" size="sm" className="transition-transform active:scale-95">
            <Link to="/demandes">Tout voir</Link>
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="space-y-3 py-2">
              {[0, 1, 2].map((i) => (
                <div key={i} className="h-12 rounded-md bg-muted/50 animate-pulse" />
              ))}
            </div>
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
                  className="flex flex-col sm:flex-row sm:items-center gap-2 sm:gap-4 py-3 -mx-3 px-3 rounded-md transition-all duration-200 hover:bg-accent/40 hover:translate-x-1 active:scale-[0.995]"
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

type LienKpi =
  | { to: "/demandes"; search: Record<string, never> }
  | { to: "/demandes"; search: { statut: Statut } }
  | { to: "/demandes"; search: { priorite: Priorite } };

function KpiCard({
  title,
  value,
  icon: Icon,
  tone,
  loading,
  animer,
  rang,
  lien,
  aide,
}: {
  title: string;
  value: number | string;
  icon: React.ComponentType<{ className?: string }>;
  tone: "primary" | "destructive" | "gold" | "info" | "success";
  loading?: boolean;
  animer?: boolean;
  rang?: number;
  lien?: LienKpi;
  aide?: string;
}) {
  const toneClasses = {
    primary: "bg-primary/10 text-primary",
    destructive: "bg-destructive/10 text-destructive",
    gold: "bg-gold/15 text-gold-foreground",
    info: "bg-info/10 text-info",
    success: "bg-success/10 text-success",
  }[tone];

  // Seules les valeurs numériques se prêtent au décompte ; les valeurs
  // formatées (« 3,4 j », « 72 % ») s'affichent telles quelles.
  const estNombre = typeof value === "number";
  const compte = useCompteur(estNombre ? (value as number) : 0, Boolean(animer) && estNombre);
  const affichage = loading ? "—" : estNombre ? compte : value;

  const contenu = (
    <CardContent className="p-5">
      <div className="flex items-start justify-between">
        <div className="min-w-0">
          <div className="text-xs uppercase tracking-wider text-muted-foreground flex items-start gap-1 leading-snug">
            <span>{title}</span>
            {lien && (
              <ArrowUpRight className="h-3 w-3 shrink-0 opacity-0 -translate-x-1 transition-all duration-200 group-hover:opacity-100 group-hover:translate-x-0" />
            )}
          </div>
          <div className="text-2xl md:text-3xl font-bold text-foreground mt-1 tabular-nums whitespace-nowrap">
            {affichage}
          </div>
        </div>
        <div
          className={`h-10 w-10 rounded-md flex items-center justify-center shrink-0 transition-transform duration-200 group-hover:scale-110 ${toneClasses}`}
        >
          <Icon className="h-5 w-5" />
        </div>
      </div>
    </CardContent>
  );

  const apparition = "animate-in fade-in slide-in-from-bottom-2 duration-500 fill-mode-backwards";
  const retard = ["", "delay-75", "delay-100", "delay-150", "delay-200", "delay-300"][rang ?? 0] ?? "";

  if (!lien) {
    return (
      <Card className={`overflow-hidden group ${apparition} ${retard}`}>{contenu}</Card>
    );
  }

  return (
    <Link
      to={lien.to}
      search={lien.search}
      title={aide}
      aria-label={aide}
      className={`group rounded-xl focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 ${apparition} ${retard}`}
    >
      <Card className="overflow-hidden h-full transition-all duration-200 hover:shadow-lg hover:border-primary/40 hover:-translate-y-0.5 active:translate-y-0 active:scale-[0.99] cursor-pointer">
        {contenu}
      </Card>
    </Link>
  );
}
