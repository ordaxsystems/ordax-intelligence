# Migração — gates de corte e proveniência

**Estado verificado em 2026-10-26:** a `main` do `ordax-intelligence` está no commit `c3dbb73e7f3cdf9a2043b059d7376fb0a06a1272`, fixado no contrato de source do `ordax-os`. As PRs Intelligence #1, #2 e #3 foram integradas. A evidência anterior da CI aprova **2 testes de fronteira + 71 regressões de compatibilidade** com os validadores reais do `ordax-os@45ab6648835744ad8ae85ee617a3b6e8418545e8`. Toda modificação posterior deve atualizar o source lock do OS em PR coordenada, jamais por pin flutuante.

O `ordax-os` já integrou [PR #2262](https://github.com/ordaxsystems/ordax-os/pull/2262), com `docs/contracts/intelligence-source.json` fixando commit e hashes Git de **oito** arquivos portáveis (sete arquivos de `src/` e `tools/inference-builder/build.py`). O verificador valida Git tree, staging isolado e recibo. A [PR #2263](https://github.com/ordaxsystems/ordax-os/pull/2263) **foi integrada em 2026-10-25** e monta a composição candidata substituindo cinco implementações antigas apenas numa árvore descartável. Nenhuma das duas PRs instala/ativa o motor, altera o boot efetivo ou conclui o cutover.

## Responsabilidade e limites

O novo repositório mantém cinco módulos extraídos do OS: Intelligence Core, Model Router, Local AI HTTP, streaming SSE e avaliação técnica de compatibilidade. As dependências são os validadores canônicos `ordax.intelligence/1`, `ordax.model-router/1`, `ordax.local-ai/1` fornecidos pelo OS; o produto não duplica a implementação de Identity, Memory, Space, ações, permissões, Supervisor, atualização ou rollback.

Os adapters OS retidos estão documentados em `docs/OWNERSHIP.md`. `bootstrap/local-ai-runtime/build.py`, `source-lock.json`, modelo fixado, seleção de payloads e assinatura continuam sob responsabilidade do OS até existir um artefato de inferência verificável e distribuível pelo mecanismo canônico.

## Provas realizadas (não confundir com release)

- Testes independentes: Node 22, pacote source-only determinístico e SHA-256 revalidado byte a byte na CI, sem motor nem pesos GGUF.
- Regressão do upstream: 71/71 testes comportamentais com os contratos originais do OS.
- Source Gate A no OS: commit Git exato + sete blobs verificados, modo seguro, sem symlinks/código extra, staging em diretório novo e testes negativos.
- Candidate Gate B no OS: montagem de *candidato* Native com wrappers que referenciam o Intelligence externo; prova de porta OS, ausência de acesso implícito a ferramentas e testes de integridade. Não confundir com ativação de um runtime instalado.
- A Surface visual permanece canônica em `ordax-surface`. Nenhuma dependência Alpine/APK foi introduzida.
- **Prova adicional em desenvolvimento nesta branch:** testes de loopback HTTP real (Node servidor-fixture + fetch), cobrindo geração buffered, SSE, cancelamento, ausência de modelo e rejeição de `tool_calls`, `function_call` e `finish_reason=length`. O arquivo `tests/upstream/test_local_ai_loopback_http.mjs` é executado por `npm run test:compat`. A correção correspondente em `src/local-ai/runtime.mjs` harmoniza a validação buffered com as restrições SSE. **Prova CI aprovada** em [Intelligence CI #40278286189](https://github.com/ordaxsystems/ordax-intelligence/actions/runs/40278286189): Node CI, regressões upstream, testes Python do builder, pacote source-only e sua verificação passaram. Loopback fixture não equivale a inferência real via llama.cpp.


## Extração adicional — builder técnico (ainda sem cutover)

O builder original `bootstrap/local-ai-runtime/build.py` foi adaptado para `tools/inference-builder/build.py`. Ele não mantém cópias de `source-lock.json`, licença ou contrato do OS: todas essas entradas são fornecidas explicitamente pelo consumidor. Os testes de contrato vêm do upstream OS pinado. Essa extração **não** desativa o builder ainda usado pelo OS e não demonstra recompilação real de llama.cpp; vide `docs/ENGINE-BUILD.md`.

## Provas de desempenho para hardware fraco

A ferramenta observacional `tools/benchmarks/local_http.py` registra latência e tokens/s pelo backend HTTP loopback e opcionalmente CPU/RSS via `/proc/PID`, sem controlar instalação ou modelo. Consulte `docs/BENCHMARKS.md`. A CI valida o harness somente com servidor-fixture; resultados de modelo em hardware real, cold-start, memória sistêmica e qualificação de perfis permanecem pendentes e não são inferidos de testes simulados.

## Bloqueadores de conclusão

1. **Coordenar com os owners Surface/Buildroot** e a PR #2243 (aberta/draft na consulta de 2026-10-26) antes de modificar o Supervisor, bootstrap USB ou os builders canônicos. A #2242 também exige revisão de conflitos por arquivo caso seu conteúdo seja reutilizado.
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
| Motor e modelo locais | Não comprovado nesta migração | Exige binário/peso pinados, ABI e métricas |
| Buildroot / QEMU / cold-health | Não comprovado para a distribuição final Intelligence | Exige mesmo artefato ativado |
| USB e hardware físico | Não comprovado | Exige prova em dispositivo e rollback |

O consumidor OS deve **reconciliar source lock e testes com o novo commit somente após CI**, e coordenar a mudança de consumo com a transação canônica do Supervisor; não deve substituir a implementação ativa por arquivos não verificados.

**Critério de conclusão:** um único proprietário do código de inferência; serviços e contratos sistêmicos preservados no OS; Consumer Native/Web operando a partir de uma revisão imutável; instalação inicial offline, health e rollback comprovados. Até lá, o status correto é **migração parcial validada, cutover de produção pendente**.
