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

## Gate de proveniência source-only (2026-11-01)

A verificação do arquivo de handoff passa a conferir a igualdade byte a byte de **ambos** os artefatos: tar e recibo JSON canônico. O verificador anterior comparava integralmente o tar, mas só `sha256` e `size` do recibo; alterações de `activationAuthorized` ou demais flags podiam escapar ao gate. Os testes negativos agora cobrem flags de ativação/modelo/motor, campos de procedência e extras, arquivo adulterado, alteração do source e symlinks em `src/`. O contrato OS, a ABI, o commit fixado do consumidor e o estado `integration-candidate` não mudam; nenhuma inferência real, release assinada ou cutover é declarada com essa prova.

## Remoção de manifest duplicado — SSOT (2026-11-01)

A auditoria identificou `docs/source-lock.json` no repositório Intelligence como um **manifest estático antigo**, contendo `origin_commit=45ab6648`, seis hashes de source e hashes de testes. Ele não era consumido pelos scripts de CI, empacotamento, builder nem pelos validadores do consumidor; competia conceitualmente com o pin atual no OS. Foi removido para que o único lock de origem efetivamente consumido permaneça em `ordax-os/docs/contracts/intelligence-source.json` (observado na `ordax-os/main` com `source_commit=a39c8ddcba1ac466a3697e03c20e0a8f186e4fc8`). O lock **distinto** do motor/modelo continua exclusivamente em `ordax-os/system/services/local-ai/source-lock.json`.

O gate `npm run check` agora reprova qualquer `source-lock.json` de primeira parte, inclusive sob `src/`, `docs/`, `tools/` ou a raiz, sem inspecionar o checkout de OS `_upstream`, dependências ou metadados gerados em `dist`. Testes negativos garantem a rejeição e a aceitação do lock no upstream. Nenhuma implementação de inferência, porta OS, hash consumido, builder, release ou regra de ativação foi modificada: `integration-candidate` segue sem cutover. A remoção de código ainda duplicado no **OS em execução** depende da transação canônica do owner do OS, não de apagar código de produto prematuramente.

## Bloqueio de redirecionamentos HTTP no cliente portátil (2026-11-01)

A validação do endpoint inicial (`127.0.0.1` HTTP literal ou a porta Native exata do OS) não impedia a semântica padrão de `fetch`, que segue respostas 3xx. Um backend em loopback ou broker comprometido poderia redirecionar health, descoberta de modelo ou a própria requisição contendo o prompt para outra origem. `src/local-ai/runtime.mjs` agora fixa `redirect: "error"` em **um único transporte comum** para health, `/v1/models`, completion buffered e SSE. Uma implementação de Fetch que ainda devolva `response.redirected=true` é rejeitada e tem o body cancelado; nenhum fallback de URL, proxy ou provedor foi adicionado.

`tests/upstream/test_local_ai_loopback_http.mjs` exercita redirecionamentos 307 entre **dois servidores HTTP reais no loopback**, exigindo zero requisições à segunda origem em todos os quatro caminhos, e cobre um adapter que ignora a opção e sinaliza resposta redirecionada. Essa prova confirma a política HTTP do cliente; não é inferência real com llama.cpp, atestação de motor, E2E físico nem alteração do `ordax-os` ativo. Promover os bytes ao OS exige atualizar seu único pin de origem e validar os gates do consumidor antes do cutover.

## Isolamento do source portátil no handoff (2026-11-01)

Auditoria de supply chain identificou assimetria: o empacotador recusava links simbólicos *dentro* de `src/`, mas seguia um `src/` que já fosse symlink; o checker arquitetural tratava esse link como arquivo e poderia aprovar sem analisar módulo algum. A coleta de módulos passou a ser compartilhada em `scripts/source-tree.mjs`, com rejeição da raiz não regular, de qualquer symlink interno e de árvore vazia. O `package.json`, o destino `dist/` e os caminhos de saída do tar/recibo também precisam ser caminhos regulares. A verificação dos arquivos de saída detecta inclusive symlinks quebrados, impedindo origem ou gravação fora da árvore autorizada.

