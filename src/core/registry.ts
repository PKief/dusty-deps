const NPM_REGISTRY_URL = "https://registry.npmjs.org";
const REQUEST_TIMEOUT_MS = 15_000;

export async function getLastPublishDate(pkgName: string): Promise<Date | null> {
  const url = `${NPM_REGISTRY_URL}/${encodePackageName(pkgName)}`;
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);

  try {
    const response = await fetch(url, {
      headers: { Accept: "application/json" },
      signal: controller.signal,
    });

    if (!response.ok) {
      return null;
    }

    const data = (await response.json()) as { time?: Record<string, string> };
    if (!data.time) {
      return null;
    }

    return findLatestPublishDate(data.time);
  } catch {
    return null;
  } finally {
    clearTimeout(timeoutId);
  }
}

function findLatestPublishDate(timeData: Record<string, string>): Date | null {
  let latest: Date | null = null;
  for (const [key, timestamp] of Object.entries(timeData)) {
    if (key === "created" || key === "modified") continue;
    const date = new Date(timestamp);
    if (!latest || date > latest) {
      latest = date;
    }
  }
  return latest;
}

function encodePackageName(name: string): string {
  if (name.startsWith("@")) {
    return `@${encodeURIComponent(name.slice(1))}`;
  }
  return encodeURIComponent(name);
}
