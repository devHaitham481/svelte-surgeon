import { GoogleGenerativeAI } from "@google/generative-ai";
import type { Diagnostic } from "../types.js";
import { logger } from "./logger.js";
import { spinner } from "./spinner.js";

const MODEL = "gemini-2.0-flash";

export const fixWithGemini = async (
  diagnostics: Diagnostic[],
  projectDirectory: string,
  apiKey: string,
): Promise<void> => {
  if (diagnostics.length === 0) {
    logger.success("No issues to fix!");
    return;
  }

  const client = new GoogleGenerativeAI(apiKey);
  const model = client.getGenerativeModel({ model: MODEL });

  const prompt = formatDiagnosticsForGemini(diagnostics);

  const fixSpinner = spinner("Analyzing issues with Gemini...").start();

  try {
    const response = await model.generateContent({
      contents: [
        {
          role: "user",
          parts: [
            {
              text: `${prompt}\n\nPlease analyze these issues in the Svelte/SvelteKit project at ${projectDirectory} and provide:
1. A brief summary of the issues
2. Specific fixes for each issue
3. Code snippets showing the corrected code

Be precise and actionable.`,
            },
          ],
        },
      ],
    });

    fixSpinner.succeed("Analysis complete!");
    logger.break();

    const textContent = response.response.text();
    if (textContent) {
      logger.log(textContent);
    }

    logger.break();
    logger.success("Fix suggestions provided above. Apply them to your codebase as needed.");
  } catch (error) {
    fixSpinner.fail("Failed to analyze issues with Gemini");
    if (error instanceof Error) {
      logger.error(error.message);
    }
    throw error;
  }
};

const formatDiagnosticsForGemini = (diagnostics: Diagnostic[]): string => {
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
