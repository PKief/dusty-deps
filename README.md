# dusty-deps

Check the age of your npm production dependencies and flag stale packages.

`npm outdated` tells you if a newer version exists — but it won't tell you that the "latest" version was published 5 years ago. **dusty-deps** checks when each dependency last published a release and flags those exceeding a configurable age threshold.

## Install

```bash
# as a project devDependency
npm install --save-dev dusty-deps

# or globally
npm install -g dusty-deps
```

Requires Node.js >= 22.

## CLI Usage

```bash
# check the current project (default threshold: 3 years)
dusty-deps

# custom threshold (in days)
dusty-deps --threshold 730

# JSON output for CI pipelines
dusty-deps --json

# check a different project
dusty-deps --cwd /path/to/project
```

### Options

| Option | Description |
|---|---|
| `--threshold <days>` | Age threshold in days (default: `1095` / 3 years) |
| `--json` | Output results as JSON |
| `--cwd <path>` | Directory containing `package.json` (default: `.`) |
| `--help`, `-h` | Show help |
| `--version`, `-v` | Show version |

### Exit Codes

| Code | Meaning |
|---|---|
| `0` | All dependencies pass |
| `1` | One or more dependencies exceed the threshold |
| `2` | Invalid arguments or configuration error |

### Example Output

```
Checking 49 production dependencies (threshold: 1095 days / 3.0 years)...

  [FAIL] path@0.12.7 — last release: 2015-09-13 (10.5 years ago)
  [FAIL] concat-stream@2.0.0 — last release: 2018-12-21 (7.2 years ago)
  [PASS] express@4.22.1 — last release: 2025-12-01 (3.3 months ago)
  [SKIP] lodash@4.17.23 — allowlisted: "Stable utility library"
  [WARN] @sap/cds@8.7.2 — could not fetch publish dates

Summary: 40 passed, 2 failed, 1 allowlisted, 6 unknown

2 dependency(s) exceed the 3.0 years threshold.
Add them to your dusty-deps config allowlist with a reason, or update them.
```

## Programmatic API

```ts
import { check } from "dusty-deps";

const result = await check({
  cwd: "/path/to/project",
  threshold: 1095,
  allowlist: { lodash: "Stable utility library" },
  concurrency: 5,
});

console.log(result.failed); // number of stale dependencies
for (const dep of result.results) {
  console.log(dep.name, dep.status, dep.ageDays);
}
```

### `check(options?): Promise<CheckResult>`

| Option | Type | Default | Description |
|---|---|---|---|
| `cwd` | `string` | `process.cwd()` | Directory containing `package.json` |
| `threshold` | `number` | `1095` | Age threshold in days |
| `allowlist` | `Record<string, string>` | `{}` | Package name to reason mapping (merged with config file) |
| `concurrency` | `number` | `5` | Max concurrent registry requests |

### Return Type: `CheckResult`

```ts
interface CheckResult {
  threshold: number;          // threshold that was applied
  checked: number;            // total dependencies checked
  failed: number;             // count exceeding threshold
  results: DependencyResult[];
}

interface DependencyResult {
  name: string;               // package name
  version: string;            // version from package.json
  status: "fail" | "pass" | "skip" | "unknown";
  lastPublish?: string;       // ISO date (fail/pass only)
  ageDays?: number;           // days since last publish (fail/pass only)
  ageFormatted?: string;      // human-readable age (fail/pass only)
  reason?: string;            // allowlist reason (skip only)
}
```

## Configuration

Create a config file in your project root to set a threshold and maintain an allowlist of intentionally old dependencies.

### `dusty-deps.config.json`

```json
{
  "threshold": 1095,
  "allowlist": {
    "lodash": "Stable utility library with infrequent but intentional releases",
    "path": "Node.js built-in polyfill, no updates expected"
  }
}
```

### Config File Locations

Checked in order (first found wins):

1. `dusty-deps.config.json`
2. `dusty-deps.config.mjs`
3. `.dusty-depsrc.json`
4. `"dusty-deps"` key in `package.json`

### Using `package.json`

```json
{
  "dusty-deps": {
    "threshold": 730,
    "allowlist": {
      "lodash": "Stable utility library"
    }
  }
}
```

### Using `dusty-deps.config.mjs`

```js
export default {
  threshold: 1095,
  allowlist: {
    lodash: "Stable utility library",
  },
};
```

## How It Works

1. Reads `dependencies` from `package.json` (skips `devDependencies`)
2. Loads the config file (threshold + allowlist)
3. For each dependency, runs `npm view <pkg> time --json` to get all version timestamps
4. Finds the most recent publish date and calculates the age
5. Flags dependencies exceeding the threshold

Because it uses `npm view` under the hood, it automatically respects your `.npmrc` registry configuration and works with private registries. Packages that can't be resolved (e.g., private registry packages without public npm fallback) are reported as `[WARN] unknown`.

## License

MIT
