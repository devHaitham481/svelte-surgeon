import {
  noGiantComponent,
} from "./rules/architecture.js";
import {
  noBarrelImport,
  noFullLodashImport,
  noMoment,
} from "./rules/bundle-size.js";
import { clientPassiveEventListeners } from "./rules/client.js";
import {
  noEval, noSecretsInClientCode
} from "./rules/security.js";
import {
  noDerivedStateEffect,
  noFetchInOnMount,
} from "./rules/state-and-effects.js";
import {
  asyncParallel,
} from "./rules/js-performance.js";
import type { RulePlugin } from "./types.js";

const plugin: RulePlugin = {
  meta: { name: "svelte-doctor" },
  rules: {
    "no-derived-state-effect": noDerivedStateEffect,
    "no-fetch-in-onmount": noFetchInOnMount,

    "no-giant-component": noGiantComponent,

    "no-eval": noEval,
    "no-secrets-in-client-code": noSecretsInClientCode,

    "no-barrel-import": noBarrelImport,
    "no-full-lodash-import": noFullLodashImport,
    "no-moment": noMoment,

    "client-passive-event-listeners": clientPassiveEventListeners,

    "async-parallel": asyncParallel,
  },
};

export default plugin;
