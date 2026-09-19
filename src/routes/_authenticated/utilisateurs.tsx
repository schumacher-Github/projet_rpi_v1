import { createFileRoute, Navigate } from "@tanstack/react-router";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { Loader2, Users as UsersIcon } from "lucide-react";
import { toast } from "sonner";

import { supabase } from "@/integrations/supabase/client";
import { useAuth, ROLE_LABELS, type AppRole } from "@/hooks/use-auth";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";

export const Route = createFileRoute("/_authenticated/utilisateurs")({
  head: () => ({ meta: [{ title: "Utilisateurs — RPI-PAD" }] }),
  component: UtilisateursPage,
});

const ROLES: AppRole[] = ["demandeur", "technicien", "chef_service", "admin"];

function UtilisateursPage() {
  const { hasRole, loading: authLoading, user } = useAuth();
  const qc = useQueryClient();

  const { data, isLoading } = useQuery({
    queryKey: ["users-admin"],
    queryFn: async () => {
      const [{ data: profiles, error: e1 }, { data: roles, error: e2 }] = await Promise.all([
        supabase.from("profiles").select("*").order("created_at", { ascending: false }),
        supabase.from("user_roles").select("user_id, role"),
      ]);
      if (e1) throw e1;
      if (e2) throw e2;
      const rolesByUser = new Map<string, AppRole[]>();
      (roles ?? []).forEach((r) => {
        const arr = rolesByUser.get(r.user_id) ?? [];
        arr.push(r.role as AppRole);
        rolesByUser.set(r.user_id, arr);
      });
      return (profiles ?? []).map((p) => ({ ...p, roles: rolesByUser.get(p.id) ?? [] }));
    },
    enabled: hasRole("admin"),
  });

  const setRoleMut = useMutation({
    mutationFn: async ({ userId, role }: { userId: string; role: AppRole }) => {
      // Single-role model: delete existing then insert new
      const { error: delErr } = await supabase.from("user_roles").delete().eq("user_id", userId);
      if (delErr) throw delErr;
      const { error: insErr } = await supabase.from("user_roles").insert({ user_id: userId, role });
      if (insErr) throw insErr;
    },
    onSuccess: () => {
      toast.success("Rôle mis à jour");
      qc.invalidateQueries({ queryKey: ["users-admin"] });
    },
    onError: (e: Error) => toast.error(e.message),
  });

  if (authLoading) return null;
  if (!hasRole("admin")) return <Navigate to="/dashboard" replace />;

  return (
    <div className="max-w-6xl space-y-6">
      <div>
        <h1 className="text-2xl md:text-3xl font-bold">Gestion des utilisateurs</h1>
        <p className="text-muted-foreground mt-1">
          Attribuez à chaque agent son rôle dans la plateforme.
        </p>
      </div>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <UsersIcon className="h-5 w-5 text-primary" />
            Agents enregistrés
          </CardTitle>
        </CardHeader>
        <CardContent className="p-0">
          {isLoading ? (
             <div className="py-12 text-center text-muted-foreground">
              <Loader2 className="h-5 w-5 animate-spin inline mr-2" /> Chargement…
            </div>
          ) : (
            <>
              <div className="hidden md:block overflow-x-auto">
                <table className="w-full text-sm">
                  <thead className="bg-muted/40 text-xs uppercase tracking-wider text-muted-foreground">
                    <tr>
                      <th className="text-left px-4 py-3">Nom complet</th>
                      <th className="text-left px-4 py-3">Email</th>
                      <th className="text-left px-4 py-3 hidden lg:table-cell">Service</th>
                      <th className="text-left px-4 py-3">Rôle</th>
                    </tr>
                  </thead>
                  <tbody>
                    {(data ?? []).map((u) => (
                      <UserRow
                        key={u.id}
                        user={u}
                        currentUserId={user?.id}
                        onRoleChange={(role) => setRoleMut.mutate({ userId: u.id, role })}
                      />
                    ))}
                  </tbody>
                </table>
              </div>

              <div className="md:hidden divide-y divide-border">
                {(data ?? []).map((u) => (
                  <UserCard
                    key={u.id}
                    user={u}
                    currentUserId={user?.id}
                    onRoleChange={(role) => setRoleMut.mutate({ userId: u.id, role })}
                  />
                ))}
              </div>
            </>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

type AdminUser = {
  id: string;
  prenom: string;
  nom: string;
  email: string;
  service: string | null;
  roles: AppRole[];
};

function RoleSelect({
  current,
  disabled,
  onRoleChange,
}: {
  current: AppRole;
  disabled: boolean;
  onRoleChange: (role: AppRole) => void;
}) {
  return (
    <Select value={current} onValueChange={(v) => onRoleChange(v as AppRole)} disabled={disabled}>
      <SelectTrigger className="w-full sm:w-[180px]">
        <SelectValue />
      </SelectTrigger>
      <SelectContent>
        {ROLES.map((r) => (
          <SelectItem key={r} value={r}>
            {ROLE_LABELS[r]}
          </SelectItem>
        ))}
      </SelectContent>
    </Select>
  );
}

function UserRow({
  user,
  currentUserId,
  onRoleChange,
}: {
  user: AdminUser;
  currentUserId?: string;
  onRoleChange: (role: AppRole) => void;
}) {
  const current = user.roles[0] ?? "demandeur";
  const isSelf = user.id === currentUserId;

  return (
    <tr className="border-t border-border">
      <td className="px-4 py-3 font-medium">
        {user.prenom} {user.nom}
        {isSelf && (
          <Badge variant="outline" className="ml-2 text-[10px]">
            Vous
          </Badge>
        )}
      </td>
      <td className="px-4 py-3 text-muted-foreground">{user.email}</td>
      <td className="px-4 py-3 text-muted-foreground hidden lg:table-cell">{user.service ?? "—"}</td>
      <td className="px-4 py-3">
        <RoleSelect current={current} disabled={isSelf} onRoleChange={onRoleChange} />
      </td>
    </tr>
  );
}

function UserCard({
  user,
  currentUserId,
  onRoleChange,
}: {
  user: AdminUser;
  currentUserId?: string;
  onRoleChange: (role: AppRole) => void;
}) {
  const current = user.roles[0] ?? "demandeur";
  const isSelf = user.id === currentUserId;

  return (
    <div className="p-4 space-y-3">
      <div>
        <div className="font-medium">
          {user.prenom} {user.nom}
          {isSelf && (
            <Badge variant="outline" className="ml-2 text-[10px]">
              Vous
            </Badge>
          )}
        </div>
        <div className="text-sm text-muted-foreground mt-1">{user.email}</div>
        {user.service && <div className="text-xs text-muted-foreground mt-0.5">{user.service}</div>}
      </div>
      <RoleSelect current={current} disabled={isSelf} onRoleChange={onRoleChange} />
    </div>
  );
}
