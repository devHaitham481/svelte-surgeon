import { SCORE_API_URL } from "../constants.js";
import type { Diagnostic, ScoreResult } from "../types.js";

export const calculateScore = async (diagnostics: Diagnostic[]): Promise<ScoreResult | null> => {
  const payload = diagnostics.map((diagnostic) => ({
    plugin: diagnostic.plugin,
    rule: diagnostic.rule,
    severity: diagnostic.severity,
  }));

  try {
    const response = await fetch(SCORE_API_URL, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ diagnostics: payload }),
    });

    if (!response.ok) return null;

    return (await response.json()) as ScoreResult;
  } catch {
    return null;
  }
};
