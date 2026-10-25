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
