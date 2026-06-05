import { formatLocalDate } from "../utils";

// Dictionary of major Russian/CIS cities and their coordinates
const CITY_COORDINATES: Record<string, { lat: number; lon: number }> = {
  moscow: { lat: 55.7558, lon: 37.6173 },
  moskva: { lat: 55.7558, lon: 37.6173 },
  spb: { lat: 59.9343, lon: 30.3351 },
  piter: { lat: 59.9343, lon: 30.3351 },
  saint_petersburg: { lat: 59.9343, lon: 30.3351 },
  sankt_peterburg: { lat: 59.9343, lon: 30.3351 },
  novosibirsk: { lat: 55.0084, lon: 82.9357 },
  ekaterinburg: { lat: 56.8389, lon: 60.6057 },
  nizhny_novgorod: { lat: 56.3269, lon: 44.0059 },
  kazan: { lat: 55.8304, lon: 49.0661 },
  chelyabinsk: { lat: 55.1644, lon: 61.4368 },
  samara: { lat: 53.2001, lon: 50.15 },
  omsk: { lat: 54.9885, lon: 73.324 },
  rostov: { lat: 47.2357, lon: 39.7015 },
  ufa: { lat: 54.7431, lon: 55.9678 },
  krasnoyarsk: { lat: 56.0153, lon: 92.8932 },
  perm: { lat: 58.0105, lon: 56.2502 },
  voronezh: { lat: 51.672, lon: 39.1843 },
  volgograd: { lat: 48.708, lon: 44.5133 },
  krasnodar: { lat: 45.0355, lon: 38.9753 },
  saratov: { lat: 51.5462, lon: 46.0154 },
  tyumen: { lat: 57.1522, lon: 65.5272 },
  tolyatti: { lat: 53.5078, lon: 49.4204 },
  izhevsk: { lat: 56.8498, lon: 53.2045 },
  barnaul: { lat: 53.3498, lon: 83.7836 },
  irkutsk: { lat: 52.287, lon: 104.305 },
  khabarovsk: { lat: 48.4726, lon: 135.0577 },
  vladivostok: { lat: 43.1198, lon: 131.8869 },
  yaroslavl: { lat: 57.6261, lon: 39.8845 },
  makhachkala: { lat: 42.9849, lon: 47.5046 },
  tomsk: { lat: 56.501, lon: 84.9924 },
  minsk: { lat: 53.9006, lon: 27.559 },
  almaty: { lat: 43.2389, lon: 76.8897 },
  astana: { lat: 51.1693, lon: 71.449 },
  tashkent: { lat: 41.2995, lon: 69.2401 },
};

/**
 * Extracts coordinates from a club address or city name.
 * Fallbacks to Moscow if not recognized.
 */
export function getCoordinatesFromAddress(address: string | null): { lat: number; lon: number } {
  if (!address) return CITY_COORDINATES.moscow;

  const sanitized = address.toLowerCase().replace(/[^a-zа-яё0-9\s-]/g, " ");
  
  // Russian transliteration dictionary search
  for (const [key, coords] of Object.entries(CITY_COORDINATES)) {
    // Check English/translit names
    if (sanitized.includes(key.replace("_", " "))) {
      return coords;
    }
  }

  // Russian cyrillic searches
  if (sanitized.includes("москва")) return CITY_COORDINATES.moscow;
  if (sanitized.includes("питер") || sanitized.includes("санкт") || sanitized.includes("ленинград")) return CITY_COORDINATES.spb;
  if (sanitized.includes("новосибирск")) return CITY_COORDINATES.novosibirsk;
  if (sanitized.includes("екатеринбург")) return CITY_COORDINATES.ekaterinburg;
  if (sanitized.includes("нижн")) return CITY_COORDINATES.nizhny_novgorod;
  if (sanitized.includes("казан")) return CITY_COORDINATES.kazan;
  if (sanitized.includes("челяб")) return CITY_COORDINATES.chelyabinsk;
  if (sanitized.includes("самар")) return CITY_COORDINATES.samara;
  if (sanitized.includes("омск")) return CITY_COORDINATES.omsk;
  if (sanitized.includes("ростов")) return CITY_COORDINATES.rostov;
  if (sanitized.includes("уфа")) return CITY_COORDINATES.ufa;
  if (sanitized.includes("краснояр")) return CITY_COORDINATES.krasnoyarsk;
  if (sanitized.includes("перм")) return CITY_COORDINATES.perm;
  if (sanitized.includes("воронеж")) return CITY_COORDINATES.voronezh;
  if (sanitized.includes("волгоград")) return CITY_COORDINATES.volgograd;
  if (sanitized.includes("краснодар")) return CITY_COORDINATES.krasnodar;
  if (sanitized.includes("саратов")) return CITY_COORDINATES.saratov;
  if (sanitized.includes("тюмен")) return CITY_COORDINATES.tyumen;
  if (sanitized.includes("тольят")) return CITY_COORDINATES.tolyatti;
  if (sanitized.includes("ижевск")) return CITY_COORDINATES.izhevsk;
  if (sanitized.includes("барнаул")) return CITY_COORDINATES.barnaul;
  if (sanitized.includes("иркутск")) return CITY_COORDINATES.irkutsk;
  if (sanitized.includes("хабаровск")) return CITY_COORDINATES.khabarovsk;
  if (sanitized.includes("владивосток")) return CITY_COORDINATES.vladivostok;
  if (sanitized.includes("ярослав")) return CITY_COORDINATES.yaroslavl;
  if (sanitized.includes("махачкал")) return CITY_COORDINATES.makhachkala;
  if (sanitized.includes("томск")) return CITY_COORDINATES.tomsk;
  if (sanitized.includes("минск")) return CITY_COORDINATES.minsk;
  if (sanitized.includes("алмат")) return CITY_COORDINATES.almaty;
  if (sanitized.includes("астан")) return CITY_COORDINATES.astana;
  if (sanitized.includes("ташкент")) return CITY_COORDINATES.tashkent;

  return CITY_COORDINATES.moscow; // Fallback to Moscow
}

