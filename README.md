# Svelte Doctor

Let coding agents diagnose and fix your Svelte code.

One command scans your codebase for security, performance, correctness, and architecture issues, then outputs a **0–100 score** with actionable diagnostics.

### [See it in action →](https://svelte.doctor)

## Install

Run this at your project root:

```bash
npx -y svelte-doctor@latest .
```

Use `--verbose` to see affected files and line numbers:

```bash
npx -y svelte-doctor@latest . --verbose
```

## Options

```
Usage: svelte-doctor [directory] [options]

Options:
  -v, --version     display the version number
  --no-lint         skip linting
  --no-dead-code    skip dead code detection
  --verbose         show file details per rule
  --score           output only the score
  -y, --yes         skip prompts, scan all workspace projects
  --project <name>  select workspace project (comma-separated for multiple)
  --diff [base]     scan only files changed vs base branch
  --fix             open Ami to auto-fix all issues
  --prompt          copy latest scan output to clipboard
  -h, --help        display help for command
```

## Configuration

Create a `svelte-doctor.config.json` in your project root to customize behavior:

```json
{
  "ignore": {
    "rules": ["svelte/no-at-html-tags", "knip/exports"],
    "files": ["src/generated/**"]
  }
}
```

You can also use the `"svelteDoctor"` key in your `package.json` instead:

```json
{
  "svelteDoctor": {
    "ignore": {
      "rules": ["svelte/no-at-html-tags"]
    }
  }
}
```

If both exist, `svelte-doctor.config.json` takes precedence.

## Node.js API

You can also use Svelte Doctor programmatically:

```js
import { diagnose } from "svelte-doctor/api";

const result = await diagnose("./path/to/your/svelte-project");

console.log(result.score); // { score: 82, label: "Good" } or null
console.log(result.diagnostics); // Array of Diagnostic objects
console.log(result.project); // Detected framework, Svelte version, etc.
```

### License

Svelte Doctor is MIT-licensed open-source software.
