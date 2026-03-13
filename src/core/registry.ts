const NPM_REGISTRY_URL = "https://registry.npmjs.org";
const REQUEST_TIMEOUT_MS = 15_000;

export interface RegistryResult {
  date: Date | null;
  error?: string;
}

export async function getLastPublishDate(pkgName: string): Promise<RegistryResult> {
  const url = `${NPM_REGISTRY_URL}/${encodePackageName(pkgName)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return { date: null, error: `registry returned ${response.status}` };
    }

    const data = (await response.json()) as { time?: Record<string, string> };
    if (!data.time) {
      return { date: null, error: "no time data in registry response" };
    }

    return { date: findLatestPublishDate(data.time) };
  } catch (error) {
    const message =
      error instanceof Error
        ? error.name === "AbortError"
          ? "request timed out"
          : error.message
        : String(error);
    return { date: null, error: message };
  } finally {
    clearTimeout(timeoutId);
  }
}

function findLatestPublishDate(timeData: Record<string, string>): Date | null {
  let latest: Date | null = null;
  for (const [key, timestamp] of Object.entries(timeData)) {
    if (key === "created" || key === "modified") continue;
    const date = new Date(timestamp);
    if (Number.isNaN(date.getTime())) continue;
    if (!latest || date > latest) {
      latest = date;
    }
  }
  return latest;
}

// Scoped packages like @scope/pkg need the slash encoded for the registry URL.
// encodeURIComponent also prevents path traversal from malicious package names.
function encodePackageName(name: string): string {
  if (name.startsWith("@")) {
    return `@${encodeURIComponent(name.slice(1))}`;
  }
  return encodeURIComponent(name);
}
