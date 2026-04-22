import path from 'node:path';
import { Command } from 'commander';
import { SEPARATOR_LENGTH_CHARS } from './constants.js';
import { scan } from './scan.js';
import { diagnose } from './index.js';
import type { DiffInfo, ScanOptions, Diagnostic } from './types.js';
import { copyToClipboard } from './utils/copy-to-clipboard.js';
import { filterSourceFiles, getDiffInfo } from './utils/get-diff-files.js';
import { maybeInstallGlobally } from './utils/global-install.js';
import { handleError } from './utils/handle-error.js';
import { highlighter } from './utils/highlighter.js';
import { loadConfig } from './utils/load-config.js';
import { logger, startLoggerCapture, stopLoggerCapture } from './utils/logger.js';
import { prompts } from './utils/prompts.js';
import { selectProjects } from './utils/select-projects.js';
import { maybePromptSkillInstall } from './utils/skill-prompt.js';
import { discoverProject } from './utils/discover-project.js';
import { spinner } from './utils/spinner.js';
import { groupBy } from './utils/group-by.js';
import { getOrPromptApiConfig } from './utils/api-config.js';
import { fixWithClaude } from './utils/fix-with-claude.js';
import { fixWithGemini } from './utils/fix-with-gemini.js';
import { fixWithOpenAI } from './utils/fix-with-openai.js';

const VERSION = '0.1.1';

interface CliFlags {
  lint: boolean;
  deadCode: boolean;
  verbose: boolean;
  score: boolean;
  fix: boolean;
  prompt: boolean;
  yes: boolean;
  project?: string;
  diff?: boolean | string;
  agent?: string;
}

process.on('SIGINT', () => process.exit(0));
process.on('SIGTERM', () => process.exit(0));

// Handle unhandled promise rejections and exceptions more gracefully
let hasErrored = false;
process.on('uncaughtException', (error) => {
  hasErrored = true;
  logger.error(`Unexpected error: ${error.message}`);
  if (error.stack) {
    logger.dim(error.stack);
  }
  process.exit(1);
});

process.on('unhandledRejection', (reason) => {
  hasErrored = true;
  const message = reason instanceof Error ? reason.message : String(reason);
  logger.error(`Unhandled rejection: ${message}`);
  if (reason instanceof Error && reason.stack) {
    logger.dim(reason.stack);
  }
  process.exit(1);
});

const resolveDiffMode = async (
  diffInfo: DiffInfo | null,
  effectiveDiff: boolean | string | undefined,
  shouldSkipPrompts: boolean,
  isScoreOnly: boolean,
): Promise<boolean> => {
  if (effectiveDiff !== undefined && effectiveDiff !== false) {
    if (diffInfo) return true;
    if (!isScoreOnly) {
      logger.warn("Not on a feature branch or could not determine base branch. Running full scan.");
      logger.break();
    }
    return false;
  }

  if (effectiveDiff === false || !diffInfo) return false;

  const changedSourceFiles = filterSourceFiles(diffInfo.changedFiles);
  if (changedSourceFiles.length === 0) return false;
  if (shouldSkipPrompts) return true;
  if (isScoreOnly) return false;

  const { shouldScanBranchOnly } = await prompts({
    type: "confirm",
    name: "shouldScanBranchOnly",
    message: `On branch ${diffInfo.currentBranch} (${changedSourceFiles.length} changed files vs ${diffInfo.baseBranch}). Only scan this branch?`,
    initial: true,
  });
  return Boolean(shouldScanBranchOnly);
};

