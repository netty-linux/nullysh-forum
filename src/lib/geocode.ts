/**
 * Busca de locais reais via OpenStreetMap Nominatim (somente leitura).
 * Uso leve no MVP — debounce no client e limite de resultados.
 */

export type PlaceSuggestion = {
  id: string;
  label: string;
  secondary?: string;
  lat: string;
  lon: string;
};

type NominatimItem = {
  place_id: number;
  display_name: string;
  lat: string;
  lon: string;
  name?: string;
  address?: {
    city?: string;
    town?: string;
    village?: string;
    municipality?: string;
    state?: string;
    country?: string;
    suburb?: string;
    neighbourhood?: string;
    road?: string;
  };
};

function formatPlace(item: NominatimItem): PlaceSuggestion {
  const a = item.address ?? {};
  const city =
    a.city || a.town || a.village || a.municipality || a.suburb || "";
  const state = a.state || "";
  const country = a.country || "";
  const road = a.road || a.neighbourhood || "";

  const primary =
    item.name ||
    road ||
    city ||
    item.display_name.split(",")[0]?.trim() ||
    "Local";

  const parts = [city, state, country].filter(
    (p, i, arr) => p && arr.indexOf(p) === i && p !== primary
  );
  const secondary = parts.join(", ") || undefined;

  // Label compacto e legível no post
  const labelBits = [primary];
  if (city && city !== primary) labelBits.push(city);
  else if (state && state !== primary) labelBits.push(state);
  if (country && !labelBits.includes(country)) labelBits.push(country);

  return {
    id: String(item.place_id),
    label: labelBits.slice(0, 3).join(", "),
    secondary: secondary && secondary !== labelBits.slice(1).join(", ")
      ? item.display_name
      : secondary,
    lat: item.lat,
    lon: item.lon,
  };
}

export async function searchPlaces(
  query: string,
  signal?: AbortSignal
): Promise<PlaceSuggestion[]> {
  const q = query.trim();
  if (q.length < 2) return [];

  const url = new URL("https://nominatim.openstreetmap.org/search");
  url.searchParams.set("format", "json");
  url.searchParams.set("q", q);
  url.searchParams.set("limit", "6");
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "pt-BR");

  const res = await fetch(url.toString(), {
    signal,
    headers: {
      Accept: "application/json",
    },
  });

  if (!res.ok) {
    throw new Error("Não foi possível buscar locais agora.");
  }

  const data = (await res.json()) as NominatimItem[];
  return data.map(formatPlace);
}

export async function reverseGeocode(
  lat: number,
  lon: number,
  signal?: AbortSignal
): Promise<PlaceSuggestion | null> {
  const url = new URL("https://nominatim.openstreetmap.org/reverse");
  url.searchParams.set("format", "json");
  url.searchParams.set("lat", String(lat));
  url.searchParams.set("lon", String(lon));
  url.searchParams.set("addressdetails", "1");
  url.searchParams.set("accept-language", "pt-BR");
  url.searchParams.set("zoom", "14");

  const res = await fetch(url.toString(), {
    signal,
    headers: { Accept: "application/json" },
  });

  if (!res.ok) {
    throw new Error("Não foi possível obter sua localização.");
  }

  const data = (await res.json()) as NominatimItem & { error?: string };
  if (data.error) return null;
  return formatPlace(data);
}
