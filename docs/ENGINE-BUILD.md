# Reproducible inference builder — source ownership

This component is the extracted **technical inference builder** from `ordax-os/bootstrap/local-ai-runtime/build.py`. The canonical model choice, full engine SHA and exact ELF hash/size, `ordax.local-ai/1` policy, model license text, and signing/activation remain **owned by OrdaX OS**, not copied here.

## Invocation

Run on a pinned, verified Linux x86_64 build runner with the OS source checkout and required native toolchain. The source lock must be `OS/system/services/local-ai/source-lock.json`; the versioned product contract is `OS/docs/contracts/local-ai.json`.

```sh
python3 tools/inference-builder/build.py \
  --os-source /path/to/verified/ordax-os \
  build --out-dir /tmp/ordax-local-ai-artifact --cache-dir /tmp/ordax-model-cache
python3 tools/inference-builder/build.py \
  --os-source /path/to/verified/ordax-os \
  verify --out-dir /tmp/ordax-local-ai-artifact
```

The CLI cannot silently select a different lock or use a copy within `ordax-intelligence`. It reads OS manifests and model license through the **explicit** `--os-source` directory, refusing missing or symlinked manifests. It checks the pinned upstream llama.cpp commit, exact static ELF SHA/size, GGUF SHA/size, CPU architecture, license, EROFS image/hash and runtime loopback policy. No credentials, model weights or engine executables belong in this Git repository.

## CI and promotion boundaries

The fast CI runs the adapted OS builder regressions with the exact OS checkout; it proves **lock validation and source-code behavior only**. It does **not** fetch ~563 MB of GGUF or compile llama.cpp and therefore makes no engine ABI, performance or physical run claim.

Before replacing the OS builder, extend the OS `docs/contracts/intelligence-source.json` with this Python source blob and include its hash in the verified cross-repo staging; then switch the single OS image builder in one coordinated cutover, running the existing real pinned-engine build, EROFS, QEMU, signature and rollback tests. Do not keep two builders active and do not create a second source lock, updater, keyring or release authority.

## Windows x64 candidate proof (non-activating)

`python tools/inference-builder/windows-candidate.py --os-source /path/to/exact/ordax-os --out-dir /new/output --cache-dir /cache`
runs only on a Windows x64 build runner with Visual Studio 2022 CMake support.
It reuses this repository's existing `build.py` source lock, Git mirror,
checkout and hash-verified GGUF download. It compiles the same upstream
`llama.cpp` revision for PE x64, runs a real local CPU completion, then
records exact EXE/DLL byte hashes in `candidate-receipt.json`. The receipt
is **unsigned, source-bound evidence only**, excludes model bytes, never
activates a service and cannot supersede the existing Linux ELF pin.
The OrdaX OS source lock is the sole authority for any future Windows
artifact hashes and distribution decision. Do not use CI output directly
as an executable OrdaX product without an OS-owned versioned trust gate.

### Reprodutibilidade PE (Windows MSVC)

No Windows, o linker MSVC normal gravou o tempo de build no cabecalho PE
(verificado em `llama-server.exe`). Isso invalida SHA-256 de artefato imutavel.
O target Windows usa `/Brepro` para executaveis e DLLs e o gate do CI
executa **duas builds independentes**, cada uma com inferencia GGUF real,
exigindo identidade exata dos oito pares `nome/tamanho/SHA256`.
Divergencia reprova CI e nunca altera o source lock automaticamente.
O OS deve republicar seus pins Windows apenas apos esta prova; a
distribuicao e ativacao continuam exclusivamente sob a autoridade do OS.

A primeira prova dupla da PR #12 mostrou que `/Brepro` sozinho nao basta:
`llama-server.exe` permaneceu byte-identico, mas todas as DLLs divergiram
entre diretorios temporarios diferentes. O compilador MSVC recebe agora
`/pathmap` para normalizar registros de caminho fonte/debug, alem do linker
reprodutivel. O log real do run 40644119781 revelou que MSVC ignora `/pathmap` sem
`/experimental:deterministic` (warning D9007). Ambos os flags agora sao
passados conjuntamente para C e C++; os hashes so podem ser promovidos
apos duas builds e duas inferencias reais aprovadas. Nenhum hash anterior
deve ser promovido por aproximacao.

A CI #40646618487 confirmou a origem da divergência nos hashes das DLLs:
sete DLLs variavam desde o timestamp/hash do cabeçalho PE, e a inspeção
binária mostrou caminhos absolutos do workspace temporário embutidos nas
strings `__FILE__` do próprio código C/C++ do upstream. A geração inicial
usava diretórios aleatórios diferentes a cada build; isso altera um insumo
do compilador. O builder agora usa um caminho de fonte/build canônico
**para cada uma de duas compilações independentes**, apaga integralmente
objetos/árvore entre elas e reprova se encontrar workspace já existente.
Continuam obrigatórios o modelo GGUF real, o commit fixado, oito arquivos
iguais nome/tamanho/SHA-256 e os flags MSVC de determinismo; não é
normalização posterior, edição de PE nem exceção do gate. Os recibos
continuam separados e sem autorização de ativação/distribuição.
