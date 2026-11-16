# CronoSport — Corrida e Natação

## Funcionalidades desta versão
- Duas áreas independentes: Corrida e Natação.
- Cada modalidade tem sua própria competição, lista de participantes e classificação.
- O botão **INICIAR TODOS** inicia a contagem de todos os participantes daquela modalidade.
- O botão **CHEGOU** encerra somente o tempo do participante selecionado. Os demais continuam contando.
- O cronômetro individual permanece congelado depois da chegada.
- Dados e eventos são guardados localmente no navegador/aplicativo.
- Backup JSON e estrutura inicial de PWA.

## Testar no computador
1. Instale Node.js LTS.
2. Abra a pasta do projeto no terminal.
3. Execute `npm install`.
4. Execute `npm run dev`.
5. Abra o endereço mostrado pelo Vite.

## Instalar como aplicativo no Android (APK)
Esta pasta está preparada para empacotamento Android com Capacitor, mas o APK ainda precisa ser compilado no Android Studio:
1. Instale Android Studio e o Android SDK.
2. Na pasta do projeto, execute `npm install`.
3. Execute `npm install @capacitor/android`.
4. Execute `npm run build`.
5. Execute `npx cap add android` (somente na primeira vez).
6. Execute `npx cap sync android`.
7. Execute `npx cap open android`.
8. No Android Studio, aguarde a sincronização do Gradle e escolha **Build > Build Bundle(s) / APK(s) > Build APK(s)**.
9. O Android Studio mostrará o caminho do APK gerado.

Para instalar no celular, transfira o APK para o Android e autorize a instalação desse arquivo, conforme as configurações do aparelho.

## Observações importantes
- O projeto ainda não inclui o diretório Android gerado nem um APK compilado. É necessário Android Studio/SDK para gerar o APK.
- A integração de sincronização e autenticação do Supabase ainda não está concluída.
- Para provas oficiais, ainda é necessário validar o cronômetro nativo, recuperação após encerramento inesperado, sincronização e testes de precisão. Esta versão é uma etapa de desenvolvimento, não deve ser usada como sistema oficial de arbitragem.
