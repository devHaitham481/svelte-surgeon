import {
  GIANT_COMPONENT_LINE_THRESHOLD,
} from '../constants.js';
import type { EsTreeNode, Rule, RuleContext } from '../types.js';

export const noGiantComponent: Rule = {
  create: (context: RuleContext) => {
    return {
      Program(node: EsTreeNode) {
        if (!node.loc) return;
        const lineCount = node.loc.end.line - node.loc.start.line + 1;
        if (lineCount > GIANT_COMPONENT_LINE_THRESHOLD) {
          context.report({
            node,
            message: `Script block is ${lineCount} lines — consider breaking it into smaller components or utility files`,
          });
        }
      }
    };
  },
};

export const noAtHtmlTags: Rule = {
  create: (context: RuleContext) => ({
    SvelteElement(node: EsTreeNode) {
       // This is a placeholder to see if SvelteElement is hit
       // Actually, oxlint might not expose Svelte template nodes to JS plugins yet
    },
    // Let's try a more generic approach if possible, or stick to script-based rules for now
  }),
};