A suíte cria diretórios externos simulados e tenta substituir a raiz, a metadata de pacote, a saída e subpastas por links; ambos os consumidores devem falhar fechados. Os scripts não adicionam locks ou validadores de política, não modificam source de inferência nem os oito blobs atualmente fixados no OS. Cutover, engine real, QEMU e hardware continuam pendentes de suas provas próprias.

## Limpeza de resposta HTTP tardia após abort (2026-11-01)

O `fetchWithTimeout` já liberava a chamada principal após timeout, cancelamento ou `dispose`, mas um adaptador Fetch não cooperativo podia retornar os cabeçalhos **depois** da rejeição por abort, quando `activeResponse` ainda era `null`. Nesse caso o corpo tardio nunca era cancelado, deixando recursos de transporte abertos. A correção observa a promessa de fetch em segundo plano **apenas para descarte**, cancela seu `body` caso o controlador já tenha abortado e nunca promove a resposta em resultado, altera rota ou repete inferência.

Duas regressões de adapter não cooperativo verificam: descoberta de modelo com timeout, sem sondagem de saúde tardia; inferência finalizada por `dispose`, sem resposta publicada nem retry. O teste consumidor contra o OS e o restante da CI portátil preservam os contratos e limites; o source atualizado continua sem cutover, release, motor ou modelo de produção ativado.

## SSE: descarte do corpo em rejeições iniciais (2026-11-01)

O leitor SSE anteriormente lançava erro na validação de `onDelta`, `modelId`, `content-type` e `content-length` antes de adquirir seu reader e instalar o `finally`; se a resposta já continha um corpo de stream aberto, ela não era cancelada. A mesma função agora descarta o corpo de forma não bloqueante quando a validação inicial falha, preserva o erro original e mantém o `finally` existente como único responsável pela limpeza após aquisição do reader. Testes com `ReadableStream` real verificam liberação exatamente uma vez, nenhum delta inválido, revalidação de health e acesso público direto à porta SSE. Esta é uma correção na fonte portátil de Intelligence; o OS ainda exige pin imutável e cutover próprio.

## Isolamento de observadores e cancelamento síncrono (2026-11-01)

Uma exceção síncrona em callback `subscribe()` era propagada a partir do `publish` em `src/local-ai/runtime.mjs`, podendo impedir `generate()` de entrar no `try` de inferência após publicar `busy` e deixar o port nesse estado. Em `src/intelligence/runtime.mjs`, a mesma exceção podia propagar até o produtor de inferência. Ambos agora usam uma única implementação de notificação tolerante a falhas em `src/snapshot-notification.mjs`: listeners não recebem autoridade sobre a transição, novos observadores não entram em notificações já iniciadas e inscrições removidas não são chamadas.

Há ainda um gate de vida após publicar `busy`, bloqueando o POST caso um observador tenha chamado `dispose()` sincronamente; um segundo gate antes de retornar o resultado impede publicar uma conclusão já descartada. Testes regressivos verificam callbacks que lançam erros, outros observers recebendo estado, ausência de requisição após `dispose`, rejeição de resultado após descarte e desinscrição durante evento.

**Integração:** `src/snapshot-notification.mjs` é uma dependência portátil nova, mantida neste repositório. Quando o owner do `ordax-os` promover a revisão, deverá incluir o novo arquivo no pin imutável do source Intelligence e no pacote consumido; não copiar apenas o runtime isoladamente. O lock canônico e o cutover do OS não são alterados por esta PR. A CI deste repositório prova o comportamento de ports vinculados aos validadores OS fixados, não ativação do motor ou execução em hardware.

## Gate de source pin completo e evolução sem manifesto duplicado (2026-11-01)

O verificador `scripts/verify-os-consumer-pin.mjs` continha uma lista fixa de **oito** caminhos, embora a introdução do módulo portátil `src/snapshot-notification.mjs` tenha ampliado o conjunto atual para **nove** arquivos (oito módulos `src/*.mjs` e o builder `tools/inference-builder/build.py`). O gate aprovava o pin histórico de oito, mas recusaria qualquer promoção correta do source graph com a dependência nova. Manter listas iguais no OS e no Intelligence também produziria dois inventários manuais concorrentes.

