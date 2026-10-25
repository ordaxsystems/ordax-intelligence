// Test-only binding to the real, pinned OS contract validators.
import * as intelligence from "../../_upstream/ordax-os/system/contracts/intelligence.mjs";
import * as localAi from "../../_upstream/ordax-os/system/contracts/local-ai.mjs";
import * as modelRouter from "../../_upstream/ordax-os/system/contracts/model-router.mjs";
import { bindIntelligenceContracts, bindLocalAiContracts, bindModelRouterContracts, bindModelCompatibilityContracts } from "../../src/index.mjs";
export const { createIntelligenceRuntime } = bindIntelligenceContracts({ intelligence, localAi, modelRouter });
export const { createModelRouterRuntime } = bindModelRouterContracts({ localAi, modelRouter });
export const { createLocalAiRuntime } = bindLocalAiContracts(localAi);
import * as hardware from "../../_upstream/ordax-os/system/contracts/hardware-inventory.mjs";
import * as systemMetrics from "../../_upstream/ordax-os/system/contracts/system-metrics.mjs";
import { BUNDLED_LOCAL_AI_MODEL_CANDIDATE } from "../../_upstream/ordax-os/system/services/local-ai/model-candidate.generated.mjs";
export const { assessBundledLocalAiModel } = bindModelCompatibilityContracts({ hardware, systemMetrics, candidate: BUNDLED_LOCAL_AI_MODEL_CANDIDATE });
