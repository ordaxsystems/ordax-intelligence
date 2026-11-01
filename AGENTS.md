# AGENTS.md — OrdaX Intelligence

Este repositório é a fonte canônica do código **reutilizável** de Intelligence/Model Router/inferência. Leia, nesta ordem, `README.md`, **`docs/plans/INTELLIGENCE-001-AURA-CONTEXTUAL-INTELLIGENCE.md`**, `docs/ARCHITECTURE.md`, `docs/OWNERSHIP.md`, `docs/MIGRATION.md`, `docs/ENGINE-BUILD.md` e `docs/ARTIFACTS.md` antes de alterar source, release ou fronteiras.

## Ownership e contratos

- Use exclusivamente as portas públicas `ordax.intelligence/1`, `ordax.model-router/1`, `ordax.local-ai/1`. Seus validadores são injetados pelo `ordax-os`; jamais replique aqui sua autoridade.
- Não criar `docs/source-lock.json` nem qualquer segunda cópia de `source-lock.json` neste repositório. O pin do código portátil é `ordax-os/docs/contracts/intelligence-source.json`; o lock do motor/modelo é `ordax-os/system/services/local-ai/source-lock.json`. `npm run check` verifica essa fronteira automaticamente.
- Identity, Space, Memory canônica, Action Gateway, permissões, Supervisor, Host Native, assinatura, ativação, atualização e rollback pertencem ao `ordax-os`. Controle do computador pertence ao `ordax-runtime`; OAuth/MCP remoto, ao `ordax-platform`; Aura visual, a `ordax-surface`/`ordax-apps`.
- O texto gerado por modelos é dado consultivo, sem autoridade. Recuse ferramentas, pedidos de ação e respostas de backend incompletas. Nunca faça egress implícito, gerencie chaves ou instale um segundo atualizador.
- O serviço Intelligence não é dependência de boot. Sem motor/modelo, publique indisponibilidade correta. Artefatos de modelos/motores e ABI são responsabilidades distintas do source portátil.
- Evolução da Aura: **consumir, não replicar** `ordax-os/system/services/intelligence/{application-awareness,application-context,application-semantic-router,application-action-capabilities,semantic-retrieval}.mjs` e `system/services/memory/context.mjs`, os contratos de apps e o índice vetorial do OS. O status atual de embeddings/busca semântica é desativado; sem backend autorizado não afirmar RAG semântico operacional. Manifests são dados e nunca fonte de permissão.
- Fases F0–F5, owner, gates, cenários de segurança e Definition of Done estão **apenas** em `docs/plans/INTELLIGENCE-001-AURA-CONTEXTUAL-INTELLIGENCE.md`. Não criar segunda roadmap, novo catálogo de apps, banco de memória, grant authority ou executor de ações no Intelligence.

## Fluxo de trabalho

1. Verifique a `main` e PRs abertas nos repositórios Intelligence e OS; respeite mudanças concorrentes da Surface e do Buildroot.
2. Classifique cada arquivo por ownership; preserve contratos e regressões existentes. Trabalhe em branch e reúna alterações relacionadas numa PR.
3. Execute `npm run ci`. Para regressões vinculadas ao OS, forneça `_upstream/ordax-os` no commit fixado na CI e execute `npm run test:consumer` para conferir **o grafo completo de blobs Git da revisão fixada** contra o único pin de source do OS (o pin histórico contém oito, mas o conjunto portátil atual já possui dependências adicionais) e depois `npm run test:compat`. O checkout de Intelligence precisa do histórico Git completo (`fetch-depth: 0`). Execute `python -m unittest discover -s tests -p 'test_inference_builder_isolation.py' -v` e os testes upstream correspondentes.
4. Valide também `npm run package` e `npm run package:verify`. O tar gerado é **somente source**, sem assinatura, engine ou modelo e sem autorização de ativação.
5. Diferencie rigorosamente CI simulada, loopback HTTP real com servidor-fixture, backend llama.cpp real, QEMU, Buildroot e hardware físico. Não declare o segundo usando a prova do primeiro.
6. A migração real exige que o OS atualize `docs/contracts/intelligence-source.json` (commit/hashes exatos) e transacione staging, build, health, rollback e remoção da implementação antiga. Não remova código do OS antes de provar seu substituto no produto.

## Gate permanente de mudanças na Aura/Intelligence

Antes de implementar uma fase do plano: (1) localizar contratos e serviços existentes no OS, (2) classificar cada arquivo/port pelo owner, (3) adicionar regressões negativas de escopo/identidade/ação e cenário de indisponibilidade, (4) provar limite de contexto, offline e status correto, (5) separar CI de fixture, teste Windows físico e ativação por pin OS. Em qualquer alteração de RAG, consulta de apps ou planejamento, manter `ordax.intelligence/1` consultivo (`toolExecution=false`, `authority=none`); qualquer execução exige contrato/gateway separado no OS e Runtime.

Os testes de regressão da F0 estão em `tests/upstream/test_contextual_f0.mjs`, com cenários exclusivamente sintéticos em `tests/fixtures/contextual-f0.json`. `tools/evaluation/score-contextual-f0.mjs` usa **os mesmos IDs** para canários lexicais de resposta (`tests/contextual-quality.test.mjs`); não criar outro benchmark de casos nem transformar respostas do modelo em código/fatos de autoridade. Novas mudanças em contexto Aura devem preservar a verificação conjunta de apps, autorização de Memory/Space, origem de evidências, falsificação de IDs reservados, descarte de resultados tardios e ausência de execução. Consulte [F0-BASELINE](docs/evidence/INTELLIGENCE-001-F0-BASELINE.md); nunca classifique testes com backend simulado como avaliação de qualidade do modelo.

## Continuidade

Atualize **`docs/MIGRATION.md`** (registro de gates, PRs, riscos e próxima etapa) e **`docs/OWNERSHIP.md`** (responsabilidades por arquivo) em mudanças arquiteturais. Não dependa de memória da conversa, não reintroduza Alpine/APK e não faça force-push da `main`.

### Idioma da Aura é autoridade do OS

Ao alterar `src/intelligence/runtime.mjs`, preserve `getLocale` dinâmico **e a injeção** `regionalLocalePreference.validate` do OS em `bindIntelligenceContracts`. Nunca inferir o idioma pelo prompt, sistema hospedeiro ou cache local, nem criar uma segunda chave `regional.locale`. O consumidor que fornece `getLocale` sem validador regional falha fechado; sem getter a API continua compatível. Os testes em `tests/upstream/test_intelligence_runtime.mjs` cobrem mudança de idioma na sessão e valor malicioso, com fonte canônica `_upstream/ordax-os/system/services/preferences/regional.mjs`. O cutover de bindings e remoção do runtime antigo são tarefas do owner OS, não deste repositório.

### Contexto da Aura: delimitação estrutural no produtor

O \`src/intelligence/runtime.mjs\` só recebe contextos previamente autorizados pelo OS. Sua serialização **nunca** deve incorporar \`text\`, \`id\` ou \`provenance\` como linhas de prompt brutas: preservar JSON strings de linha única, IDs/proveniências escapados e orçamento de input medido após escape/truncamento Unicode seguro. Qualquer mudança no rendering exige regressão adversarial em \`tests/upstream/test_intelligence_runtime.mjs\` para \`User request:\`, \`Intent:\`, labels falsificadas, \`CR/LF/NEL/U+2028/U+2029\`, preservação do pedido real e limites do modelo. O modelo continua consultivo, e o OS é o único owner de escopo/autorizações.