O verificador agora deriva **todos os módulos** de `git ls-tree -r -z` sobre o **commit imutável declarado pelo único lock do OS**, exige que cada arquivo rastreado em `src/` seja `.mjs` com caminho permitido, mais o builder de engenharia fixado, e compara o conjunto completo de caminhos e seus modos/hashes Git com `source_paths`. O lock histórico continua válido porque seu commit possui a árvore antiga; um futuro commit com `src/snapshot-notification.mjs` só passa se o OS fixar explicitamente o blob novo. Nenhum source extra, omitido, arquivo não-portável, link ou hash divergente passa silenciosamente.

Os testes geram repositórios Git temporários e provam: pin imutável antigo, módulo adicionado e pinado com sucesso, dependência omitida, caminho inventado, caminho inseguro e arquivo não-portável. A mudança é exclusivamente do **gate produtor**; não altera o pin do OS, o builder de modelo, o componente OS ativo, a autoridade de release ou a política de cutover. O owner do OS ainda deverá garantir que seus consumidores/materializadores aceitem exatamente a árvore e executar os gates de ativação e rollback.

## Paridade de autoridade em respostas completas e SSE (2026-11-01)

O `validatedBufferedCompletion` já rejeitava `message.tool_calls`, `message.function_call`, `choice.tool_calls` e `choice.function_call`, mas não verificava os campos `choice.tool_call_id`, `choice.refusal` e `choice.delta`. O leitor SSE proibia metadados de identidade de chamada/recusa no nível da escolha. Uma resposta buffered contendo texto mais esses campos podia ser aceita como conclusão consultiva apesar de transportar informação de autoridade adicional ou um fragmento SSE indevido.

O mesmo validador buffered agora recusa os três campos sempre que estiverem presentes, sem ampliar a autoridade de ferramentas nem exigir um segundo parser ou contrato. Os testes de loopback HTTP real exercitam as três variantes, exigem erro, ausência de retry e recuperação de estado saudável após a falha. O source lock e a ativação do OS não foram alterados; o owner OS deverá consumir o novo commit imutável no seu próprio cutover.

## Evidência terminal obrigatória em respostas buffered (2026-11-01)

A verificação de completion buffered rejeitava `finish_reason` diferente de `stop`, mas **aceitava o campo ausente**, embora a rota SSE só aprove conclusão com `finish_reason: stop` e `[DONE]`. Em caso de backend local interrompido, uma resposta JSON sem marcador terminal poderia promover texto parcial como resultado final. O modo buffered agora exige `finish_reason === "stop"` literalmente; `null`, ausência, `length` e razões de chamada de ferramenta não autorizam sucesso. O runtime mantém a revalidação de saúde após a rejeição, sem retry implícito e sem ampliar egress ou autoridade.

As simulações HTTP de respostas completas válidas foram atualizadas para respeitar o contrato OpenAI-compatible e duas regressões de loopback real cobrem marcador ausente e nulo. Testes CI de Node, compatibilidade com contratos OS fixados, Python e source-only handoff devem continuar verdes. Essa validação pertence ao produtor portátil; o único pin imutável do OS e o cutover continuam sob seu próprio owner.

## Isolamento do cache e saída do inference builder (2026-11-01)

`tools/inference-builder/build.py` resolvia `--out-dir` e `--cache-dir` diretamente com `Path.resolve()`, aceitando entradas simbólicas que podiam redirecionar escritas para fora dos diretórios explicitamente selecionados. O cache bare `llama.cpp.git` também seguia um symlink se seu destino tivesse `HEAD` regular; o caminho do GGUF podia reutilizar arquivo simbólico já com hash válido. A correção valida os componentes de cada diretório **antes** de resolver/usar o caminho, rejeita sobreposição entre cache e saída, recusa symlinks no mirror, `HEAD`, GGUF e `.part`, e exige raiz real também em `verify`. O conteúdo fixado ainda é comprovado pelos mesmos checks de hash/commit e os contratos e locks seguem exclusivamente no OS.

Regressões Python não precisam baixar modelo nem compilar `llama.cpp`: simulam diretórios externos, symlinks para mirror Git e GGUF, caminhos de output/cache sobrepostos, componentes pais simbólicos e verificação de artefato. Erros devem ocorrer **antes de qualquer download, execução Git ou escrita fora do local autorizado**. O builder não gera um artefato ativável e este trabalho não autoriza build USB, entrega assinada ou cutover.

## Validação de caminhos do modelo na fronteira shell/URL (2026-11-01)

