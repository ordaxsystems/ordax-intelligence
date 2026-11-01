# INTELLIGENCE-001 — F0, baseline de contexto e limites de evidência

**Data-base:** 2026-11-01.
**Plano único:** [INTELLIGENCE-001](../plans/INTELLIGENCE-001-AURA-CONTEXTUAL-INTELLIGENCE.md).
**Nível de evidência:** regressão integrada com fixtures determinísticas, usando serviços reais do **OS fixado pela CI** e o source portátil do Intelligence, **não** avaliação de qualidade do GGUF/llama.cpp nem prova física Windows.

## 1. Inventário do que já está ligado pelo OS

Verificação de código-fonte em `ordax-os/main`, arquivo `system/composition/native/main.mjs` (somente leitura, sem editar outro repositório):

- `createIntelligenceRuntime()` e `createLocalAiRuntime()`: **linhas 407–416**; criam o núcleo consultivo/port local.
- `createApplicationIntelligenceAwareness()`: **linhas 546–565**; combina catálogo first-party e manifests verificados de slots.
- `createApplicationActionCapabilityRegistry()`: **linhas 566–574**; só materializado quando há capacidades verificadas.
- `createApplicationSemanticRouter()` e `createApplicationContextIntelligence()`: **linhas 575–584**; envolvem o núcleo com contexto de apps e seleção local de intents.
- `createIdentityBoundMemoryIntelligence()`: **linhas 597–604**; vincula memória ao usuário/Space corrente quando há Memory Port.
- `installNativeIntelligenceHostBridge()`: **linhas 620–629**, condicionado a `hasNativeHostBridge(window)`; não presume que a integração exista em navegador de desenvolvimento nem em todo instalador Windows.

**Conclusão técnica delimitada:** o wiring Native de fonte **existe** e foi verificado visualmente no código. Não foi comprovado o mesmo fluxo no `.exe` Windows físico, nem que uma release implantada esteja consumindo a revisão atual de `ordax-intelligence`. O pin de produção/integração deve continuar imutável até os gates do OS.

O OS já possui `app-intelligence-manifest`, `application-awareness`, `application-context`, `application-semantic-router`, `application-action-capabilities`, `authorized-memory` e `semantic-retrieval`; nenhuma dessas fontes deve ser implementada uma segunda vez no Intelligence. O contrato OS `docs/contracts/semantic-index.json` continua com embedding e semantic search **desativados**.

## 2. Fixture de contrato, não de modelo

- Dados de entrada: `tests/fixtures/contextual-f0.json` — **exemplos sintéticos**, não inventário de apps do usuário nem catálogo distribuível.
- Regressão: `tests/upstream/test_contextual_f0.mjs` — importa **diretamente** `createApplicationIntelligenceAwareness`, `createApplicationSemanticRouter`, `createApplicationActionCapabilityRegistry`, `createApplicationContextIntelligence` e `createIdentityBoundMemoryIntelligence` do checkout OS `_upstream/ordax-os`, mais `createIntelligenceRuntime` deste repositório vinculado aos validadores OS.
- O fake de inferência observa o `systemPrompt`, o contexto entregue ao motor, o snapshot e o resultado com `authority=none`. **Não** decide se a resposta em português é correta: retorna texto rotulado `Fixture-only reply`. Não há embeddings, GGUF, servidor externo, grants ou ações.
- CI: `npm run test:compat` já executa `tests/upstream/test_*.mjs`; a `ci.yml` fixa o OS em `3eb97a47e93aca294eaaf1e3597b3c98f4aebe0b`. Esse checkout contém as mesmas portas de composição testadas. Não alterar o pin histórico apenas para obter testes verdes.

### Casos positivos/verificações

| Cenário | Evidência que deve chegar ao modelo | O que não pode chegar |
| --- | --- | --- |
| `notes-intent` | Catálogo + manifesto/contexto do Notes + capability de proposta + Memory permitida | Documentos/Memory de Space B, app desconhecido como autorizado |
| `installed-catalog` | Catálogo incluindo app Windows marcado como compatibilidade/sem trust nativa | Execução e detalhes de ação de app não selecionado |
| `unsupported-app` | Catálogo conhecido (sem confirmação de app imaginário) | Detalhe ou ação inventada para app inexistente |
| `live-system-context` | Métrica **sintética** explicitamente entregue pelo port do OS e proveniência | Inferir métricas reais de um computador inexistente |
| `hostile-user-prompt` | Texto hostil apenas como pedido/dado; `systemPrompt` independente com vedação de autoridade | Execução automática, concessão de ferramentas |
| `signed-out-device-only` | Somente Memory de device e catálogo de apps | Memory privada de conta/Space após logout |

### Casos negativos

| Caso | Gate exigido |
| --- | --- |
| Caller falsifica `ordax-application-catalog` | OS rejeita ID reservado antes de qualquer `inference.generate()` |
| Fonte de Memory retorna dado de outro Space | OS rejeita escopo incompatível antes da inferência |
| Seleção de Space muda durante `inference.generate()` | Resposta tardia rejeitada e não repetida com contexto antigo |
| Local AI está `unavailable` | Snapshot `degraded`, sem resposta simulada nem POST de inferência |

O teste exige **zero chamadas de execução** porque a cadeia não possui porta de executor. Isso não demonstra resistência a prompt injection do modelo real; esse risco permanece aberto para avaliações adversariais com o GGUF.

## 3. Critérios de medição e limites

**Cobertura que a CI consegue afirmar agora:** presença dos contextos esperados, ausência de fontes não autorizadas, contenção de tool authority, fluxo com escopos OS reais, falha segura e orçamento do input; a suíte reporta cenários aprovados no output TAP. Uma falha reprova o gate.

**Ainda não medido (não usar como marketing nem release gate “aprovado”):**

- resposta factual fundamentada em fontes: acurácia, precisão de citação e taxa de alucinação do modelo real;
- escolha correta de intent, abstinência em apps ausentes e planejamento multi-etapas;
- latência p50/p95, tokens/s, CPU, memória, limite de hardware fraco e qualidade em português;
- variante executável Windows OrdaX Desktop, identidade física da sessão, persistência após reinício e atualização do app;
- indexação vetorial, geração de embeddings e RAG semântico efetivamente ativado.

**Próxima entrega F0:** executar as perguntas sintéticas e testes adversariais com **modelo local real em Windows físico autorizado** através da mesma porta e registrar resultados verificáveis por caso, mantendo o teste determinístico da CI como regressão de integridade do contexto. Não confundir o teste de ligação (concluível pela CI) com avaliação semântica física (pendente). Corrigir primeiro causas reais de falha; não criar um RAG paralelo ou habilitar `semantic_search_enabled` artificialmente.

## 4. Guardrails futuros

- A fixture é sintética, somente teste. Nunca usá-la como catálogo de apps, Memory, source lock, prompt de produção ou treinamento.
- Alterações em seleção de contexto, memory scopes, manifests, ações ou Identity/Space exigem regressões negativas acima, mesmo quando o modelo em teste parecer responder corretamente.
- `ordax.intelligence/1` permanece `toolExecution=false`, `authority=none`; testes de modelo não podem conceder acesso a ferramentas.
- Contratos/armazenamento/ativação pertencem ao OS; UI e confirmação à Aura; o Intelligence não modifica outras camadas. Sem aprovação de backend, sem embeddings e sem egress.
- Só atualizar F0 como **concluída integralmente** quando existir evidência de respostas reais do modelo, além da cobertura sintética.
