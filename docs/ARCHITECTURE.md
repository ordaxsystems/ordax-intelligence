# Arquitetura — OrdaX Intelligence

Motor reutilizável consultivo, Model Router e cliente de inferência HTTP/SSE são implementados aqui. Contratos públicos `ordax.intelligence/1`, `ordax.model-router/1` e `ordax.local-ai/1` pertencem ao `ordax-os` e são injetados na inicialização. Nenhum contrato de validação é duplicado na distribuição de produção.

O OS preserva **Identity, autorização, Memory canônica, Space/projeto, Action Gateway, Supervisor, Host Native, assinatura/ativação, atualização/rollback**. `ordax-platform` preserva OAuth/consentimento MCP remoto; `ordax-runtime`, execução de ações; `ordax-surface` e `ordax-apps`, interface Aura. Um modelo não pode conceder permissões.

## Aura, conhecimento de apps e RAG — fronteira de integração

A Aura consome o Intelligence, mas não incorpora uma segunda instância de inferência. As novas fases de entendimento de apps, RAG e planejamento têm um **único plano de execução neste repositório**: [INTELLIGENCE-001](plans/INTELLIGENCE-001-AURA-CONTEXTUAL-INTELLIGENCE.md).

A composição do OS **já contém** `system/services/intelligence/application-awareness.mjs`, `application-context.mjs`, `application-semantic-router.mjs` e `application-action-capabilities.mjs`, além de `system/services/memory/context.mjs` e `system/services/intelligence/semantic-retrieval.mjs`. Manifests `ai/manifest.json` verificados de `ordax-apps` seguem o contrato OS `ordax.app-intelligence-manifest/1`, com classes de origem/trust e action IDs; não criar um segundo parser, catálogo ou roteador autoritativo no Intelligence. O OS continua dono da recuperação com autorização estruturada **antes** de qualquer ranking.

O contrato `ordax.semantic-index/1` já descreve índice derivado e invalidável, mas `ordax-os/docs/contracts/semantic-index.json` declara **`semantic_search_enabled=false` e `embedding_generation_enabled=false`**. O Intelligence deve usar recuperação existente (lexical/contexto aprovado) e só consumir semântica/embeddings após um backend físico, hashes/licença e política OS comprovados. Planejamento de ações permanece consultivo; propostas precisam transitar por contratos OS separados, confirmação/grants e execução no Runtime. Nenhuma resposta do modelo, manifesto ou vetor concede autoridade.

## Observadores e descarte

Os snapshots dos ports Local AI e Intelligence são verificados pelos validadores do OS antes da publicação. Notificações a consumidores são consultivas: uma exceção síncrona em um observador não pode impedir mudanças de estado, interferir na inferência nem bloquear outros observadores. A notificação compartilhada é implementada exclusivamente em `src/snapshot-notification.mjs`; inscrições removidas durante uma publicação não são novamente chamadas. `dispose()` durante `busy` bloqueia o envio de novas requisições HTTP e `dispose()` durante a notificação de `ready` impede a aprovação tardia de uma resposta.

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

Serviço Intelligence, motor llama.cpp candidato e bytes do modelo GGUF têm ciclos de vida distintos. O serviço não bloqueia boot/Surface quando o motor está ausente. O cliente HTTP não inicia processos nem atualiza modelos. Antes de encaminhar `prompt` ou contexto ao port local, a Intelligence compara o `engineId`/`modelId` selecionado pelo router com o snapshot **atual e `ready`** da inferência; roteadores injetados ou desatualizados não podem acessar o backend errado. A identidade também é verificada após a geração, protegendo mudanças durante a execução. Toda requisição de health, descoberta de modelo e inferência (buffered/SSE) recusa redirecionamentos HTTP por meio de `redirect: "error"`, inclusive quando a origem inicial já foi limitada ao loopback. Respostas redirecionadas que um adapter de Fetch incorreto ainda reporte também são rejeitadas. Isso protege contra egress indireto a partir de um servidor local ou broker Native; não concede novas permissões. O transporte também cancela corpos HTTP devolvidos *tardiamente* por adaptadores que ignoram `AbortSignal` após timeout, cancelamento ou `dispose`, sem publicar a resposta tardia. O leitor SSE libera o corpo HTTP mesmo quando a validação inicial rejeita MIME, limite declarado, identidade de modelo ou sinal já cancelado, antes de adquirir o reader. O modo buffered também rejeita `choice.tool_call_id`, `choice.refusal` e `choice.delta` em respostas com `message`, alinhando o isolamento de autoridade com o parser SSE. Para concluir com sucesso, o modo buffered exige `choice.finish_reason === "stop"`, assim como o SSE exige `finish_reason: stop` e `[DONE]`; ausência ou valor `null` não comprovam término. `npm run test:compat` executa a regressão usando validadores do OS no commit fixado; CI não demonstra execução de inferência real, Base Buildroot, QEMU ou prova física.

### Modelo descoberto: confirmação atômica de identidade

