# Svelte Doctor - Setup & Usage Guide

## What's New

Svelte Doctor now supports automated fixing of code issues using Claude AI with proper configuration management.

## Quick Start

### 1. Basic Scanning

```bash
# Scan current directory
npx svelte-doctor

# Scan a specific SvelteKit project
npx svelte-doctor ./my-sveltekit-app

# Show only the health score
npx svelte-doctor --score
```

### 2. Configure Claude API Key

Before using the `--fix` feature, configure your Claude API key:

```bash
svelte-doctor config
```

This will prompt you to:
1. Select your AI provider (Claude is currently supported for --fix)
2. Enter your API key
3. Choose whether to save it globally (~/.svelte-doctor.config.json) or locally (.svelte-doctor.config.json)

### 3. Auto-Fix Issues with Claude AI

```bash
# Analyze and get Claude's suggestions for fixing issues
svelte-doctor --fix

# Fix a specific project
svelte-doctor ./my-project --fix
```

## Configuration File

API keys are stored in either:
- `~/.svelte-doctor.config.json` (global, your home directory)
- `.svelte-doctor.config.json` (local, project root)

Format:
```json
{
  "provider": "claude",
  "apiKey": "sk-ant-..."
}
```

## Features

### Scanning
- **Framework Detection**: Automatically detects Svelte/SvelteKit projects
- **Lint Checks**: Uses oxlint for code quality analysis
- **Dead Code Detection**: Optional knip-based analysis (disabled by default due to config complexity)
- **Health Score**: Calculates project health on a 0-100 scale

### Fixing
- **Claude Integration**: Uses Claude 3.5 Sonnet to analyze and suggest fixes
- **Issue Categorization**: Groups issues by category for better context
- **API Key Management**: Secure config file storage with optional global configuration

## CLI Options

```
Options:
  --no-lint             Skip linting checks
  --no-dead-code        Skip dead code detection
  --verbose             Show file:line locations for each issue
  -s, --score           Output only the numeric score (for CI/CD)
  -y, --yes             Skip prompts and scan all workspace projects
  -p, --project <name>  Select specific workspace projects
  -d, --diff [base]     Scan only files changed vs base branch
  -f, --fix             Auto-fix issues with Claude AI
  --prompt              Copy scan output to clipboard
```

## Commands

```
svelte-doctor config              Configure API keys
svelte-doctor fix [directory]     Auto-fix issues in a project
```

## Known Limitations

1. **Dead Code Detection**: Disabled by default. Some projects with complex vite configs may cause issues.
   - Enable with: `svelte-doctor --dead-code`

2. **Fix Feature**: Currently only supports Claude provider
   - Gemini and OpenAI support coming soon

3. **oxlint Custom Rules**: Some custom oxlint rules may not be available in all versions
   - These are caught and logged as non-fatal errors

## Troubleshooting

### "API key not found" error
- Run `svelte-doctor config` to set up your Claude API key
- Make sure the config file is readable (check permissions)

### "No issues found" but not calculating score
- This means the health score service is temporarily unavailable
- The scan still completed successfully

### Linting fails with custom rule errors
- This is non-fatal and typically indicates missing custom rules
- The scan continues and reports any other issues

## Examples

```bash
# Basic project scan
svelte-doctor

# Verbose output with file locations
svelte-doctor --verbose

# Scan for changes only (on a feature branch)
svelte-doctor --diff main

# Auto-fix with Claude
svelte-doctor --fix

# Just show the health score (good for CI/CD)
svelte-doctor --score

# Configure API key with prompts
svelte-doctor config
```

## API Configuration Formats

### Claude (Anthropic)
```json
{
  "provider": "claude",
  "apiKey": "sk-ant-YOUR-API-KEY-HERE"
}
```

Get your key at: https://console.anthropic.com/

## Next Steps

1. Install svelte-doctor: `npm install -g svelte-doctor` or use `npx svelte-doctor`
2. Configure your Claude API key: `svelte-doctor config`
3. Scan your project: `svelte-doctor --verbose`
4. Get AI-powered fixes: `svelte-doctor --fix`
