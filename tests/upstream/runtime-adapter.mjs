// Test-only binding to the real, pinned OS contract validators.
import * as intelligence from "../../_upstream/ordax-os/system/contracts/intelligence.mjs";
import * as localAi from "../../_upstream/ordax-os/system/contracts/local-ai.mjs";
import * as modelRouter from "../../_upstream/ordax-os/system/contracts/model-router.mjs";
import { bindIntelligenceContracts, bindLocalAiContracts, bindModelRouterContracts } from "../../src/index.mjs";
export const { createIntelligenceRuntime } = bindIntelligenceContracts({ intelligence, localAi, modelRouter });
export const { createModelRouterRuntime } = bindModelRouterContracts({ localAi, modelRouter });
export const { createLocalAiRuntime } = bindLocalAiContracts(localAi);
