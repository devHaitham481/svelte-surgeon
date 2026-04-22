import {
  walkAst,
  containsFetchCall,
} from "../helpers.js";
import type { EsTreeNode, Rule, RuleContext } from "../types.js";

const SVELTE_LIFECYCLE_FUNCTIONS = new Set(["onMount", "beforeUpdate", "afterUpdate", "onDestroy"]);
const SVELTE_REACTIVE_PATTERNS = new Set(["$effect", "$effect.pre"]);

export const noDerivedStateEffect: Rule = {
  create: (context: RuleContext) => ({
    // Detect $: x = y in Svelte 4
    LabeledStatement(node: EsTreeNode) {
      if (node.label?.name !== "$") return;
      // In Svelte 4, $: is used for both effects and derived state.
      // If it only contains a simple assignment, it might be better as a derived value in Svelte 5
      // or just noted as a reactive declaration.
    },
    // Detect $effect in Svelte 5
    CallExpression(node: EsTreeNode) {
      if (node.callee?.type === "Identifier" && SVELTE_REACTIVE_PATTERNS.has(node.callee.name)) {
        // Similar to useEffect, check if it's only doing assignments
      }
    }
  }),
};

export const noFetchInOnMount: Rule = {
  create: (context: RuleContext) => ({
    CallExpression(node: EsTreeNode) {
      const calleeName = node.callee?.type === "Identifier" ? node.callee.name : null;
      if (!calleeName || (!SVELTE_LIFECYCLE_FUNCTIONS.has(calleeName) && !SVELTE_REACTIVE_PATTERNS.has(calleeName))) return;
      
      const callback = node.arguments[0];
      if (!callback || (callback.type !== "ArrowFunctionExpression" && callback.type !== "FunctionExpression")) return;

      if (containsFetchCall(callback)) {
        context.report({
          node,
          message:
            `fetch() inside ${calleeName} — use a SvelteKit load function or a data fetching library for better SSR support`,
        });
      }
    },
  }),
};
