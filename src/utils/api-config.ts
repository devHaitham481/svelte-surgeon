import fs from "node:fs";
import path from "node:path";
import os from "node:os";
import { prompts } from "./prompts.js";
import { logger } from "./logger.js";

export interface ApiConfig {
  provider: "claude" | "gemini" | "openai";
  apiKey: string;
}

const CONFIG_FILENAME = ".svelte-doctor.config.json";
const CONFIG_PATHS = [
  path.join(process.cwd(), CONFIG_FILENAME),
  path.join(os.homedir(), CONFIG_FILENAME),
];

export const loadApiConfig = (): ApiConfig | null => {
  for (const configPath of CONFIG_PATHS) {
    if (fs.existsSync(configPath)) {
      try {
        const content = fs.readFileSync(configPath, "utf-8");
        return JSON.parse(content);
      } catch {
        logger.warn(`Failed to parse config at ${configPath}`);
      }
    }
  }
  return null;
};

export const saveApiConfig = (config: ApiConfig, global = false): void => {
  const configPath = global ? CONFIG_PATHS[1] : CONFIG_PATHS[0];
  fs.writeFileSync(configPath, JSON.stringify(config, null, 2));
  logger.success(`Config saved to ${configPath}`);
};

export const promptForApiKey = async (): Promise<ApiConfig | null> => {
  const { provider } = await prompts({
    type: "select",
    name: "provider",
    message: "Which AI provider do you want to use?",
    choices: [
      { title: "Claude (Anthropic)", value: "claude" },
      { title: "Gemini (Google)", value: "gemini" },
      { title: "OpenAI", value: "openai" },
    ],
  });

  if (!provider) return null;

  const { apiKey } = await prompts({
    type: "password",
    name: "apiKey",
    message: `Enter your ${provider.toUpperCase()} API key:`,
  });

  if (!apiKey) return null;

  const { saveGlobally } = await prompts({
    type: "confirm",
    name: "saveGlobally",
    message: "Save this key globally in your home directory?",
    initial: true,
  });

  const config: ApiConfig = { provider: provider as ApiConfig["provider"], apiKey };
  saveApiConfig(config, saveGlobally);

  return config;
};

export const getOrPromptApiConfig = async (skipPrompt = false): Promise<ApiConfig | null> => {
  const existingConfig = loadApiConfig();
  if (existingConfig) return existingConfig;

  if (skipPrompt) {
    logger.error("No API key found. Please configure one with: svelte-doctor --config");
    return null;
  }

  logger.break();
  logger.log("No API key configured. Let's set one up:");
  logger.break();

  return promptForApiKey();
};
