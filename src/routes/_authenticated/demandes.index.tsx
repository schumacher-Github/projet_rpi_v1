import { createFileRoute, Link } from "@tanstack/react-router";
import { useQuery } from "@tanstack/react-query";
import { useState } from "react";
import { Search, Plus } from "lucide-react";

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
  type Priorite,
  type Statut,
} from "@/lib/rpi-helpers";

export const Route = createFileRoute("/_authenticated/demandes/")({
  head: () => ({ meta: [{ title: "Demandes — RPI-PAD" }] }),
  component: DemandesList,
});

function DemandesList() {
  const [q, setQ] = useState("");
  const [statut, setStatut] = useState<Statut | "all">("all");
  const [priorite, setPriorite] = useState<Priorite | "all">("all");

  const { data: demandes = [], isLoading } = useQuery({
    queryKey: ["demandes-list"],
    queryFn: async () => {
      const { data, error } = await supabase
        .from("demandes")
        .select("*, infrastructures(nom, code)")
        .order("created_at", { ascending: false });
      if (error) throw error;
      return data;
    },
  });

  const filtered = demandes.filter((d) => {
    if (statut !== "all" && d.statut !== statut) return false;
    if (priorite !== "all" && d.priorite !== priorite) return false;
    if (q.trim()) {
      const t = q.toLowerCase();
      return (
        d.titre.toLowerCase().includes(t) ||
        d.reference.toLowerCase().includes(t) ||
        d.description.toLowerCase().includes(t)
      );
    }
    return true;
  });

  return (
    <div className="space-y-6 max-w-7xl">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="text-2xl md:text-3xl font-bold text-foreground">Demandes d'intervention</h1>
          <p className="text-muted-foreground mt-1">
            Suivi et gestion de toutes les demandes accessibles.
          </p>
        </div>
        <Button asChild>
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
                value={q}
                onChange={(e) => setQ(e.target.value)}
                className="pl-9"
              />
            </div>
            <Select value={statut} onValueChange={(v) => setStatut(v as Statut | "all")}>
              <SelectTrigger className="w-full md:w-[180px]">
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
            <Select value={priorite} onValueChange={(v) => setPriorite(v as Priorite | "all")}>
              <SelectTrigger className="w-full md:w-[180px]">
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
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="p-0">
          {isLoading ? (
            <div className="py-12 text-center text-sm text-muted-foreground">Chargement…</div>
          ) : filtered.length === 0 ? (
            <div className="py-12 text-center text-sm text-muted-foreground">
              Aucune demande trouvée.
            </div>
          ) : (
            <>
              {/* Desktop table */}
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
                    {filtered.map((d) => (
                      <tr
                        key={d.id}
                        className="border-t border-border hover:bg-accent/30 cursor-pointer"
                        onClick={() => (window.location.href = `/demandes/${d.id}`)}
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

              {/* Mobile cards */}
              <div className="md:hidden divide-y divide-border">
                {filtered.map((d) => (
                  <Link
                    key={d.id}
                    to="/demandes/$id"
                    params={{ id: d.id }}
                    className="block p-4 hover:bg-accent/30"
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
                      <span className="text-xs text-muted-foreground">{formatDate(d.created_at)}</span>
                    </div>
                  </Link>
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
