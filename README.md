# OrdaX Intelligence

Fonte canônica do **código reutilizável do motor de inteligência e inferência** do OrdaX. A substituição das implementações ainda rastreadas no OS depende do cutover de distribuição. O código do sistema, autorização, Memory persistente, Supervisor, composição Native, entrega assinada e rollback pertencem ao [ordax-os](https://github.com/ordaxsystems/ordax-os). As interfaces da Aura pertencem ao [ordax-surface](https://github.com/ordaxsystems/ordax-surface) e/ou [ordax-apps](https://github.com/ordaxsystems/ordax-apps).

## Próxima evolução canônica — Aura com inteligência contextual

A **Aura** é a experiência de conversação (`ordax-surface`/`ordax-apps`); o **Intelligence** é o núcleo consultivo e de inferência que ela consome. Torná-la útil para conhecer apps, Spaces, documentos e estado vivo não é apenas treinar o GGUF: exige contexto **verificado pelo OS**, recuperação de conhecimento (RAG), avaliação de qualidade e ações por gateways autorizados.

**Plano único desta evolução:** [INTELLIGENCE-001 — Aura com inteligência contextual](docs/plans/INTELLIGENCE-001-AURA-CONTEXTUAL-INTELLIGENCE.md). Ele registra o estado real dos contratos já existentes, fases F0–F5, fronteiras de ownership, critérios de aceite, matriz de regressões e próxima etapa elegível. Todo novo chat/engenheiro deve lê-lo antes de implementar RAG, descoberta de apps ou planejamento de ações.

A F0 já dispõe de [evidência integrada OS/Apps/Memory com inferência simulada](docs/evidence/INTELLIGENCE-001-F0-BASELINE.md); ainda não é uma prova de qualidade ou execução do modelo local.

**Não declarar pronto:** o OS já possui recuperação lexical de memória, manifests semânticos de apps, catálogo/roteador de intents e um contrato de índice vetorial. Entretanto, seu contrato atual informa embeddings e busca vetorial **desativados**; não há prova de um agente geral executando ferramentas via modelo. Esta PR de documentação não autoriza cutover, modelo/engine novo nem altera contratos.

## Estado da migração

**Migração em andamento, não concluída.** Nenhuma release de inferência independente, integração de distribuição, prova em QEMU ou hardware físico é declarada pronta. No cutover, os consumidores do OS deverão migrar para portas públicas e referências fixadas, antes da remoção do código interno anterior.

Consulte `docs/ARCHITECTURE.md`, `docs/MIGRATION.md` e `docs/OWNERSHIP.md` para acompanhar a separação verificada, o source lock no OS e os gates reais de publicação. Não criar autoridade de Memory, permissões, ações ou atualizador neste repositório.

**SSOT de proveniência:** o único pin do *código portátil* consumido pelo produto é `ordax-os/docs/contracts/intelligence-source.json`. O lock separado do **motor/modelo** fica em `ordax-os/system/services/local-ai/source-lock.json`. Este repositório não publica `docs/source-lock.json` nem outro espelho dos locks do OS; `npm run check` impede sua reintrodução. Artefatos gerados podem incorporar metadados verificados, mas não definem a escolha canônica.

O contrato público continua `ordax.intelligence/1`, `ordax.model-router/1` e `ordax.local-ai/1`, definido pelo `ordax-os/system/contracts`. Os módulos reutilizáveis são vinculados aos validadores canônicos pelo consumidor; contratos não são duplicados na distribuição deste pacote.

## Desenvolvimento e testes

O ponto de entrada de agentes é [AGENTS.md](AGENTS.md). Execute `npm run ci` para o código independente e, após materializar `_upstream/ordax-os` no commit fixado pela CI, execute `npm run test:compat` para os contratos canônicos. O conjunto upstream inclui testes com servidor HTTP **loopback real, mas backend simulado**: SSE, cancelamento e rejeição de campos de ferramentas. Nenhuma dessas provas certifica `llama.cpp`, ABI Buildroot, desempenho, QEMU ou USB físico; confira [docs/MIGRATION.md](docs/MIGRATION.md).

## Artefatos de desenvolvimento

A CI gera um tar determinístico de **source apenas**, com `manifest.json` e recibo SHA-256. Ele não contém motor llama.cpp nem pesos GGUF, não é assinado e não pode ser ativado como componente pelo OS. A avaliação técnica de compatibilidade de hardware/modelo está em `src/local-ai/model-compatibility.mjs`, com entradas canônicas injetadas pelo OS. Veja `docs/ARTIFACTS.md`.

## Builder técnico de inferência

A preparação de `llama.cpp`/GGUF foi extraída para `tools/inference-builder/build.py`; a seleção, hashes, licença e contrato continuam injetados pelo OS via `--os-source`. O builder ainda não substitui o pipeline canônico de imagem/assinatura do OS; detalhes em `docs/ENGINE-BUILD.md`.

## Medição de performance real

O harness [docs/BENCHMARKS.md](docs/BENCHMARKS.md) mede um backend local já ativo com HTTP loopback, latência, tokens/s e observação opcional de CPU/RSS do processo no Linux. Não instala modelo ou motor, não expõe chave e não substitui medições QEMU/Buildroot/hardware. A CI executa apenas testes com servidor-fixture.
