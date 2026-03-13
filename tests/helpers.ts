import { mkdtempSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, beforeEach } from "vitest";

let _tempDir: string;

export function useTempDir(): { get dir(): string } {
  beforeEach(() => {
    _tempDir = mkdtempSync(join(tmpdir(), "dusty-deps-test-"));
  });

  afterEach(() => {
    rmSync(_tempDir, { recursive: true, force: true });
  });

  return {
    get dir() {
      return _tempDir;
    },
  };
}
