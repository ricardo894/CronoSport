# CronoSport — projeto unificado (etapa inicial)

Este pacote reúne a interface PWA, armazenamento local offline, formato de eventos e migração SQL inicial para Supabase.

## Executar a interface localmente
1. Instale Node.js LTS.
2. Extraia o ZIP e abra a pasta em um terminal.
3. Execute `npm install`.
4. Execute `npm run dev`.
5. Abra o endereço local exibido pelo Vite.

## Instalação no celular
A instalação como PWA exige publicar em HTTPS. No Android, abra o endereço publicado no Chrome e use “Instalar app” ou “Adicionar à tela inicial”. APK nativo ainda não está incluído nesta etapa.

## Conectar o backend
1. Crie um projeto Supabase.
2. Execute `supabase/migrations/0001_init.sql` no SQL Editor.
3. Copie `.env.example` para `.env` e preencha Project URL e anon/public key.
4. Ative autenticação para o operador.

Não coloque senha nem service_role key no frontend.

## O que funciona agora
- Interface do operador para corrida/natação.
- Número obrigatório, nome opcional.
- Iniciar todos e marcar chegada individual.
- Classificação por tempo.
- Eventos guardados localmente no IndexedDB.
- Indicador online/offline e exportação de backup.
- Consulta de espectador preparada para chamar RPC quando configurado.
- Service Worker com cache básico.

## O que ainda NÃO está concluído
- O fluxo de autenticação e criação/vínculo de competição no Supabase.
- A sincronização automática real da fila offline (o botão informa que a integração ainda será ligada).
- Atualização em tempo real do espectador via Supabase Realtime.
- Recuperação robusta do cronômetro após fechar/reiniciar o navegador.
- APK Android nativo e validação para uso em provas oficiais.

**Segurança:** nenhum software pode prometer fraude impossível. A base registra eventos imutáveis no banco e restringe alterações, mas precisa de revisão de segurança, testes e uso de relógio monotônico nativo antes de cronometragem oficial. O tempo medido no navegador nesta etapa é protótipo e não deve ser usado como resultado oficial.
