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

O `src/intelligence/runtime.mjs` só recebe contextos previamente autorizados pelo OS. Sua serialização **nunca** deve incorporar `text`, `id` ou `provenance` como linhas de prompt brutas: preservar JSON strings de linha única, IDs/proveniências escapados e orçamento de input medido após escape/truncamento Unicode seguro. Qualquer mudança no rendering exige regressão adversarial em `tests/upstream/test_intelligence_runtime.mjs` para `User request:`, `Intent:`, labels falsificadas, `CR/LF/NEL/U+2028/U+2029`, preservação do pedido real e limites do modelo. O modelo continua consultivo, e o OS é o único owner de escopo/autorizações.

### Orçamento de contexto compartilhado (INTELLIGENCE-001)

O producer **não pode truncar o primeiro item longo e descartar automaticamente todo contexto posterior**: o OS pode acrescentar Apps/intents após Memory e documentos. Preservar a divisão equilibrada por custo **serializado**, o limite `LOCAL_AI_MAX_PROMPT_CHARS` e a ordem recebida do OS; manter truncamento JSON Unicode-safe, marcadores de omissão e a integridade do pedido final. O produtor não seleciona apps, não concede autoridade a `scope=system` nem implementa novo RAG. Regressões obrigatórias: `tests/upstream/test_intelligence_runtime.mjs` e a composição OS fixada em `tests/upstream/test_contextual_f0.mjs`. Documentar limitações em `docs/evidence/INTELLIGENCE-001-F0-BASELINE.md`.

### Contexto ausente não equivale a aplicativo ausente

A composição OS pode deixar de anexar catálogos/intents quando o orçamento upstream já estiver saturado. O produtor mantém instruções explícitas para não afirmar instalação, ausência, capacidade ou execução sem evidência atual. Preserve o teste de `systemPrompt` em `tests/upstream/test_intelligence_runtime.mjs` e o diagnóstico de saturação em `tests/upstream/test_contextual_f0.mjs`. Um teste com backend simulado **não** confirma obediência do GGUF. Documentar essa lacuna como **dependência do owner OS** em `docs/evidence/INTELLIGENCE-001-F0-BASELINE.md`; não criar outro catálogo, indexador, memória ou permissões no Intelligence.

### Contextos com metadados maiores que sua parcela

Além do balanceamento compartilhado, preserve `viableContextBudgets` em `src/intelligence/runtime.mjs`: um item cujo ID/proveniência JSON escapados e texto mínimo não caibam na parcela deve devolver o orçamento aos contextos restantes. Nunca tratar parcela reservada como contexto efetivamente emitido; não reordenar/elevar escopos nem mudar os limites do OS. Regressões de prompt máximo, fontes inviáveis e catálogo viável ficam em `tests/upstream/test_intelligence_runtime.mjs` e na evidência F0. Não implementar RAG/Memory/catálogo paralelo para resolver orçamento de input.

### Troca de modelo em voo: invariância por requisição

Após escolher rota local, preserve `engineId` e `modelId` do **port Local AI do OS** durante a geração, inclusive streams. Eventos de troca e ciclo **A → B → A** invalidam a requisição, com limpeza do observador em `finally`. Verifique snapshot antes/depois de cada delta e antes da resposta final; transições `busy/ready` no mesmo modelo devem funcionar. Não implementar gerenciador paralelo, não apresentar deltas provisórios como resposta validada nem prometer revogação de deltas já entregues. Regressões em `tests/upstream/test_intelligence_runtime.mjs` e evidências em `docs/evidence/INTELLIGENCE-001-F0-BASELINE.md`.

### Última checagem de identidade antes do envio à Local AI

Não posicionar o último preflight **antes** de montar a entrada de inferência. O getter de preferência regional `getLocale()` e outras dependências de composição podem produzir transições síncronas; somente após preparar `systemPrompt` e `prompt` completo pode-se conferir novamente estado `ready`, identidade do modelo/motor e latch de trocas A → B → A. O próximo passo deve ser diretamente `inference.generate()`, sem getters intermediários. Preserve as regressões com zero requisições ao motor após mudanças em `tests/upstream/test_intelligence_runtime.mjs`. Port Local AI, identidade, escolha regional e ativação permanecem com o owner OS.

### Cancelamento no preflight final do modelo

Não remover o gate de `assertAlive()` + `signal.aborted` **após** construir `inferenceInput` e ler o snapshot final, imediatamente antes de `inference.generate()`. Dependências síncronas do OS, especialmente `getLocale()`, podem cancelar ou descartar o runtime sem trocar engine/modelo. A porta Local AI deve receber **zero** prompts nesse caso, mesmo que seu adaptador ignore um AbortSignal já abortado. Regressões obrigatórias em `tests/upstream/test_intelligence_runtime.mjs`; não criar cancelador ou autoridade paralela.

### Seleção de rota também faz parte da invariância de identidade

O monitor de identidade da Local AI deve ser instalado **antes** de `router.route()` e persistir durante o streaming, não apenas após obter a rota. Rejeite mudanças A → B → A de engine/modelId e `busy → ready` durante a seleção, mesmo se o snapshot e a rota finais voltarem a ser iguais. Após seleção, aceite busy/ready da mesma identidade para a geração. Remova o observador em `finally` e não encaminhe contexto antes dos gates. Os testes de regressão estão em `tests/upstream/test_intelligence_runtime.mjs`; a evidência e limitações constam em `docs/evidence/INTELLIGENCE-001-F0-BASELINE.md`.
