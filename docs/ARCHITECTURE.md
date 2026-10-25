# Arquitetura — OrdaX Intelligence

Motor reutilizável consultivo, Model Router e cliente de inferência HTTP/SSE são implementados aqui. Contratos públicos `ordax.intelligence/1`, `ordax.model-router/1` e `ordax.local-ai/1` pertencem ao `ordax-os` e são injetados na inicialização. Nenhum contrato de validação é duplicado na distribuição de produção.

O OS preserva **Identity, autorização, Memory canônica, Space/projeto, Action Gateway, Supervisor, Host Native, assinatura/ativação, atualização/rollback**. `ordax-platform` preserva OAuth/consentimento MCP remoto; `ordax-runtime`, execução de ações; `ordax-surface` e `ordax-apps`, interface Aura. Um modelo não pode conceder permissões.

## Porta pública no consumidor OS

```js
import * as intelligence from "./system/contracts/intelligence.mjs";
import * as localAi from "./system/contracts/local-ai.mjs";
import * as modelRouter from "./system/contracts/model-router.mjs";
import { bindIntelligenceContracts, bindLocalAiContracts } from "@ordax/intelligence";

const { createLocalAiRuntime } = bindLocalAiContracts(localAi);
const { createIntelligenceRuntime } = bindIntelligenceContracts({ intelligence, localAi, modelRouter });
const backend = createLocalAiRuntime({ endpoint: localAi.LOCAL_AI_NATIVE_ENDPOINT });
const core = createIntelligenceRuntime({ inferencePort: backend });
// A composição OS adiciona o contexto autorizado e oferece core aos consumidores.
```

Serviço Intelligence, motor llama.cpp candidato e bytes do modelo GGUF têm ciclos de vida distintos. O serviço não bloqueia boot/Surface quando o motor está ausente. O cliente HTTP não inicia processos nem atualiza modelos. `npm run test:compat` executa a regressão usando validadores do OS no commit fixado; CI não demonstra execução de inferência real, Base Buildroot, QEMU ou prova física.
