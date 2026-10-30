# Migração — gates de corte e proveniência

**Estado verificado em 2026-10-26:** a referência canônica de código portátil consumida pelo OS é `ordax-intelligence@b1832239ca11e6ef6e0adf3f5a8c656b9d241fe6`, fixada na `main` do `ordax-os@b1d287b3deb1e3aca9b84d465ccd4d96ca6891a8` após a [PR OS #2282](https://github.com/ordaxsystems/ordax-os/pull/2282) (7/7 pipelines aprovados). O lock registra oito blobs exatos; somente o blob de `src/local-ai/completion-stream.mjs` mudou em relação ao pin anterior `9791ae47`. A `main` do Intelligence pode evoluir em documentação/ferramentas sem alterar esses blobs, mas a montagem do OS **nunca** consome `main` flutuante. O estado segue `integration-candidate`, com ativação e cutover proibidos. As 71 regressões antigas são evidência histórica, não substituem a CI atual.

O `ordax-os` já integrou [PR #2262](https://github.com/ordaxsystems/ordax-os/pull/2262), com `docs/contracts/intelligence-source.json` fixando commit e hashes Git de **oito** arquivos portáveis (sete arquivos de `src/` e `tools/inference-builder/build.py`). O verificador valida Git tree, staging isolado e recibo. A [PR #2263](https://github.com/ordaxsystems/ordax-os/pull/2263) **foi integrada em 2026-10-25** e monta a composição candidata substituindo cinco implementações antigas apenas numa árvore descartável. Nenhuma das duas PRs instala/ativa o motor, altera o boot efetivo ou conclui o cutover. A [PR OS #2277](https://github.com/ordaxsystems/ordax-os/pull/2277) foi **integrada em 2026-10-26** após 7/7 pipelines aprovados, atualizando o source lock para `9791ae4734d8f111490fe1ad8e815752b35d661a` e o hash exato do módulo `src/local-ai/runtime.mjs`. O status permanece `integration-candidate`, com ativação e cutover proibidos.

## Responsabilidade e limites

O novo repositório mantém cinco módulos extraídos do OS: Intelligence Core, Model Router, Local AI HTTP, streaming SSE e avaliação técnica de compatibilidade. As dependências são os validadores canônicos `ordax.intelligence/1`, `ordax.model-router/1`, `ordax.local-ai/1` fornecidos pelo OS; o produto não duplica a implementação de Identity, Memory, Space, ações, permissões, Supervisor, atualização ou rollback.

Os adapters OS retidos estão documentados em `docs/OWNERSHIP.md`. `bootstrap/local-ai-runtime/build.py`, `source-lock.json`, modelo fixado, seleção de payloads e assinatura continuam sob responsabilidade do OS até existir um artefato de inferência verificável e distribuível pelo mecanismo canônico.

## Provas realizadas (não confundir com release)

- Testes independentes: Node 22, pacote source-only determinístico e SHA-256 revalidado byte a byte na CI, sem motor nem pesos GGUF.
- Regressão do upstream: 71/71 testes comportamentais com os contratos originais do OS.
- Source Gate A no OS: commit Git exato + oito blobs verificados, modo seguro, sem symlinks/código extra, staging em diretório novo e testes negativos.
- Candidate Gate B no OS: montagem de *candidato* Native com wrappers que referenciam o Intelligence externo; prova de porta OS, ausência de acesso implícito a ferramentas e testes de integridade. Não confundir com ativação de um runtime instalado.
- A Surface visual permanece canônica em `ordax-surface`. Nenhuma dependência Alpine/APK foi introduzida.
- **Prova independente integrada na PR Intelligence #5:** testes de loopback HTTP real (Node servidor-fixture + fetch), cobrindo geração buffered, SSE, cancelamento, ausência de modelo e rejeição de `tool_calls`, `function_call` e `finish_reason=length`. O arquivo `tests/upstream/test_local_ai_loopback_http.mjs` é executado por `npm run test:compat`. A correção correspondente em `src/local-ai/runtime.mjs` harmoniza a validação buffered com as restrições SSE. **Provas CI aprovadas** em [Intelligence CI #40278286189](https://github.com/ordaxsystems/ordax-intelligence/actions/runs/40278286189): Node CI, regressões upstream, testes Python do builder, pacote source-only e sua verificação passaram. Loopback fixture não equivale a inferência real via llama.cpp.


## Extração adicional — builder técnico (ainda sem cutover)

O builder original `bootstrap/local-ai-runtime/build.py` foi adaptado para `tools/inference-builder/build.py`. Ele não mantém cópias de `source-lock.json`, licença ou contrato do OS: todas essas entradas são fornecidas explicitamente pelo consumidor. Os testes de contrato vêm do upstream OS pinado. A [CI OS Local AI #40278665329](https://github.com/ordaxsystems/ordax-os/actions/runs/40278665329) **compilou duas vezes o backend llama.cpp real, verificou EROFS byte a byte e executou inferência com modelo GGUF pinado** (8 tokens observados). Isso prova inferência real em runner Ubuntu, **não** instalação ativa no OrdaX, RAM/CPU do notebook, ABI Buildroot, desempenho homologado ou que a implementação antiga possa ser removida. Vide `docs/ENGINE-BUILD.md`.

## Provas de desempenho para hardware fraco

A ferramenta observacional `tools/benchmarks/local_http.py` registra latência e tokens/s pelo backend HTTP loopback e opcionalmente CPU/RSS via `/proc/PID`, sem controlar instalação ou modelo. Consulte `docs/BENCHMARKS.md`. A CI da [PR Intelligence #6](https://github.com/ordaxsystems/ordax-intelligence/pull/6) aprovou o harness com servidor-fixture e integrou a ferramenta; resultados comparáveis de modelo em **hardware fraco real**, cold-start, memória sistêmica e qualificação de perfis permanecem pendentes.

## Fechamento da fronteira SSE para texto consultivo

A implementação portátil `src/local-ai/completion-stream.mjs` agora recusa `delta.tool_call_id`, `delta.refusal`, campos de autoridade no `choice` e `delta.role` diferente de `assistant` (inclusive vazio/nulo). Antes, alguns desses campos eram ignorados pelo parser SSE, embora a geração buffered já adotasse uma fronteira mais estrita. O teste HTTP loopback em `tests/upstream/test_local_ai_loopback_http.mjs` cobre oito variações e exige ausência de deltas provisórios. Isso **não** autoriza ferramentas, acesso a arquivos ou execução de ações; apenas mantém resposta consultiva e rejeita envelopes inesperados.

A [PR OS #2282](https://github.com/ordaxsystems/ordax-os/pull/2282) integrou o hash exato após aprovar os sete pipelines. A CI `test:consumer` valida agora o lock integrado em `ordax-os@b1d287b3deb1e3aca9b84d465ccd4d96ca6891a8`, sem aceitar fonte flutuante. O source continua `integration-candidate`, sem habilitar cutover, publicação ou boot da Base Buildroot. Mantenha os contratos no OS e os oito blobs no seu único lock.

## Evolução independente do source portátil sem ativação implícita

O gate `npm run test:consumer` valida o **commit Git imutável e os oito blobs**
referenciados pelo lock único do `ordax-os`, não os arquivos de trabalho
da revisão `HEAD` do Intelligence. A revisão atual do Intelligence continua
passando por `npm run ci`, regressões de compatibilidade e verificação do pacote
source-only; uma nova implementação nesta revisão pode avançar sem modificar
o snapshot antigo que o OS realmente consome.

O gate exige ancestralidade do pin na revisão atual, modo Git regular
(`100644`/`100755`), bytes/hash exatos no commit fixado, contrato de
ports e flags de ativação fechadas. Symlinks, submódulos, hashes divergentes
e alterações locais do lock OS são rejeitados. Atualizar a versão
efetivamente consumida exige uma PR no OS para promover o **único**
`docs/contracts/intelligence-source.json` e passar seus gates canônicos;
nenhuma aprovação desta CI autoriza cutover, publicação, gravação de USB
ou inferência em hardware real.

## Prevenção de drift entre repositórios

A CI independente verifica o commit fixado do OS em `.github/workflows/ci.yml` e executa `npm run test:consumer` contra o **único** `docs/contracts/intelligence-source.json` no checkout de OS. O gate confirma os três ports, os oito Git blobs (arquivo atual e tree do commit referenciado), ancestralidade do pin, flags não ativantes e checkout OS sem alteração local do lock. A revisão do OS é *imutável* em cada execução, mas deve ser deliberadamente reconciliada quando contratos canônicos mudarem; nunca substituir pelo `main` flutuante. Esse gate é source-only, sem afirmar boot, instalação ou assinatura.

## Deadline de inferência: adaptadores HTTP não cooperativos (candidato)

A rotina `src/local-ai/runtime.mjs` precisava esperar que `fetch()`,
`reader.read()`, `reader.cancel()` ou um adaptador `json()` retornassem após
`AbortSignal`. Um adaptador defeituoso pode ignorar o cancelamento e manter
a consulta buffered ou a descoberta de modelo suspensa, mesmo depois do prazo
estourar. A implementação portátil agora faz `Promise.race` entre **todo o
trabalho HTTP** (headers e consumo) e o sinal de cancelamento do Supervisor,
mantendo o mesmo prazo original; o cancelamento do reader é **best effort
não bloqueante**, com listeners removidos após a operação. Não existe retry
silencioso ou autorização de ferramentas.

A suíte `tests/upstream/test_local_ai_noncooperative_abort.mjs` exercita
HTTP sem resposta, leitor preso, `cancel()` que nunca termina, fallback
`json()` de fixture, `dispose()` e cancelamento isolado da chamada.
Tudo é testado com adaptadores sem rede externa. Isso não demonstra
cancelamento de *cálculo* do llama.cpp no servidor, somente encerramento
local seguro da espera. O consumidor OS atualizou o **único source lock** na [PR #2293](https://github.com/ordaxsystems/ordax-os/pull/2293), integrada no commit `3eb97a47e93aca294eaaf1e3597b3c98f4aebe0b` após **7/7 gates aprovados**. A CI independente valida agora esse commit exato, sem antecipar o cutover.

## Bloqueadores de conclusão

1. **Coordenar com os owners Surface/Buildroot** e a PR OS #2243 (aberta/draft na consulta de 2026-10-26) antes de modificar o Supervisor, bootstrap USB ou os builders canônicos. A #2242 também exige revisão de conflitos por arquivo caso seu conteúdo seja reutilizado. O workflow de candidato local-AI na `main` OS ainda inclui uma prova complementar em rootfs Alpine; ela precisa ser substituída por prova da Base Buildroot real antes do cutover, sem enfraquecer o gate.
2. Integrar a montagem verificada do Intelligence **na mesma transação** que o OS já usa para stage, build, release, boot offline, ativação e rollback, em Owner/Development e Stable/MVP. Nenhum segundo atualizador.
3. Garantir que imports Native/Web/SDK apontem para o source externo **na árvore publicada**, sem fallback para uma segunda implementação. Executar regressões completas de Identity/Space/Memory, Web/Native e todos os contratos públicos.
4. Remover, no **mesmo cutover validado**, os cinco módulos de implementação ainda rastreados no OS e atualizar `repository-ownership.json`, manifests, docs e testes. Os adapters OS de segurança e composição permanecem.
5. Executar inferência com o binário real do motor e modelo fixado, incluindo validação da ABI Buildroot, CPU/RAM, streaming e cancelamento; comprovar QEMU, health/rollback e teste físico de USB/notebook separadamente.
6. Para distribuição de componentes independente, cumprir assinatura e ativação do canal canônico. O tar atual `unsigned-source-handoff` jamais pode ser ativado como release.

## Matriz de evidências (não intercambiáveis)

| Camada | Evidência disponível | Limite |
| --- | --- | --- |
| Contratos / fonte portátil | CI anterior e Gate A/B integrados no OS | Sem ativação de serviço instalado |
| HTTP loopback com servidor-fixture | Testes aprovados pela CI #40278286189 (servidor-fixture) | Sem inferência `llama.cpp` real |
| Motor e modelo locais | Inferência real com GGUF pinado + EROFS reprodutível em CI OS #40278665329 | Sem ABI Buildroot, medição de hardware fraco ou serviço instalado no OS |
| Buildroot / QEMU / cold-health | Creator Owner QEMU offline e gates de candidato passaram na PR OS #2277 | Sem promoção da Base final Buildroot nem ativação do Intelligence no mesmo slot |
| USB e hardware físico | Não comprovado | Exige prova em dispositivo e rollback |

O consumidor OS **já reconciliou** o source lock e os testes com o commit `9791ae47` após a CI, na PR #2277. Para futuras alterações de módulos fixados, repetir o pin de commit + hashes sob gates equivalentes, sem mudar a autoridade. A transação canônica do Supervisor e os testes de ativação/rollback no artefato Buildroot final continuam obrigatórios; não substituir a implementação ativa apenas porque a CI candidata passou.

**Critério de conclusão:** um único proprietário do código de inferência; serviços e contratos sistêmicos preservados no OS; Consumer Native/Web operando a partir de uma revisão imutável; instalação inicial offline, health e rollback comprovados. Até lá, o status correto é **migração parcial validada, cutover de produção pendente**.

## Windows x64 — alvo técnico de prova, não cutover (2026-10-28)

`tools/inference-builder/windows-candidate.py` é o alvo Windows do builder técnico
de inferência já extraído: importa diretamente `build.py` para obter **o mesmo**
`source-lock.json`, commit `llama.cpp`, download exato e SHA-256 do modelo GGUF.
Não cria uma segunda escolha de engine/modelo, modelo padronizado, API de
produto, processo de fundo ou atualização de componentes.

A workflow `windows-inference-candidate.yml`, em runner Windows x64,
compila o commit aprovado com CMake/MSVC; exige a versão executável
correspondente ao commit exato, biblioteca(s) do build, modelo GGUF
exatamente validado e uma requisição real `/v1/chat/completions` com
motor CPU/loopback, chave temporária privada e texto não vazio. Produz
recebimento com hashes individuais de EXE/DLLs e modelo fixado, além
de flags **`activation_authorized=false`**, **`signed_release=false`**
e **`model_bytes_included=false`**. Nunca tratar isso como release.

**Não concluído:** gravar hashes do binário Windows no lock do **OS** após
prova reproduzível, obter pacote de modelo e motor verificável e
efetivamente montar o host Electron Native `ordax.local-ai/1` com supervisor,
segredo não exportado ao renderer, health, cancelamento, atualização e rollback.
Até esse cutover e o E2E físico do .exe, a Aura Windows deve continuar
`unavailable` sem fallback online implícito. Não alterar USB Dev #2243.