const runFix = async (resolvedDirectory: string) => {
  const scanSpinner = spinner('Analyzing codebase...').start();
  const result = await diagnose(resolvedDirectory);

  if (result.diagnostics.length === 0) {
    scanSpinner.succeed('Codebase is healthy! No issues to fix.');
    return;
  }
  scanSpinner.succeed(`Found ${result.diagnostics.length} issues to fix.`);

  const apiConfig = await getOrPromptApiConfig();
  if (!apiConfig) {
    logger.error('API key required for fix feature. Please configure it first.');
    return;
  }

  logger.break();
  logger.info(`Using ${apiConfig.provider.toUpperCase()} for analysis...`);
  logger.break();

  switch (apiConfig.provider) {
    case 'claude':
      await fixWithClaude(result.diagnostics, resolvedDirectory, apiConfig.apiKey);
      break;
    case 'gemini':
      await fixWithGemini(result.diagnostics, resolvedDirectory, apiConfig.apiKey);
      break;
    case 'openai':
      await fixWithOpenAI(result.diagnostics, resolvedDirectory, apiConfig.apiKey);
      break;
    default:
      logger.error(`Unknown provider: ${apiConfig.provider}`);
  }
};

const program = new Command()
  .name('svelte-surgeon')
  .description('Diagnose and auto-fix your Svelte/SvelteKit codebase with AI')
  .version(VERSION, '-v, --version', 'display the version number')
  .option('--no-lint', 'skip linting')
  .option('--no-dead-code', 'skip dead code detection')
  .option('--verbose', 'show file details per rule')
  .option('-s, --score', 'output only the score')
  .option('-y, --yes', 'skip prompts, scan all workspace projects')
  .option('-p, --project <name>', 'select workspace project (comma-separated for multiple)')
  .option('-d, --diff [base]', 'scan only files changed vs base branch')
  .option('-f, --fix', 'auto-fix issues with an AI agent')
  .option('--agent <name>', 'AI agent to use for fixing (claude, ami, amp)')
  .option('--prompt', 'copy latest scan output to clipboard')
  .argument('[directory]', 'project directory to scan')
  .action(async (directory: string | undefined, flags: CliFlags) => {
    const resolvedDir = directory || '.';
    const isScoreOnly = flags.score && !flags.prompt;
    const shouldCopyPromptOutput = flags.prompt;

    if (shouldCopyPromptOutput) {
      startLoggerCapture();
    }

    try {
      const resolvedDirectory = path.resolve(resolvedDir);

      if (flags.fix) {
        await runFix(resolvedDirectory);
        return;
      }

      // Check for Svelte project first
      try {
        const info = discoverProject(resolvedDirectory);
        if (!info.svelteVersion && !isScoreOnly && !flags.prompt) {
          logger.break();
          logger.log(`  svelte-doctor v${VERSION}`);
          logger.break();
          logger.warn('No Svelte dependency found in package.json.');
          logger.dim('    This project does not appear to be a Svelte project.');
          logger.dim('    svelte-doctor is designed for Svelte/SvelteKit codebases.');
          logger.break();
          logger.log('  Add svelte to your dependencies and try again.');
          return;
        }
      } catch (e) {}

      const userConfig = loadConfig(resolvedDirectory);

      if (!isScoreOnly) {
        logger.log(`  svelte-doctor v${VERSION}`);
        logger.break();
      }

      const isCliOverride = (optionName: string) =>
        program.getOptionValueSource(optionName) === 'cli';

      const scanOptions: ScanOptions = {
        lint: isCliOverride('lint') ? flags.lint : (userConfig?.lint ?? flags.lint),
        // Note: Dead code detection (knip) is disabled by default due to performance issues with certain project configs
        // Enable with --dead-code flag if needed
        deadCode: isCliOverride('deadCode')
          ? flags.deadCode
          : (userConfig?.deadCode ?? false),
        verbose:
          flags.prompt ||
          (isCliOverride('verbose') ? Boolean(flags.verbose) : (userConfig?.verbose ?? false)),
        scoreOnly: isScoreOnly,
      };

      const isAutomatedEnvironment = [
        process.env.CI,
        process.env.CLAUDECODE,
        process.env.CURSOR_AGENT,
        process.env.CODEX_CI,
        process.env.OPENCODE,
        process.env.AMP_HOME,
        process.env.AMI,
      ].some(Boolean);
      const shouldSkipPrompts = flags.yes || isAutomatedEnvironment || !process.stdin.isTTY;
      const projectDirectories = await selectProjects(
        resolvedDirectory,
        flags.project,
        shouldSkipPrompts,
      );

      const effectiveDiff = isCliOverride('diff') ? flags.diff : userConfig?.diff;
      const explicitBaseBranch = typeof effectiveDiff === 'string' ? effectiveDiff : undefined;
      const diffInfo = getDiffInfo(resolvedDirectory, explicitBaseBranch);
      const isDiffMode = await resolveDiffMode(
        diffInfo,
        effectiveDiff,
        shouldSkipPrompts,
        isScoreOnly,
      );

      if (isDiffMode && diffInfo && !isScoreOnly) {
        logger.log(
          `Scanning changes: ${highlighter.info(diffInfo.currentBranch)} → ${highlighter.info(diffInfo.baseBranch)}`,
        );
        logger.break();
      }

      for (const projectDirectory of projectDirectories) {
        let includePaths: string[] | undefined;
        if (isDiffMode) {
          const projectDiffInfo = getDiffInfo(projectDirectory, explicitBaseBranch);
          if (projectDiffInfo) {
            const changedSourceFiles = filterSourceFiles(projectDiffInfo.changedFiles);
            if (changedSourceFiles.length === 0) {
              if (!isScoreOnly) {
                logger.dim(`No changed source files in ${projectDirectory}, skipping.`);
                logger.break();
              }
              continue;
            }
            includePaths = changedSourceFiles;
          }
        }

        if (!isScoreOnly) {
          logger.dim(`Scanning ${projectDirectory}...`);
          logger.break();
        }
        await scan(projectDirectory, { ...scanOptions, includePaths });
        if (!isScoreOnly) {
          logger.break();
        }
      }

      if (!isScoreOnly && !flags.prompt) {
        await maybePromptSkillInstall(shouldSkipPrompts);
      }
    } catch (error) {
      handleError(error, { shouldExit: !shouldCopyPromptOutput });
    } finally {
      if (shouldCopyPromptOutput) {
        const capturedOutput = stopLoggerCapture();
        // copyPromptToClipboard(capturedOutput, !isScoreOnly);
      }
    }
  });

