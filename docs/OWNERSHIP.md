# Mapa de ownership (auditoria de 2026-10-25)

Origem auditada: `ordax-os@45ab6648835744ad8ae85ee617a3b6e8418545e8`.

| Caminho OS | Classificação | Proprietário |
| --- | --- | --- |
| `system/services/intelligence/runtime.mjs` | EXTRACTED — ainda sem cutover | Intelligence Core |
| `system/services/intelligence/model-router.mjs` | EXTRACTED — ainda sem cutover | Intelligence Router |
| `system/services/local-ai/runtime.mjs` | EXTRACTED — ainda sem cutover | Intelligence Local AI |
| `system/services/local-ai/completion-stream.mjs` | EXTRACTED — ainda sem cutover | Intelligence Streaming |
| `system/services/intelligence/native-service.mjs` | RETAIN | OS Identity/Space/Host |
| `system/services/intelligence/authorized-memory.mjs` | RETAIN | OS Memory/autorização |
| `system/services/intelligence/client-actions.mjs` e `tool-grants.mjs` | RETAIN | OS gateway/permissões |
| `system/services/intelligence/application-*.mjs`, `profile-content.mjs` e `work-canvas.mjs` | REVIEW | Interfaces/aplicativos/OS, sem migração automática |
| `system/services/local-ai/probe-supervisor.mjs` | RETAIN | OS Supervisor/health |
| `system/services/local-ai/model-compatibility.mjs` | EXTRACTED — ainda sem cutover | Avaliação técnica injetando inventário/metrics/modelo do OS |
| `system/services/local-ai/source-lock.json`, `owner-dev-runtime.sh` e `model-candidate.generated.mjs` | RETAIN | OS release/base/model policy |
| `bootstrap/local-ai-runtime/build.py` | HANDOFF | Build/artefato assinado do OS até separação verificada |
| `system/components/{ordax-intelligence,local-ai-service}/runtime.mjs` | RETAIN | Registro de componentes no OS |
| `system/contracts/{intelligence,model-router,local-ai}.mjs` | RETAIN | Contratos públicos OS |
| `docs/contracts/{intelligence,model-router,local-ai}.json` | RETAIN | Política canônica OS |

Consumidores confirmados: `system/composition/native/main.mjs`, registradores de componentes, testes de integração e contratos de publicação. Não remover implementação OS sem cutover testado.
