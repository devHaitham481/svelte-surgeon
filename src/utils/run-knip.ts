import fs from "node:fs";
import path from "node:path";
import { main } from "knip";
import { createOptions } from "knip/session";
import type { Diagnostic, KnipIssueRecords, KnipResults } from "../types.js";

const KNIP_CATEGORY_MAP: Record<string, string> = {
  files: "Dead Code",
  exports: "Dead Code",
  types: "Dead Code",
  duplicates: "Dead Code",
};

const KNIP_MESSAGE_MAP: Record<string, string> = {
  files: "Unused file",
  exports: "Unused export",
  types: "Unused type",
  duplicates: "Duplicate export",
};

const KNIP_SEVERITY_MAP: Record<string, "error" | "warning"> = {
  files: "warning",
  exports: "warning",
  types: "warning",
  duplicates: "warning",
};

const collectIssueRecords = (
  records: KnipIssueRecords,
  issueType: string,
  rootDirectory: string,
): Diagnostic[] => {
  const diagnostics: Diagnostic[] = [];

  for (const issues of Object.values(records)) {
    for (const issue of Object.values(issues)) {
      diagnostics.push({
        filePath: path.relative(rootDirectory, issue.filePath),
        plugin: "knip",
        rule: issueType,
        severity: KNIP_SEVERITY_MAP[issueType] ?? "warning",
        message: `${KNIP_MESSAGE_MAP[issueType]}: ${issue.symbol}`,
        help: "",
        line: 0,
        column: 0,
        category: KNIP_CATEGORY_MAP[issueType] ?? "Dead Code",
        weight: 1,
      });
    }
  }

  return diagnostics;
};

// HACK: knip triggers dotenv which logs to stdout/stderr via console methods
const silenced = async <T>(fn: () => Promise<T>): Promise<T> => {
  const originalLog = console.log;
  const originalInfo = console.info;
  const originalWarn = console.warn;
  const originalError = console.error;
  console.log = () => {};
  console.info = () => {};
  console.warn = () => {};
  console.error = () => {};
  try {
    return await fn();
  } finally {
    console.log = originalLog;
    console.info = originalInfo;
    console.warn = originalWarn;
    console.error = originalError;
  }
};

const findMonorepoRoot = (directory: string): string | null => {
  let currentDirectory = path.dirname(directory);

  while (currentDirectory !== path.dirname(currentDirectory)) {
    const hasWorkspaceConfig =
      fs.existsSync(path.join(currentDirectory, "pnpm-workspace.yaml")) ||
      (() => {
        const packageJsonPath = path.join(currentDirectory, "package.json");
        if (!fs.existsSync(packageJsonPath)) return false;
        const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"));
        return Array.isArray(packageJson.workspaces) || packageJson.workspaces?.packages;
      })();

    if (hasWorkspaceConfig) return currentDirectory;
    currentDirectory = path.dirname(currentDirectory);
  }

  return null;
};

const CONFIG_LOADING_ERROR_PATTERN = /Error loading .*\/([a-z-]+)\.config\./;
const PEER_DEPENDENCY_ERROR_PATTERN = /Could not resolve peer dependency/;

const extractFailedPluginName = (error: unknown): string | null => {
  const errorStr = String(error);
  const configMatch = errorStr.match(CONFIG_LOADING_ERROR_PATTERN);
  if (configMatch) return configMatch[1] ?? null;
  // Handle peer dependency errors from config loading (e.g., @sveltejs/kit in SvelteKit projects)
  if (PEER_DEPENDENCY_ERROR_PATTERN.test(errorStr)) return "vite";
  return null;
};

const MAX_KNIP_RETRIES = 5;

const createTemporaryKnipConfig = (directory: string, disabledPlugins: string[]): string | null => {
  if (disabledPlugins.length === 0) return null;

  const configPath = path.join(directory, "knip.json.tmp");
  const config = {
    vite: !disabledPlugins.includes("vite"),
    svelte: !disabledPlugins.includes("svelte"),
  };

  try {
    fs.writeFileSync(configPath, JSON.stringify(config));
    return configPath;
  } catch {
    return null;
  }
};

const cleanupTemporaryConfig = (configPath: string | null): void => {
  if (configPath && fs.existsSync(configPath)) {
    try {
      fs.unlinkSync(configPath);
    } catch {
      // Ignore cleanup errors
    }
  }
};

