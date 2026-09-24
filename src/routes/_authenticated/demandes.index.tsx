import { createFileRoute, Link } from "@tanstack/react-router";
import { keepPreviousData, useQuery } from "@tanstack/react-query";
import { useEffect, useMemo, useState } from "react";
import { Search, Plus, X, SlidersHorizontal, ChevronLeft, ChevronRight } from "lucide-react";
import { z } from "zod";

import { supabase } from "@/integrations/supabase/client";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  formatDate,
  PRIORITE_LABELS,
  PRIORITES,
  prioriteBadgeClass,
  STATUT_LABELS,
  STATUTS,
  statutBadgeClass,
} from "@/lib/rpi-helpers";

// ─────────────────────────────────────────────────────────────────────────
//  Recherche et filtres
//
//  Les critères vivent dans l'adresse plutôt que dans l'état du composant :
//  une vue filtrée devient ainsi partageable, retrouvable par le bouton
//  « page précédente », et atteignable depuis un lien — ce dont se servent
//  les cartes d'indicateurs du tableau de bord.
//
//  Le filtrage et la pagination sont confiés à la base de données, et non
//  au navigateur : quel que soit le volume accumulé au fil des années, la
//  page ne rapatrie qu'une tranche de vingt lignes et le total exact.
// ─────────────────────────────────────────────────────────────────────────

const PAR_PAGE = 20;

const TRIS = {
  recentes: { libelle: "Plus récentes d'abord", colonne: "created_at", ascendant: false },
  anciennes: { libelle: "Plus anciennes d'abord", colonne: "created_at", ascendant: true },
  priorite: { libelle: "Priorité la plus forte", colonne: "priorite", ascendant: true },
  maj: { libelle: "Mises à jour récemment", colonne: "updated_at", ascendant: false },
} as const;
type CleTri = keyof typeof TRIS;

const PERIODES = {
  "7": "7 derniers jours",
  "30": "30 derniers jours",
  "90": "3 derniers mois",
  "365": "12 derniers mois",
} as const;
type ClePeriode = keyof typeof PERIODES;

const rechercheDemandes = z.object({
  statut: z.enum(["nouvelle", "assignee", "en_cours", "resolue", "cloturee", "rejetee"]).optional(),
  priorite: z.enum(["urgente", "normale", "planifiee"]).optional(),
  infra: z.string().uuid().optional(),
  periode: z.enum(["7", "30", "90", "365"]).optional(),
  tri: z.enum(["recentes", "anciennes", "priorite", "maj"]).optional(),
  q: z.string().optional(),
  page: z.number().int().min(1).optional(),
});

export const Route = createFileRoute("/_authenticated/demandes/")({
  head: () => ({ meta: [{ title: "Demandes — RPI-PAD" }] }),
  validateSearch: rechercheDemandes,
  component: DemandesList,
});

