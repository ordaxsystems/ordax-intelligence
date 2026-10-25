# Migração e gates

**Situação: extração inicial implementada em branch, cutover pendente.** Fonte auditada em `ordax-os@45ab6648835744ad8ae85ee617a3b6e8418545e8`.

1. Auditoria inicial de implementação, documentos, PRs concorrentes e consumidores reais: feita.
2. Extração de cinco módulos existentes com validators públicos **injetados** e sem importação privada: preparada.
3. Pacote tar de source-only reproduzível, com hash SHA-256, tamanhos e recibo sem assinatura: preparado, mas NÃO autorizado como release ou ativação.\n4. Testes locais de fronteira e regressões reais do OS no CI: preparados; só declarar aprovados depois dos resultados.
5. Integrar módulo fixado ao OS/Native e atualizar registradores de componentes: **pendente**, exige conciliação com Surface.
6. Validar OS+SDK+Surface, testes de autorização/Memory, Web/Native, QEMU e hardware: **pendente**.
7. Remover os cinco módulos anteriores apenas após troca validada de imports; atualizar `docs/contracts/repository-ownership.json` e manifests: **pendente**.
8. Verificar binário real llama.cpp, ABI Buildroot, modelo exato, CPU/RAM e licenças: **pendente**.
9. Usar distribuição assinada, health, ativação e rollback do OS, nunca um atualizador paralelo: **pendente**.

PRs concorrentes no OS: #2242/#2243 alteram Buildroot/USB/Surface. Sem merge cruzado até reconciliação. Alpine/APK não são introduzidos neste projeto.

Os testes de origem foram transferidos para `tests/upstream/` com pequenas adaptações de import; preservam as verificações comportamentais do OS. `npm test` é local e independente, `npm run test:compat` requer o checkout exato no diretório `_upstream/ordax-os` (como na CI).
