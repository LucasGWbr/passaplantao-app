# PassaPlantão — App Mobile (Sprint 1)

App em React Native (Expo) + Supabase para registro da passagem de plantão de enfermagem.

## O que já está pronto nesta sprint

- **Telas**: Login, Setores, Pacientes (por setor), Detalhes do paciente (última passagem + histórico + pendências), Nova passagem de plantão.
- **CRUD funcionando**:
  - **Create**: nova passagem de plantão + pendências.
  - **Read**: setores, pacientes, histórico de passagens, pendências.
  - **Update**: marcar pendência como concluída/pendente.
  - **Delete**: excluir pendência.
- **Autenticação** via Supabase Auth (email/senha), sessão persistida no dispositivo.

## 1. Criar o projeto no Supabase

1. Crie uma conta e um novo projeto em [supabase.com](https://supabase.com).
2. No painel do projeto, vá em **SQL Editor** → cole o conteúdo de `supabase/schema.sql` → **Run**.
   Isso cria as tabelas, as políticas de RLS e já insere um setor "UTI" e dois pacientes de exemplo.
3. Vá em **Authentication → Users → Add user** e crie um usuário de teste (email + senha).
4. Copie o **UUID** desse usuário (aparece na lista de usuários).
5. Volte ao **SQL Editor** e rode o bloco comentado no final de `schema.sql`, substituindo pelo UUID e email do usuário criado — isso cria o registro do profissional e vincula ele ao setor "UTI".
6. Em **Project Settings → API**, copie a **Project URL** e a **anon public key**.

## 2. Configurar o app

```bash
cp .env.example .env
```

Edite `.env` e cole a URL e a anon key do seu projeto Supabase:

```
EXPO_PUBLIC_SUPABASE_URL=https://SEU-PROJETO.supabase.co
EXPO_PUBLIC_SUPABASE_ANON_KEY=sua-anon-key-aqui
```

## 3. Instalar e executar

```bash
npm install
npx expo start
```

Escaneie o QR code com o app **Expo Go** (Android/iOS) ou pressione `a`/`i` no terminal para abrir num emulador.

Faça login com o email/senha do usuário que você criou no passo 1.

## Estrutura do projeto

```
App.js                          ponto de entrada
src/
  lib/supabase.js                cliente do Supabase
  context/AuthContext.js         sessão + dados do profissional logado
  navigation/AppNavigator.js     troca entre stack de login e stack principal
  screens/
    LoginScreen.js
    SetoresScreen.js
    PacientesScreen.js
    PacienteDetalhesScreen.js
    NovaPassagemScreen.js
supabase/schema.sql              schema completo do banco (rodar no Supabase)
```

## Próximos passos (sprints seguintes, conforme o roadmap)

- Tela de histórico geral (não só por paciente).
- Filtros e busca de pacientes.
- Tela de gestão de setores/pacientes (cadastro), hoje só via SQL/painel do Supabase.
- Testes de ponta a ponta e ajustes de usabilidade.