O builder `tools/inference-builder/build.py` aceitava `model.filename` do único source lock do OS desde que não houvesse uma pasta no nome. Isso não impedia caracteres de expansão do shell, como `$()` e crases, e o mesmo nome era interpolado em aspas duplas no launcher `--model "$runtime_root/models/…"`. A origem `model.repository` também aceitava quase qualquer texto com `/`, incluindo parâmetros de URL e segmentos adicionais. Embora o source lock seja assinado/revisado pelo owner OS, estes campos precisam falhar fechados na fronteira técnica do builder, sem confiar em escape implícito.

Uma única rotina `validate_model_source_path()` agora exige nome literal de arquivo `.gguf` com caracteres alfanuméricos seguros, sem quebras de linha, aspas, expansões, caracteres de URL ou separadores de caminho, e uma origem Hugging Face no formato `owner/repository` (sem `..`, consultas nem fragmentos). Ela é invocada no carregamento do lock e novamente ao criar URL e launcher, de modo que chamadas diretas a esses produtores não contornem o gate. Testes Python usam variações maliciosas de nomes e repositórios sem rede nem modelo; o caso canônico atual continua válido. Não se alteram model ID, bytes GGUF, licença, contratos, release, OS source lock, builds físicos ou autorização de ativação.

## Integridade de provenance e arquivos de autoridade do builder (2026-11-01)

`source_commit()` aceitava um SHA-40 arbitrário vindo de `ORDAX_SOURCE_COMMIT`, sem provar que era o `HEAD` do checkout OS escolhido. Isso permitia ao recibo declarar um commit de origem diferente do realmente utilizado pelo builder. O commit de provenance agora é sempre obtido do Git HEAD real do checkout do OS; a variável, se presente, é apenas uma declaração verificada por igualdade, jamais substituta da prova.

`configure_os_source()` verificava somente se a raiz e os manifests finais eram links simbólicos: pastas intermediárias de `system/services/local-ai/` e `docs/contracts/` ainda podiam apontar para um local externo. O único controle de caminhos do builder agora rejeita raízes OS com pais simbólicos, manifests com quaisquer componentes simbólicos e a licença vendorizada com pais simbólicos. O `ROOT`, `SOURCE_LOCK` e `CONTRACT` globais são alterados somente depois de todas as verificações passarem.

O único helper de aquisição efetivamente usado pelo builder, `download_exact`, valida o diretório pai real antes da rede mesmo quando chamado isoladamente. O `download_bounded` não possuía nenhum consumidor no builder, no fluxo Windows ou na produção: foi removido junto com seus testes exclusivos, evitando manter um segundo caminho de download sem finalidade. Testes Python offline incluem divergência de commit declarado, pais simbólicos do OS, do cache e da licença, ausência de alterações fora da árvore e um download mockado válido. Não foi alterado o lock canônico, sua escolha de modelo, o build assinado, os contratos ou a autorização de cutover; não houve download de pesos nem build físico.

## Atestação de bytes efetivamente comprometidos no checkout do OS (2026-11-01)

A provenance de um build podia reportar um SHA do `HEAD` real e, ainda assim, consumir `system/services/local-ai/source-lock.json`, `docs/contracts/local-ai.json` ou a licença do modelo modificados no working tree. A integridade do commit do OS não atestava os *bytes concretos* dos três insumos críticos. O builder agora exige que `--os-source` seja a **raiz de um repositório Git próprio**, que os três arquivos sejam blobs regulares presentes no `HEAD` e que seus conteúdos em disco sejam byte a byte iguais à árvore Git imutável, antes de qualquer download/compilação; `verify` reaplica a mesma prova ao inspecionar o artefato. O recibo usa o commit que passou nessa atestação, e não um valor arbitrário do ambiente.

Testes offline criam um checkout Git temporário e comprovam aceitação dos insumos comprometidos, rejeição individual da alteração não comprometida do lock/contrato/licença e bloqueio de um diretório que usaria indevidamente o Git do seu pai. Removido também `download_bounded`, código morto sem consumidores, sem substituir pelo mesmo comportamento em outro local. Não foram alterados source lock, licença, seleção do modelo, autorizadores ou artefatos de release. O source pin canônico do OS e seu cutover continuam fora deste repositório.
