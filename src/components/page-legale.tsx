import { Link } from "@tanstack/react-router";
import { Anchor, ArrowLeft } from "lucide-react";
import type { ReactNode } from "react";

/**
 * Coquille commune aux pages d'information légale (confidentialité, sécurité,
 * conditions d'utilisation). Ces pages sont publiques : elles doivent rester
 * consultables sans être connecté, et n'empruntent donc rien à la mise en page
 * de l'espace authentifié.
 */

export const LIENS_LEGAUX = [
  { to: "/confidentialite", label: "Politique de confidentialité" },
  { to: "/securite", label: "Sécurité des données" },
  { to: "/conditions", label: "Conditions d'utilisation" },
] as const;

export function PageLegale({
  titre,
  sousTitre,
  maj,
  children,
}: {
  titre: string;
  sousTitre: string;
  maj: string;
  children: ReactNode;
}) {
  return (
    <div className="min-h-screen bg-background">
      <header className="text-primary-foreground" style={{ background: "var(--gradient-hero)" }}>
        <div className="mx-auto w-full max-w-3xl px-6 py-10">
          <div className="flex items-center gap-3">
            <div className="flex h-10 w-10 items-center justify-center rounded-md bg-gold">
              <Anchor className="h-6 w-6 text-gold-foreground" />
            </div>
            <div>
              <div className="text-[11px] uppercase tracking-widest opacity-80">
                Port Autonome de Douala
              </div>
              <div className="text-sm font-semibold">Régie du Patrimoine Immobilier</div>
            </div>
          </div>
          <h1 className="mt-8 text-3xl font-bold leading-tight">{titre}</h1>
          <p className="mt-2 max-w-xl text-sm opacity-90">{sousTitre}</p>
          <p className="mt-4 text-xs opacity-70">Dernière mise à jour : {maj}</p>
        </div>
      </header>

      <main className="mx-auto w-full max-w-3xl px-6 py-10">
        <article className="space-y-8 text-sm leading-relaxed text-foreground">{children}</article>

        <nav className="mt-12 flex flex-wrap items-center gap-x-6 gap-y-2 border-t border-border pt-6 text-sm">
          <Link
            to="/auth"
            className="inline-flex items-center gap-2 font-medium text-primary hover:underline"
          >
            <ArrowLeft className="h-4 w-4" />
            Retour à la connexion
          </Link>
          {LIENS_LEGAUX.map((lien) => (
            <Link
              key={lien.to}
              to={lien.to}
              className="text-muted-foreground hover:text-foreground hover:underline"
              activeProps={{ className: "text-foreground font-medium" }}
            >
              {lien.label}
            </Link>
          ))}
        </nav>

        <p className="mt-6 text-xs text-muted-foreground">
          © {new Date().getFullYear()} Régie du Patrimoine Immobilier — Port Autonome de Douala.
          Application interne RPI-PAD.
        </p>
      </main>
    </div>
  );
}

export function Section({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <section className="space-y-3">
      <h2 className="text-lg font-semibold tracking-tight text-foreground">{titre}</h2>
      <div className="space-y-3 text-muted-foreground [&_strong]:text-foreground">{children}</div>
    </section>
  );
}

export function Liste({ items }: { items: ReactNode[] }) {
  return (
    <ul className="my-3 space-y-2 pl-5">
      {items.map((item, i) => (
        <li key={i} className="list-disc text-muted-foreground marker:text-primary">
          {item}
        </li>
      ))}
    </ul>
  );
}

export function Encadre({ titre, children }: { titre: string; children: ReactNode }) {
  return (
    <div className="mt-3 rounded-md border-l-4 border-primary bg-muted/50 p-4">
      <p className="font-medium text-foreground">{titre}</p>
      <div className="mt-1 text-muted-foreground">{children}</div>
    </div>
  );
}

/** Ligne de liens discrète, destinée au pied des écrans existants. */
export function PiedLegal({ className = "" }: { className?: string }) {
  return (
    <p
      className={`flex flex-wrap items-center justify-center gap-x-5 gap-y-1 text-xs text-muted-foreground ${className}`}
    >
      {LIENS_LEGAUX.map((lien) => (
        <Link
          key={lien.to}
          to={lien.to}
          className="whitespace-nowrap hover:text-foreground hover:underline"
        >
          {lien.label}
        </Link>
      ))}
    </p>
  );
}
