import { Link, useNavigate } from "@tanstack/react-router";
import { LogOut, Monitor, Moon, Settings, Sun, User as UserIcon } from "lucide-react";
import { toast } from "sonner";

import { useAuth, ROLE_LABELS } from "@/hooks/use-auth";
import { useTheme, THEME_LABELS, type Theme } from "@/hooks/use-theme";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuSub,
  DropdownMenuSubContent,
  DropdownMenuSubTrigger,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";

const ICONES_THEME: Record<Theme, typeof Sun> = {
  clair: Sun,
  sombre: Moon,
  systeme: Monitor,
};

export function UserMenu() {
  const { profile, roles, signOut } = useAuth();
  const { theme, setTheme } = useTheme();
  const navigate = useNavigate();

  if (!profile) return null;
  const initials = `${profile.prenom?.[0] ?? ""}${profile.nom?.[0] ?? ""}`.toUpperCase();
  const role = roles[0];

  const onSignOut = async () => {
    await signOut();
    toast.success("Déconnecté");
    navigate({ to: "/auth", replace: true });
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" className="gap-2 h-9 px-2">
          <Avatar className="h-7 w-7">
            <AvatarFallback className="bg-primary text-primary-foreground text-xs">
              {initials || <UserIcon className="h-4 w-4" />}
            </AvatarFallback>
          </Avatar>
          <div className="hidden sm:flex flex-col items-start leading-tight">
            <span className="text-sm font-medium">
              {profile.prenom} {profile.nom}
            </span>
            <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
              {role ? ROLE_LABELS[role] : "—"}
            </span>
          </div>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>
          <div className="text-sm font-medium">{profile.prenom} {profile.nom}</div>
          <div className="text-xs text-muted-foreground font-normal">{profile.email}</div>
        </DropdownMenuLabel>
        <DropdownMenuSeparator />

        <DropdownMenuItem asChild>
          <Link to="/parametres" className="cursor-pointer">
            <Settings className="h-4 w-4 mr-2" />
            Mon espace de travail
          </Link>
        </DropdownMenuItem>

        <DropdownMenuSub>
          <DropdownMenuSubTrigger>
            {(() => {
              const Icone = ICONES_THEME[theme];
              return <Icone className="h-4 w-4 mr-2" />;
            })()}
            Apparence
          </DropdownMenuSubTrigger>
          <DropdownMenuSubContent>
            {(Object.keys(THEME_LABELS) as Theme[]).map((valeur) => {
              const Icone = ICONES_THEME[valeur];
              return (
                <DropdownMenuItem
                  key={valeur}
                  onClick={() => setTheme(valeur)}
                  className={theme === valeur ? "bg-accent" : undefined}
                >
                  <Icone className="h-4 w-4 mr-2" />
                  {THEME_LABELS[valeur]}
                </DropdownMenuItem>
              );
            })}
          </DropdownMenuSubContent>
        </DropdownMenuSub>

        <DropdownMenuSeparator />
        <DropdownMenuItem onClick={onSignOut} className="text-destructive focus:text-destructive">
          <LogOut className="h-4 w-4 mr-2" />
          Se déconnecter
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
