# OrdaX Intelligence

Fonte canônica do **código reutilizável do motor de inteligência e inferência** do OrdaX. A substituição das implementações ainda rastreadas no OS depende do cutover de distribuição. O código do sistema, autorização, Memory persistente, Supervisor, composição Native, entrega assinada e rollback pertencem ao [ordax-os](https://github.com/ordaxsystems/ordax-os). As interfaces da Aura pertencem ao [ordax-surface](https://github.com/ordaxsystems/ordax-surface) e/ou [ordax-apps](https://github.com/ordaxsystems/ordax-apps).

## Estado da migração

**Migração em andamento, não concluída.** Nenhuma release de inferência independente, integração de distribuição, prova em QEMU ou hardware físico é declarada pronta. No cutover, os consumidores do OS deverão migrar para portas públicas e referências fixadas, antes da remoção do código interno anterior.

Consulte `docs/ARCHITECTURE.md`, `docs/MIGRATION.md` e `docs/OWNERSHIP.md` para acompanhar a separação verificada, o source lock no OS e os gates reais de publicação. Não criar autoridade de Memory, permissões, ações ou atualizador neste repositório.

O contrato público continua `ordax.intelligence/1`, `ordax.model-router/1` e `ordax.local-ai/1`, definido pelo `ordax-os/system/contracts`. Os módulos reutilizáveis são vinculados aos validadores canônicos pelo consumidor; contratos não são duplicados na distribuição deste pacote.

## Artefatos de desenvolvimento

A CI gera um tar determinístico de **source apenas**, com `manifest.json` e recibo SHA-256. Ele não contém motor llama.cpp nem pesos GGUF, não é assinado e não pode ser ativado como componente pelo OS. A avaliação técnica de compatibilidade de hardware/modelo está em `src/local-ai/model-compatibility.mjs`, com entradas canônicas injetadas pelo OS. Veja `docs/ARTIFACTS.md`.

## Builder técnico de inferência

A preparação de `llama.cpp`/GGUF foi extraída para `tools/inference-builder/build.py`; a seleção, hashes, licença e contrato continuam injetados pelo OS via `--os-source`. O builder ainda não substitui o pipeline canônico de imagem/assinatura do OS; detalhes em `docs/ENGINE-BUILD.md`.
