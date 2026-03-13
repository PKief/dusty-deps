export type DependencyStatus = "fail" | "pass" | "skip" | "unknown";

export type DependencyResult =
  | {
      name: string;
      version: string;
      status: "fail" | "pass";
      lastPublish: string;
      ageDays: number;
      ageFormatted: string;
    }
  | {
      name: string;
      version: string;
      status: "skip";
      reason: string;
    }
  | {
      name: string;
      version: string;
      status: "unknown";
      error?: string;
    };

export interface CheckResult {
  threshold: number;
  checked: number;
  counts: Record<DependencyStatus, number>;
  results: DependencyResult[];
}

export interface DustyDepsConfig {
  threshold?: number;
  allowlist?: Record<string, string>;
}

export interface CheckOptions {
  cwd?: string;
  threshold?: number;
  allowlist?: Record<string, string>;
  concurrency?: number;
  onProgress?: (completed: number, total: number, name: string) => void;
}