A identidade dinâmica recebida em `GET /v1/models` é **provisória** até o `GET /health` retornar e a revisão da sondagem continuar válida. Enquanto a sondagem está pendente, `activeModelId` e o snapshot `ready` mantêm a mesma identidade já aprovada. Se uma geração começar nesse intervalo, sua revisão de atividade invalida a sondagem anterior, que não pode promover posteriormente uma identidade nova. O commit da identidade e a publicação do snapshot ocorrem juntos após a revalidação; falhas continuam fechadas e nenhum modelo externo é autorizado.

## Localidade regional na Aura (portabilidade sem segunda preferência)

O `ordax-os/system/composition/native/main.mjs` já passa `getLocale: () => preferenceStore.load()["regional.locale"] ?? "pt-BR"` à instância consultiva. A revisão antiga do produtor ignorava `getLocale`, de modo que um futuro cutover de source poderia deixar de respeitar o idioma configurado. O núcleo portátil agora aceita `getLocale` e **exige** que a vinculação `bindIntelligenceContracts()` injete também o `regionalLocalePreference` **canônico do OS**, de `system/services/preferences/regional.mjs`. Este é o único owner que valida valores permitidos; os nomes legíveis nos prompts são apenas apresentação para o modelo.

Exemplo de integração a ser realizado **pelo engenheiro do OS** durante seu cutover, sem mudar o pin por esta PR:

```js
import { regionalLocalePreference } from "./system/services/preferences/regional.mjs";
const { createIntelligenceRuntime } = bindIntelligenceContracts({
  intelligence, localAi, modelRouter, regionalLocalePreference,
});
const core = createIntelligenceRuntime({
  inferencePort: backend,
  getLocale: () => preferenceStore.load()["regional.locale"] ?? "pt-BR",
});
```

Sem `getLocale`, o runtime conserva o prompt padrão para consumidores antigos. Com `getLocale`, ausência do validador ou valor não autorizado causa erro **antes** de chamar `inference.generate`; não há fallback baseado no texto do usuário, SO ou localização inferida. A preferência é lida por pedido, sem cache, e não modifica `ordax.intelligence/1`, Identity, Memory, grants ou mecanismos de ação. O teste compat com checkout OS fixado valida a porta regional real. A integração física da Aura/Windows e a atualização do source pin seguem como gates exclusivos do OS.

## Limite estrutural dos dados contextuais no prompt local (F0)

O contrato do OS permite texto, ID e proveniência com quebras de linha e caracteres de controle Unicode relevantes para documentos. A montagem portátil anterior inseria esses campos sem escape; assim, texto de documento podia se apresentar como outro item de contexto, como "Intent:" ou "User request:". O produtor agora preserva o formato simples dos IDs normais, mas **escapa IDs e proveniência** e serializa cada `context.text` como **literal JSON de linha única**. As quebras `CR/LF/NEL/U+2028/U+2029` não criam novos delimitadores físicos, e colchetes/parênteses em IDs e proveniência não encerram labels. O pedido original do usuário permanece integral e no final.

A contabilidade do limite `LOCAL_AI_MAX_PROMPT_CHARS` é feita **depois do escape**, e trechos truncados são cortados em pontos de código Unicode, mantidos como strings JSON válidas com indicação explícita de truncamento. Dados insuficientes são omitidos com marcador em vez de ultrapassar o orçamento. O produtor não decide quais documentos ou apps são autorizados: seleção e escopo continuam exclusivamente no OS.

**Importante:** isso mitiga falsificação de **delimitadores estruturais**, não elimina prompt injection semântico dentro de conteúdo autorizado, nem concede autoridade ao modelo. A versão Native já instalada no OS continua independente até o source pin/cutover do owner OS; não afirmar que o produto Windows recebeu este código antes de sua adoção real.

## Distribuição equilibrada do orçamento de contexto (INTELLIGENCE-001 F0)

A composição Native do OS acrescenta memória autorizada e depois conhecimento verificado de aplicativos. O OS determina **quais** itens podem ser vistos e sua ordem; o Intelligence não cria catálogo, ranking semântico, concessões ou seleção por confiança. Porém o produtor anteriormente consumia o limite de prompt sequencialmente, cortando o primeiro item longo e descartando todos os posteriores, inclusive projeções de apps presentes.

O produtor agora mede o custo de cada item **após a serialização segura** e, quando a soma excede o orçamento, aplica um limite equilibrado (*water-filling*) de comprimento por item. Contextos curtos permanecem integrais e liberam espaço; os longos podem ser truncados com indicação explícita. A **ordem original é preservada**. Se nem os metadados escapados couberem, o item pode ser omitido; um indicador de omissão é acrescentado quando houver espaço. Nunca se promete que todo item entrará sob um prompt de usuário quase no limite.

Essa política é agnóstica quanto a scopes/IDs: o rótulo `system` **não** cria prioridade nem autoridade no modelo. Filtros por owner, Space, versão, manifesto, e origem continuam exclusivamente no OS. Os testes ligados ao checkout do OS fixado verificam que documentos extensos não apagam o catálogo/intents autorizados, e que nenhum segredo de outro Space chega à inferência. Não é RAG semântico, recall perfeito nem melhoria de qualidade física já comprovada.
