/**
 * Géolocalisation des lieux d'intervention.
 *
 * La position est relevée par l'appareil de l'agent (GPS du téléphone ou
 * service de localisation du navigateur), sans service payant. Elle est
 * ensuite ouverte dans Google Maps par un simple lien, qui ne demande ni
 * clé d'API ni compte de facturation.
 */

export interface Position {
  latitude: number;
  longitude: number;
  precision_m?: number | null;
}

/** Lien qui ouvre la position exacte dans Google Maps (web ou application). */
export function lienGoogleMaps(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/search/?api=1&query=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

/** Lien d'itinéraire Google Maps jusqu'au point, depuis la position du technicien. */
export function lienItineraire(latitude: number, longitude: number): string {
  return `https://www.google.com/maps/dir/?api=1&destination=${latitude.toFixed(6)},${longitude.toFixed(6)}`;
}

/** 4.052180, 9.688640 */
export function formatDecimal(latitude: number, longitude: number): string {
  return `${latitude.toFixed(6)}, ${longitude.toFixed(6)}`;
}

/** 4°03'07.8"N 9°41'19.1"E, la notation lue sur les cartes et les GPS. */
export function formatDms(latitude: number, longitude: number): string {
  const conv = (v: number, pos: string, neg: string) => {
    const a = Math.abs(v);
    const d = Math.floor(a);
    const mFull = (a - d) * 60;
    const m = Math.floor(mFull);
    const s = (mFull - m) * 60;
    return `${d}°${String(m).padStart(2, "0")}'${s.toFixed(1).padStart(4, "0")}"${v >= 0 ? pos : neg}`;
  };
  return `${conv(latitude, "N", "S")} ${conv(longitude, "E", "O")}`;
}

/** Position enregistrée d'une demande, ou à défaut celle de son infrastructure. */
export function positionDeReference(
  demande: { latitude?: number | null; longitude?: number | null; precision_m?: number | null },
  infra?: { latitude?: number | null; longitude?: number | null } | null,
): (Position & { source: "demande" | "infrastructure" }) | null {
  if (demande.latitude != null && demande.longitude != null) {
    return {
      latitude: Number(demande.latitude),
      longitude: Number(demande.longitude),
      precision_m: demande.precision_m != null ? Number(demande.precision_m) : null,
      source: "demande",
    };
  }
  if (infra?.latitude != null && infra?.longitude != null) {
    return { latitude: Number(infra.latitude), longitude: Number(infra.longitude), source: "infrastructure" };
  }
  return null;
}

/** Demande la position actuelle à l'appareil, en haute précision. */
export function obtenirPositionActuelle(): Promise<Position> {
  return new Promise((resolve, reject) => {
    if (typeof navigator === "undefined" || !navigator.geolocation) {
      reject(new Error("La géolocalisation n'est pas disponible sur cet appareil."));
      return;
    }
    navigator.geolocation.getCurrentPosition(
      (p) =>
        resolve({
          latitude: Number(p.coords.latitude.toFixed(6)),
          longitude: Number(p.coords.longitude.toFixed(6)),
          precision_m: Math.round(p.coords.accuracy * 10) / 10,
        }),
      (err) => {
        const messages: Record<number, string> = {
          1: "Autorisez l'accès à votre position dans le navigateur pour localiser l'intervention.",
          2: "Position introuvable. Réessayez à l'extérieur ou saisissez les coordonnées.",
          3: "La localisation a pris trop de temps. Réessayez.",
        };
        reject(new Error(messages[err.code] ?? "Impossible d'obtenir la position."));
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 },
    );
  });
}
