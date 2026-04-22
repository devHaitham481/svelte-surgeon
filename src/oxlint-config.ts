import { createRequire } from "node:module";
import type { Framework } from "./types.js";

const esmRequire = createRequire(import.meta.url);

// SvelteKit-specific rules (disabled - not yet implemented in plugin)
const SVELTEKIT_RULES: Record<string, string> = {
  // "svelte-doctor/sveltekit-no-img-element": "warn",
  // "svelte-doctor/sveltekit-no-a-element": "warn",
};

interface OxlintConfigOptions {
  pluginPath: string;
  framework: Framework;
}

export const createOxlintConfig = ({
  pluginPath,
  framework,
}: OxlintConfigOptions) => ({
  categories: {
    correctness: "off",
    suspicious: "off",
    pedantic: "off",
    perf: "off",
    restriction: "off",
    style: "off",
    nursery: "off",
  },
  plugins: [], // Add svelte plugin if/when oxlint supports it explicitly
  jsPlugins: [
    pluginPath,
  ],
  rules: {
    "svelte-doctor/no-derived-state-effect": "error",
    "svelte-doctor/no-fetch-in-onmount": "error",

    "svelte-doctor/no-giant-component": "warn",

    "svelte-doctor/no-secrets-in-client-code": "error",

    "svelte-doctor/no-barrel-import": "warn",
    "svelte-doctor/no-full-lodash-import": "warn",
    "svelte-doctor/no-moment": "warn",

    "svelte-doctor/client-passive-event-listeners": "warn",

    "svelte-doctor/async-parallel": "warn",
    ...(framework === "sveltekit" ? SVELTEKIT_RULES : {}),
  },
});