program
  .command('fix')
  .description('auto-fix issues with Claude AI')
  .argument('[directory]', 'project directory to scan', '.')
  .action(async (directory: string) => {
    try {
      await runFix(path.resolve(directory));
    } catch (error) {
      handleError(error, { shouldExit: true });
    }
  });

program
  .command('config')
  .description('Configure API keys for the fix feature')
  .action(async () => {
    try {
      const { promptForApiKey } = await import('./utils/api-config.js');
      await promptForApiKey();
    } catch (error) {
      handleError(error, { shouldExit: true });
    }
  });

program.addHelpText(
    'after',
    `
Examples:
  $ svelte-surgeon                       Scan current directory
  $ svelte-surgeon ./my-app              Scan a specific project
  $ svelte-surgeon --verbose             Show file:line locations per issue
  $ svelte-surgeon --score               Output only the numeric score (for CI)
  $ svelte-surgeon --fix                 Auto-fix issues with AI (Claude/Gemini/OpenAI)
  $ svelte-surgeon --diff                Scan only files changed vs default branch
  $ svelte-surgeon config                Configure API keys for fix feature

API Configuration:
  Before using --fix, configure your AI provider (Claude, Gemini, or OpenAI):
    $ svelte-surgeon config

  Config is saved to ~/.svelte-surgeon.config.json or .svelte-surgeon.config.json

Supported AI Providers:
  • Claude 3.5 Sonnet (Anthropic)
  • Gemini 2.0 Flash (Google)
  • GPT-4 Turbo (OpenAI)

Learn more:
  ${highlighter.info('https://github.com/devHaitham481/svelte-surgeon')}
`,
  );

const main = async () => {
  maybeInstallGlobally();
  await program.parseAsync();
};

main();
