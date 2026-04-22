import OpenAI from "openai";
import type { Diagnostic } from "../types.js";
import { logger } from "./logger.js";
import { spinner } from "./spinner.js";

const MODEL = "gpt-4-turbo";

export const fixWithOpenAI = async (
  diagnostics: Diagnostic[],
  projectDirectory: string,
  apiKey: string,
): Promise<void> => {
  if (diagnostics.length === 0) {
    logger.success("No issues to fix!");
    return;
  }

  const client = new OpenAI({ apiKey });

  const prompt = formatDiagnosticsForOpenAI(diagnostics);

  const fixSpinner = spinner("Analyzing issues with OpenAI...").start();

  try {
    const response = await client.chat.completions.create({
      model: MODEL,
      max_tokens: 4096,
      messages: [
        {
          role: "user",
          content: `${prompt}\n\nPlease analyze these issues in the Svelte/SvelteKit project at ${projectDirectory} and provide:
1. A brief summary of the issues
2. Specific fixes for each issue
3. Code snippets showing the corrected code

Be precise and actionable.`,
        },
      ],
    });

    fixSpinner.succeed("Analysis complete!");
    logger.break();

    const textContent = response.choices[0]?.message?.content;
    if (textContent) {
      logger.log(textContent);
    }

    logger.break();
    logger.success("Fix suggestions provided above. Apply them to your codebase as needed.");
  } catch (error) {
    fixSpinner.fail("Failed to analyze issues with OpenAI");
    if (error instanceof Error) {
      logger.error(error.message);
    }
    throw error;
  }
};

const formatDiagnosticsForOpenAI = (diagnostics: Diagnostic[]): string => {
  const groups = new Map<string, Diagnostic[]>();

  for (const diagnostic of diagnostics) {
    const key = diagnostic.category;
    if (!groups.has(key)) {
      groups.set(key, []);
    }
    groups.get(key)!.push(diagnostic);
  }

  let output = "## Svelte/SvelteKit Code Issues to Fix\n\n";

  for (const [category, items] of groups.entries()) {
    output += `### ${category}\n`;
    for (const d of items) {
      output += `- **[${d.severity.toUpperCase()}]** ${d.message}\n`;
      output += `  - File: ${d.filePath}:${d.line}:${d.column}\n`;
      output += `  - Rule: ${d.plugin}/${d.rule}\n`;
      if (d.help) output += `  - Suggestion: ${d.help}\n`;
    }
    output += "\n";
  }

  return output;
};
