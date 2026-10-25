# Artefato portátil — somente source (desenvolvimento)

O comando `npm run package` prepara `dist/ordax-intelligence-source-0.1.0-dev.0.tar` e `dist/receipt.json` de forma determinística usando apenas Node.js. `npm run package:verify` reconstrói o conteúdo e compara **todos os bytes**, SHA-256 e tamanho. O arquivo contém `src/**/*.mjs`, `package.json` e `manifest.json`, com hashes individuais. Nenhum engine, GGUF, token, chave ou binário da Base é incluído.

O recibo registra `activationAuthorized=false` e o pacote permanece `unsigned-source-handoff`. Esse fluxo é somente uma fonte versionável para consumo pelo pipeline verificado do OS. O OS mantém o único verificador de assinatura, slot/ativação, rollback, licença e ciclo de vida. Integrar os commits fixados e verificar a ABI Buildroot antes de qualquer artefato instalável. Nunca ativar um tar baixado sem atestação/autorização do OS.

As dimensões físicas, tempo de resposta, RAM/CPU, integridade da Base, QEMU e notebooks reais não foram medidos por esta CI. Não classificar pacote de source como inferência local funcional ou release de usuário.
