import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from "react";

export type Theme = "clair" | "sombre" | "systeme";

const STORAGE_KEY = "rpi-pad-theme";

interface ThemeContextValue {
  /** Préférence choisie par l'agent. */
  theme: Theme;
  /** Thème réellement appliqué, une fois « systeme » résolu. */
  resolved: "clair" | "sombre";
  setTheme: (t: Theme) => void;
}

const ThemeContext = createContext<ThemeContextValue | undefined>(undefined);

function prefereSombre() {
  if (typeof window === "undefined") return false;
  return window.matchMedia?.("(prefers-color-scheme: dark)").matches ?? false;
}

function appliquer(theme: Theme) {
  if (typeof document === "undefined") return "clair" as const;
  const sombre = theme === "sombre" || (theme === "systeme" && prefereSombre());
  document.documentElement.classList.toggle("dark", sombre);
  document.documentElement.style.colorScheme = sombre ? "dark" : "light";
  return sombre ? ("sombre" as const) : ("clair" as const);
}

/**
 * Préférence d'affichage de l'agent. Elle est conservée dans le
 * navigateur : elle relève du confort de travail sur un poste donné et
 * n'a pas à être partagée entre les postes ni stockée en base.
 *
 * Le thème n'est appliqué qu'après le montage côté client, afin de ne
 * pas introduire d'écart entre le rendu serveur et le rendu navigateur.
 */
export function ThemeProvider({ children }: { children: ReactNode }) {
  const [theme, setThemeState] = useState<Theme>("systeme");
  const [resolved, setResolved] = useState<"clair" | "sombre">("clair");

  useEffect(() => {
    let initial: Theme = "systeme";
    try {
      const stocke = localStorage.getItem(STORAGE_KEY) as Theme | null;
      if (stocke === "clair" || stocke === "sombre" || stocke === "systeme") {
        initial = stocke;
      }
    } catch {
      // Navigation privée ou stockage bloqué : on garde la valeur par défaut.
    }
    setThemeState(initial);
    setResolved(appliquer(initial));
  }, []);

  // Suivi des changements de préférence du système d'exploitation.
  useEffect(() => {
    if (theme !== "systeme" || typeof window === "undefined") return;
    const media = window.matchMedia("(prefers-color-scheme: dark)");
    const onChange = () => setResolved(appliquer("systeme"));
    media.addEventListener("change", onChange);
    return () => media.removeEventListener("change", onChange);
  }, [theme]);

  const setTheme = useCallback((t: Theme) => {
    setThemeState(t);
    setResolved(appliquer(t));
    try {
      localStorage.setItem(STORAGE_KEY, t);
    } catch {
      // Sans stockage, la préférence vaut pour la session en cours.
    }
  }, []);

  return (
    <ThemeContext.Provider value={{ theme, resolved, setTheme }}>
      {children}
    </ThemeContext.Provider>
  );
}

export function useTheme() {
  const ctx = useContext(ThemeContext);
  if (!ctx) throw new Error("useTheme doit être utilisé dans ThemeProvider");
  return ctx;
}

export const THEME_LABELS: Record<Theme, string> = {
  clair: "Clair",
  sombre: "Sombre",
  systeme: "Automatique",
};
