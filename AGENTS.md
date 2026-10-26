# AGENTS.md — OrdaX Intelligence

Este repositório é a fonte canônica do código **reutilizável** de Intelligence/Model Router/inferência. Leia, nesta ordem, `README.md`, `docs/ARCHITECTURE.md`, `docs/OWNERSHIP.md`, `docs/MIGRATION.md`, `docs/ENGINE-BUILD.md` e `docs/ARTIFACTS.md` antes de alterar source, release ou fronteiras.

## Ownership e contratos

- Use exclusivamente as portas públicas `ordax.intelligence/1`, `ordax.model-router/1`, `ordax.local-ai/1`. Seus validadores são injetados pelo `ordax-os`; jamais replique aqui sua autoridade.
- Identity, Space, Memory canônica, Action Gateway, permissões, Supervisor, Host Native, assinatura, ativação, atualização e rollback pertencem ao `ordax-os`. Controle do computador pertence ao `ordax-runtime`; OAuth/MCP remoto, ao `ordax-platform`; Aura visual, a `ordax-surface`/`ordax-apps`.
- O texto gerado por modelos é dado consultivo, sem autoridade. Recuse ferramentas, pedidos de ação e respostas de backend incompletas. Nunca faça egress implícito, gerencie chaves ou instale um segundo atualizador.
- O serviço Intelligence não é dependência de boot. Sem motor/modelo, publique indisponibilidade correta. Artefatos de modelos/motores e ABI são responsabilidades distintas do source portátil.

## Fluxo de trabalho

1. Verifique a `main` e PRs abertas nos repositórios Intelligence e OS; respeite mudanças concorrentes da Surface e do Buildroot.
2. Classifique cada arquivo por ownership; preserve contratos e regressões existentes. Trabalhe em branch e reúna alterações relacionadas numa PR.
3. Execute `npm run ci`. Para regressões vinculadas ao OS, forneça `_upstream/ordax-os` no commit fixado na CI e execute `npm run test:consumer` para conferir **oito hashes Git** contra o source lock do OS e depois `npm run test:compat`. O checkout de Intelligence precisa do histórico Git completo (`fetch-depth: 0`). Execute `python -m unittest discover -s tests -p 'test_inference_builder_isolation.py' -v` e os testes upstream correspondentes.
4. Valide também `npm run package` e `npm run package:verify`. O tar gerado é **somente source**, sem assinatura, engine ou modelo e sem autorização de ativação.
5. Diferencie rigorosamente CI simulada, loopback HTTP real com servidor-fixture, backend llama.cpp real, QEMU, Buildroot e hardware físico. Não declare o segundo usando a prova do primeiro.
6. A migração real exige que o OS atualize `docs/contracts/intelligence-source.json` (commit/hashes exatos) e transacione staging, build, health, rollback e remoção da implementação antiga. Não remova código do OS antes de provar seu substituto no produto.

## Continuidade

Atualize **`docs/MIGRATION.md`** (registro de gates, PRs, riscos e próxima etapa) e **`docs/OWNERSHIP.md`** (responsabilidades por arquivo) em mudanças arquiteturais. Não dependa de memória da conversa, não reintroduza Alpine/APK e não faça force-push da `main`.
