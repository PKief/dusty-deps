export type DependencyStatus = "fail" | "pass" | "skip" | "unknown";

export interface DependencyResult {
  name: string;
  version: string;
  status: DependencyStatus;
  lastPublish?: string;
  ageDays?: number;
  ageFormatted?: string;
  reason?: string;
}

export interface CheckResult {
  threshold: number;
  checked: number;
  failed: number;
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
