# OrdaX Intelligence

Fonte canônica proposta para o **motor reutilizável de inteligência e inferência** do OrdaX. O código do sistema, autorização, Memory persistente, Supervisor, composição Native, entrega assinada e rollback pertencem ao [ordax-os](https://github.com/ordaxsystems/ordax-os). As interfaces da Aura pertencem ao [ordax-surface](https://github.com/ordaxsystems/ordax-surface) e/ou [ordax-apps](https://github.com/ordaxsystems/ordax-apps).

## Estado da migração

**Migração em andamento, não concluída.** Nenhuma release de inferência independente, integração de distribuição, prova em QEMU ou hardware físico é declarada pronta. No cutover, os consumidores do OS deverão migrar para portas públicas e referências fixadas, antes da remoção do código interno anterior.

Consulte `docs/ARCHITECTURE.md`, `docs/MIGRATION.md` e `docs/OWNERSHIP.md` após a preparação do source. Não criar autoridade de Memory, permissões, ações ou atualizador neste repositório.

O contrato público continua `ordax.intelligence/1`, `ordax.model-router/1` e `ordax.local-ai/1`, definido pelo `ordax-os/system/contracts`. Os módulos reutilizáveis são vinculados aos validadores canônicos pelo consumidor; contratos não são duplicados na distribuição deste pacote.