export interface DailyWeather {
  date: string;
  tempMean: number;
  precipitation: number;
}

/**
 * Fetches historical daily weather + forecast from Open-Meteo API.
 * Date format: YYYY-MM-DD
 */
export async function getHistoricalWeather(
  lat: number,
  lon: number,
  startDateStr: string,
  endDateStr: string
): Promise<Record<string, DailyWeather>> {
  const result: Record<string, DailyWeather> = {};

  try {
    const start = new Date(startDateStr);
    const end = new Date(endDateStr);
    const today = new Date();
    today.setHours(0, 0, 0, 0);

    // Helper to request weather from the archive API (for past dates)
    const fetchArchive = async (sDate: string, eDate: string) => {
      const url = `https://archive-api.open-meteo.com/v1/archive?latitude=${lat}&longitude=${lon}&start_date=${sDate}&end_date=${eDate}&daily=temperature_2m_mean,precipitation_sum&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo Archive API failed: ${res.status}`);
      const data = await res.json();
      return data.daily;
    };

    // Helper to request weather from the forecast API (for recent past, current and future dates)
    const fetchForecast = async (sDate: string, eDate: string) => {
      const url = `https://api.open-meteo.com/v1/forecast?latitude=${lat}&longitude=${lon}&start_date=${sDate}&end_date=${eDate}&daily=temperature_2m_mean,precipitation_sum&timezone=auto`;
      const res = await fetch(url);
      if (!res.ok) throw new Error(`Open-Meteo Forecast API failed: ${res.status}`);
      const data = await res.json();
      return data.daily;
    };

    // Determine segments to query
    const archiveEndLimit = new Date();
    archiveEndLimit.setDate(archiveEndLimit.getDate() - 3); // Archive works up to 3 days ago

    const promises: Promise<any>[] = [];

    // Segment 1: Archive (Older than 3 days ago)
    if (start < archiveEndLimit) {
      const segmentEnd = end < archiveEndLimit ? end : archiveEndLimit;
      promises.push(
        fetchArchive(formatLocalDate(start), formatLocalDate(segmentEnd)).then(daily => ({ daily, type: "archive" }))
      );
    }

    // Segment 2: Forecast (From 2 days ago up to end date)
    const forecastStart = start > archiveEndLimit ? start : new Date(archiveEndLimit.getTime() + 24 * 60 * 60 * 1000);
    if (forecastStart <= end) {
      promises.push(
        fetchForecast(formatLocalDate(forecastStart), formatLocalDate(end)).then(daily => ({ daily, type: "forecast" }))
      );
    }

    const segments = await Promise.all(promises);

    for (const segment of segments) {
      const daily = segment.daily;
      if (!daily || !daily.time) continue;

      for (let i = 0; i < daily.time.length; i++) {
        const dateStr = daily.time[i];
        const temp = daily.temperature_2m_mean?.[i] ?? 15.0; // Fallback to mild 15C
        const prec = daily.precipitation_sum?.[i] ?? 0.0;

        result[dateStr] = {
          date: dateStr,
          tempMean: Number(temp.toFixed(1)),
          precipitation: Number(prec.toFixed(1)),
        };
      }
    }
  } catch (error) {
    console.error("Error fetching weather from Open-Meteo:", error);
    // Return empty fallback dictionary instead of crashing
  }

  return result;
}
