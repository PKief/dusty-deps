import { execSync } from "node:child_process";

export function getLastPublishDate(pkgName: string): Date | null {
  try {
    const output = execSync(`npm view ${pkgName} time --json`, {
      encoding: "utf8",
      stdio: ["pipe", "pipe", "pipe"],
      timeout: 30_000,
    });
    const timeData = JSON.parse(output) as Record<string, string>;
    let latest: Date | null = null;
    for (const [key, timestamp] of Object.entries(timeData)) {
      if (key === "created" || key === "modified") continue;
      const date = new Date(timestamp);
      if (!latest || date > latest) {
        latest = date;
      }
    }
    return latest;
  } catch {
    return null;
  }
}