const runKnipWithOptions = async (
  knipCwd: string,
  workspaceName?: string,
  disabledPlugins: string[] = [],
): Promise<KnipResults> => {
  let tempConfigPath: string | null = null;

  try {
    // If we have disabled plugins, create a temporary knip config
    if (disabledPlugins.length > 0) {
      tempConfigPath = createTemporaryKnipConfig(knipCwd, disabledPlugins);
    }

    let options;

    // Try to create options, handling config loading errors
    try {
      options = await silenced(() =>
        createOptions({
          cwd: knipCwd,
          isShowProgress: false,
          ...(workspaceName ? { workspace: workspaceName } : {}),
        }),
      );
    } catch (error) {
      // If createOptions fails due to plugin issues, try again with vite plugin disabled
      const failedPlugin = extractFailedPluginName(error);
      if (failedPlugin && !disabledPlugins.includes(failedPlugin)) {
        return runKnipWithOptions(knipCwd, workspaceName, [...disabledPlugins, failedPlugin]);
      }
      throw error;
    }

    const parsedConfig = options.parsedConfig as Record<string, unknown>;

    // Apply pre-disabled plugins
    for (const plugin of disabledPlugins) {
      parsedConfig[plugin] = false;
    }

    for (let attempt = 0; attempt <= MAX_KNIP_RETRIES; attempt++) {
      try {
        return (await silenced(() => main(options))) as KnipResults;
      } catch (error) {
        const failedPlugin = extractFailedPluginName(error);
        if (!failedPlugin || attempt === MAX_KNIP_RETRIES) {
          throw error;
        }
        parsedConfig[failedPlugin] = false;
      }
    }

    throw new Error("Unreachable");
  } finally {
    cleanupTemporaryConfig(tempConfigPath);
  }
};

const hasNodeModules = (directory: string): boolean => {
  const nodeModulesPath = path.join(directory, "node_modules");
  return fs.existsSync(nodeModulesPath) && fs.statSync(nodeModulesPath).isDirectory();
};

export const runKnip = async (rootDirectory: string): Promise<Diagnostic[]> => {
  const monorepoRoot = findMonorepoRoot(rootDirectory);
  const hasInstalledDependencies =
    hasNodeModules(rootDirectory) || (monorepoRoot !== null && hasNodeModules(monorepoRoot));

  if (!hasInstalledDependencies) {
    return [];
  }

  let knipResult: KnipResults;

  try {
    // Wrap knip execution with a timeout to prevent hanging
    const knipPromise = (async () => {
      if (monorepoRoot) {
        const packageJsonPath = path.join(rootDirectory, "package.json");
        const packageJson = fs.existsSync(packageJsonPath)
          ? JSON.parse(fs.readFileSync(packageJsonPath, "utf-8"))
          : {};
        const workspaceName = packageJson.name ?? path.basename(rootDirectory);

        try {
          return await runKnipWithOptions(monorepoRoot, workspaceName);
        } catch {
          return await runKnipWithOptions(rootDirectory);
        }
      } else {
        return await runKnipWithOptions(rootDirectory);
      }
    })();

    // Set a 30-second timeout for knip analysis
    const timeoutPromise = new Promise<KnipResults>((_resolve, reject) =>
      setTimeout(() => reject(new Error("Knip analysis timed out after 30 seconds")), 30000),
    );

    knipResult = await Promise.race([knipPromise, timeoutPromise]);
  } catch (error) {
    // If knip fails to analyze (e.g., peer dependency issues, timeout), return empty diagnostics
    // This can happen when knip tries to load vite/svelte configs that have unresolvable peer deps
    return [];
  }

  const { issues } = knipResult;
  const diagnostics: Diagnostic[] = [];

  for (const unusedFile of issues.files) {
    diagnostics.push({
      filePath: path.relative(rootDirectory, unusedFile),
      plugin: "knip",
      rule: "files",
      severity: KNIP_SEVERITY_MAP["files"],
      message: KNIP_MESSAGE_MAP["files"],
      help: "This file is not imported by any other file in the project.",
      line: 0,
      column: 0,
      category: KNIP_CATEGORY_MAP["files"],
      weight: 1,
    });
  }

  const recordTypes = ["exports", "types", "duplicates"] as const;

  for (const issueType of recordTypes) {
    diagnostics.push(...collectIssueRecords(issues[issueType], issueType, rootDirectory));
  }

  return diagnostics;
};