function DemandesList() {
  const navigate = Route.useNavigate();
  const { statut, priorite, infra, periode, tri, q, page } = Route.useSearch();
  const pageCourante = page ?? 1;
  const triCourant: CleTri = tri ?? "recentes";

  // Le champ de recherche réagit à chaque frappe, mais n'interroge la base
  // qu'après une courte pause : sans cela, « climatisation » déclencherait
  // treize requêtes.
  const [saisie, setSaisie] = useState(q ?? "");
  useEffect(() => setSaisie(q ?? ""), [q]);
  useEffect(() => {
    const minuteur = setTimeout(() => {
      const propre = saisie.trim();
      if (propre === (q ?? "")) return;
      navigate({
        search: (prec) => ({ ...prec, q: propre || undefined, page: undefined }),
        replace: true,
      });
    }, 350);
    return () => clearTimeout(minuteur);
  }, [saisie]); // eslint-disable-line react-hooks/exhaustive-deps

  const [filtresOuverts, setFiltresOuverts] = useState(
    Boolean(infra || periode || (tri && tri !== "recentes"))
  );

  const { data: infras = [] } = useQuery({
    queryKey: ["infrastructures-filtre"],
    staleTime: 5 * 60 * 1000,
    queryFn: async () => {
      const { data, error } = await supabase
        .from("infrastructures")
        .select("id, code, nom")
        .order("nom");
      if (error) throw error;
      return data;
    },
  });

  const { data, isLoading, isFetching } = useQuery({
    queryKey: [
      "demandes-list",
      { statut, priorite, infra, periode, tri: triCourant, q, pageCourante },
    ],
    placeholderData: keepPreviousData,
    queryFn: async () => {
      const t = TRIS[triCourant];
      let requete = supabase
        .from("demandes")
        .select("*, infrastructures(nom, code)", { count: "exact" });

      if (statut) requete = requete.eq("statut", statut);
      if (priorite) requete = requete.eq("priorite", priorite);
      if (infra) requete = requete.eq("infrastructure_id", infra);
      if (periode) {
        const depuis = new Date();
        depuis.setDate(depuis.getDate() - Number(periode));
        requete = requete.gte("created_at", depuis.toISOString());
      }
      if (q && q.trim()) {
        // Les caractères ayant un sens dans un motif PostgREST sont neutralisés.
        const motif = q.trim().replace(/[%,()]/g, " ");
        requete = requete.or(
          `reference.ilike.%${motif}%,titre.ilike.%${motif}%,description.ilike.%${motif}%`
        );
      }

      const debut = (pageCourante - 1) * PAR_PAGE;
      const { data, error, count } = await requete
        .order(t.colonne, { ascending: t.ascendant })
        .range(debut, debut + PAR_PAGE - 1);
      if (error) throw error;
      return { lignes: data ?? [], total: count ?? 0 };
    },
  });

  const lignes = data?.lignes ?? [];
  const total = data?.total ?? 0;
  const pages = Math.max(1, Math.ceil(total / PAR_PAGE));

  const majFiltre = (cle: string, valeur: string | undefined) =>
    navigate({
      search: (prec) => ({ ...prec, [cle]: valeur, page: undefined }),
      replace: true,
    });

  const allerPage = (n: number) => {
    navigate({ search: (prec) => ({ ...prec, page: n === 1 ? undefined : n }), replace: true });
    if (typeof window !== "undefined") window.scrollTo({ top: 0, behavior: "smooth" });
  };

  function reinitialiser() {
    setSaisie("");
    navigate({ search: () => ({}), replace: true });
  }

  const filtresActifs = Boolean(statut || priorite || infra || periode || (q && q.trim()));
  const infraChoisie = useMemo(() => infras.find((i) => i.id === infra), [infras, infra]);

  return (
    <div className="space-y-6 max-w-7xl animate-in fade-in duration-300">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Demandes d'intervention</h1>
          <p className="text-muted-foreground mt-1">
            Suivi et gestion de toutes les demandes accessibles.
          </p>
        </div>
        <Button asChild className="transition-transform active:scale-95">
          <Link to="/demandes/nouvelle">
            <Plus className="h-4 w-4 mr-1" /> Nouvelle demande
          </Link>
        </Button>
      </div>

      <Card>
        <CardContent className="p-4">
          <div className="flex flex-col md:flex-row gap-3">
            <div className="relative flex-1">
              <Search className="h-4 w-4 absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground" />
              <Input
                placeholder="Rechercher par référence, titre, description…"
                value={saisie}
                onChange={(e) => setSaisie(e.target.value)}
                className="pl-9 pr-9 transition-shadow focus-visible:shadow-md"
              />
              {saisie && (
                <button
                  type="button"
                  aria-label="Effacer la recherche"
                  onClick={() => setSaisie("")}
                  className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
                >
                  <X className="h-4 w-4" />
                </button>
              )}
            </div>
            <Select
              value={statut ?? "all"}
              onValueChange={(v) => majFiltre("statut", v === "all" ? undefined : v)}
            >
              <SelectTrigger className="w-full md:w-[170px] transition-colors">
                <SelectValue placeholder="Statut" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Tous statuts</SelectItem>
                {STATUTS.map((s) => (
                  <SelectItem key={s} value={s}>
                    {STATUT_LABELS[s]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Select
              value={priorite ?? "all"}
              onValueChange={(v) => majFiltre("priorite", v === "all" ? undefined : v)}
            >
              <SelectTrigger className="w-full md:w-[170px] transition-colors">
                <SelectValue placeholder="Priorité" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="all">Toutes priorités</SelectItem>
                {PRIORITES.map((p) => (
                  <SelectItem key={p} value={p}>
                    {PRIORITE_LABELS[p]}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            <Button
              type="button"
              variant={filtresOuverts ? "secondary" : "outline"}
              onClick={() => setFiltresOuverts((v) => !v)}
              className="md:w-auto"
            >
              <SlidersHorizontal className="h-4 w-4 mr-1.5" /> Filtres avancés
            </Button>
          </div>

          {filtresOuverts && (
            <div className="grid gap-3 md:grid-cols-3 mt-3 animate-in fade-in slide-in-from-top-1 duration-200">
              <Select
                value={infra ?? "all"}
                onValueChange={(v) => majFiltre("infra", v === "all" ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toutes les infrastructures" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toutes les infrastructures</SelectItem>
                  {infras.map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.code} — {i.nom}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={periode ?? "all"}
                onValueChange={(v) => majFiltre("periode", v === "all" ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Toute la période" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">Toute la période</SelectItem>
                  {(Object.keys(PERIODES) as ClePeriode[]).map((p) => (
                    <SelectItem key={p} value={p}>
                      {PERIODES[p]}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
              <Select
                value={triCourant}
                onValueChange={(v) => majFiltre("tri", v === "recentes" ? undefined : v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.keys(TRIS) as CleTri[]).map((t) => (
                    <SelectItem key={t} value={t}>
                      {TRIS[t].libelle}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          )}

          <div className="flex flex-wrap items-center gap-2 mt-3">
            <span className="text-xs text-muted-foreground">
              {isLoading
                ? "Recherche en cours…"
                : `${total} demande${total > 1 ? "s" : ""} trouvée${total > 1 ? "s" : ""}`}
              {pages > 1 && !isLoading && ` · page ${pageCourante} sur ${pages}`}
              {isFetching && !isLoading && " · actualisation…"}
            </span>
            {statut && (
              <Badge variant="outline" className={statutBadgeClass(statut)}>
                {STATUT_LABELS[statut]}
              </Badge>
            )}
            {priorite && (
              <Badge variant="outline" className={prioriteBadgeClass(priorite)}>
                {PRIORITE_LABELS[priorite]}
              </Badge>
            )}
            {infraChoisie && <Badge variant="outline">{infraChoisie.code}</Badge>}
            {periode && <Badge variant="outline">{PERIODES[periode]}</Badge>}
            {q && q.trim() && <Badge variant="outline">« {q.trim()} »</Badge>}
            {filtresActifs && (
              <Button
                variant="ghost"
                size="sm"
                onClick={reinitialiser}
                className="h-7 px-2 text-xs text-muted-foreground hover:text-foreground"
              >
                <X className="h-3 w-3 mr-1" /> Réinitialiser
              </Button>
            )}
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : lignes.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucune demande trouvée.
              {filtresActifs && (
                <>
                  {" "}
                  <button onClick={reinitialiser} className="text-primary underline">
                    Retirer les filtres
                  </button>
                </>
              )}
            </div>
          ) : (
            <>
              {/* Tableau, à partir de la largeur « medium » */}
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3">Référence</th>
                      <th className="text-left px-4 py-3">Titre</th>
                      <th className="text-left px-4 py-3">Infrastructure</th>
                      <th className="text-left px-4 py-3">Priorité</th>
                      <th className="text-left px-4 py-3">Statut</th>
                      <th className="text-left px-4 py-3">Créée le</th>
                    </tr>
                  </thead>
                  <tbody>
                    {lignes.map((d) => (
                      <tr
                        key={d.id}
                        className="border-t border-border cursor-pointer transition-colors hover:bg-accent/30 focus-within:bg-accent/30"
                        onClick={() => navigate({ to: "/demandes/$id", params: { id: d.id } })}
                      >
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {d.reference}
                        </td>
                        <td className="px-4 py-3 font-medium">{d.titre}</td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {(d as { infrastructures?: { nom: string } }).infrastructures?.nom ?? "—"}
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={prioriteBadgeClass(d.priorite)} variant="outline">
                            {PRIORITE_LABELS[d.priorite]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3">
                          <Badge className={statutBadgeClass(d.statut)} variant="outline">
                            {STATUT_LABELS[d.statut]}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted-foreground">
                          {formatDate(d.created_at)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>

              {/* Cartes, sur téléphone */}
              <div className="md:hidden divide-y divide-border">
                {lignes.map((d) => (
                  <Link
                    key={d.id}
                    to="/demandes/$id"
                    params={{ id: d.id }}
                    className="block p-4 transition-colors hover:bg-accent/30 active:bg-accent/50"
                  >
                    <div className="flex items-center justify-between gap-2 mb-1">
                      <span className="font-mono text-xs text-muted-foreground">{d.reference}</span>
                      <Badge className={statutBadgeClass(d.statut)} variant="outline">
                        {STATUT_LABELS[d.statut]}
                      </Badge>
                    </div>
                    <div className="font-medium">{d.titre}</div>
                    <div className="flex items-center gap-2 mt-2">
                      <Badge className={prioriteBadgeClass(d.priorite)} variant="outline">
                        {PRIORITE_LABELS[d.priorite]}
                      </Badge>
                      <span className="text-xs text-muted-foreground">
                        {formatDate(d.created_at)}
                      </span>
                    </div>
                  </Link>
                ))}
              </div>

              {pages > 1 && (
                <div className="flex items-center justify-between gap-3 border-t border-border px-4 py-3">
                  <span className="text-xs text-muted-foreground">
                    Demandes {(pageCourante - 1) * PAR_PAGE + 1} à{" "}
                    {Math.min(pageCourante * PAR_PAGE, total)} sur {total}
                  </span>
                  <div className="flex items-center gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pageCourante <= 1}
                      onClick={() => allerPage(pageCourante - 1)}
                    >
                      <ChevronLeft className="h-4 w-4 mr-1" /> Précédent
                    </Button>
                    <Button
                      variant="outline"
                      size="sm"
                      disabled={pageCourante >= pages}
                      onClick={() => allerPage(pageCourante + 1)}
                    >
                      Suivant <ChevronRight className="h-4 w-4 ml-1" />
                    </Button>
                  </div>
                </div>
              )}
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
