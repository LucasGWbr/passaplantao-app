# Aplicação das mudanças do Supabase

1. Se a coluna `pacientes.ativo` ainda não existir no banco, aplique primeiro `20261028_pacientes_ativo.sql`. Antes da migração nova, verifique se há mais de um paciente ativo ocupando o mesmo leito textual:

```sql
select setor_id, lower(trim(leito)) as leito, count(*)
from public.pacientes
where ativo = true and nullif(trim(leito), '') is not null
group by setor_id, lower(trim(leito))
having count(*) > 1;
```

Se a consulta retornar linhas, resolva as duplicidades de ocupação antes de prosseguir.

2. No Supabase, abra **SQL Editor**, cole e execute `20261103_leitos_checklist.sql`. A migração preserva a coluna de texto `pacientes.leito`, cria os registros normalizados em `leitos`, relaciona os pacientes e ativa RLS nas tabelas novas.

3. Execute `20261105_pacientes_identificacao_dependencia.sql` no **SQL Editor** do Supabase. Essa migração:
   - Adiciona os novos campos de identificação do paciente: `cpf`, `data_nascimento`, `prontuario`, `nome_mae`, `genero`.
   - Adiciona o campo `nivel_dependencia` (Escala de Fugulin / Perroca - COFEN) para classificação do grau de cuidados.
   - Adiciona a coluna `nivel_acesso` na tabela `profissionais` e a função `pp_usuario_pode_gerenciar_usuarios()` para controle de permissões por nível de segurança.
   - Remove a trava bloqueante de novas passagens de plantão, garantindo fluxo ágil para a equipe.

4. Publique a função segura usada para convidar usuários e gerenciar funcionários (código completo disponível em `supabase/functions/gerenciar-funcionarios/index.ts`):

```bash
supabase functions deploy gerenciar-funcionarios
```

Ela usa as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` disponibilizadas no ambiente das Supabase Edge Functions. A chave de serviço fica somente no servidor e não deve ser adicionada ao app mobile.
*Nota*: O aplicativo mobile possui fallback automático direto para consultas ao banco caso a Edge Function ainda não tenha sido implantada.

5. Abra a versão mobile atualizada. As telas de pacientes, detalhes, formulário de cadastro e gestão de usuários já estão integradas com as novas regras e campos.

## Fichas de passagem e rascunhos

Antes de usar os formulários FOR 004 (clínica/cirúrgica) e FOR 005 (obstetrícia), execute database/20261106_ficha_passagem_parcial.sql no SQL Editor do Supabase. A tela permite salvar um rascunho durante o plantão e concluir a passagem depois. Campos opcionais permanecem vazios até serem informados.


## Finalização definitiva e cuidados unificados

Execute `20261108_finalizacao_passagem.sql` após as migrações de checklist e fichas. A migração bloqueia edição e exclusão de passagens finalizadas e alterações nos seus itens, preservando confirmações de recebimento em separado. Registros antigos com `rascunho = false` também ficam protegidos.

Os novos cuidados são cadastrados somente no formulário da passagem. Pendências antigas continuam visíveis para preservar o histórico. Confirmar recebimento não significa concluir a tarefa. O formulário por etapas permanece como melhoria futura.

### Correção de tipos na proteção de passagens

Se `pp_profissional_atual()` retorna UUID no banco existente, execute `20261108_fix_tipos_profissional.sql` no SQL Editor. Corrige as comparações de autoria nas duas funções de proteção, sem alterar dados. O erro pode aparecer tanto ao salvar cuidados quanto ao desfazer uma criação que falhou. A migração de finalização original também foi corrigida para novas instalações.

## Painel de gerente/administrador e preservação de dados

Esta versão usa `profissionais.nivel_acesso` para autorizar gestão. `funcao` é apenas a ocupação profissional. Gerente e administrador têm acesso aos mesmos cadastros; perfis assistenciais não têm acesso ao painel.

1. No SQL Editor execute **20261109_administracao_historico.sql**, após as migrações de finalização anteriores. O script usa as chaves UUID do esquema informado, cria `funcoes`, `quartos`, `leitos.quarto_id` e os indicadores `ativo` que faltavam. Substitui as policies das tabelas do app, removendo permissões antigas com `USING (true)` para escrita. Não execute novamente o schema inicial antigo sobre esse banco.
2. Para o primeiro administrador, crie o login com email e senha em **Authentication > Users > Add user** no Supabase (ou use um login existente). Execute **20261109_primeiro_admin.sql** e, separadamente, `select public.pp_configurar_primeiro_admin('EMAIL_REAL_DO_ADMIN');`. Essa função só pode ser executada pelo proprietário do banco, não pelo app; ela cria/vincula o perfil sem redefinir senha e não funciona se já houver um gerente/administrador ativo. Se já houver, entre com ele e use o painel.
3. Publique a função incluída neste repositório: `supabase functions deploy gerenciar-funcionarios`. Ela usa os secrets nativos `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY`. A service role nunca vai para o app.
4. Saia e entre novamente no app. Na seleção de setores, abra **Painel de administração**. Cadastre setores, funções, quartos e leitos; em **Funcionários e acessos**, escolha a função, setores, nível de acesso e senha inicial. O cadastro cria um login real; não envia convite por email. Nunca informe senhas em SQL ou commit.
5. A criação do acesso Auth e a gravação do perfil são serviços separados: o perfil e os vínculos são transacionais no RPC. Se a gravação do perfil falhar depois da criação Auth, a conta é preservada e bloqueada. Corrija esse caso pelo painel do Supabase antes de repetir o cadastro com o mesmo email.

### Dados preservados

Nenhuma ação do app usa DELETE. Rascunhos removidos são arquivados com `ativo = false`; funcionários, funções, setores, quartos e leitos são desativados e podem ser reativados. Vínculos antigos ficam com `ativo = false`. Itens cancelados e confirmações continuam no histórico. Passagens finalizadas permanecem imutáveis; uma mudança de visibilidade não altera o conteúdo clínico.

Triggers rejeitam DELETE e TRUNCATE nas onze tabelas do app, inclusive tentativas por cascata; as permissões de exclusão de usuários autenticados também são revogadas. Isso não substitui backup e não impede que o proprietário do banco remova deliberadamente os próprios mecanismos de proteção. Os usuários do painel não recebem esses poderes.

O banco bloqueia a desativação do último gerente/administrador ativo, quartos com leitos ativos, setores com ocupação ou estrutura ativa e funções usadas por funcionários ativos. Quartos só podem conter leitos do mesmo setor.

### Carregamento de funcionários e erros da função

A listagem de funcionários, setores e funções agora é consultada diretamente com a sessão e RLS, sem depender da Edge Function. Os catálogos carregam independentemente. O cadastro de login continua exclusivamente no backend; não existe fallback de escrita.

Publique o código **e a configuração** atualizados usando `supabase functions deploy gerenciar-funcionarios --no-verify-jwt`. A validação legada do gateway fica desabilitada; a função valida obrigatoriamente o token pelo Supabase Auth com `auth.getUser(token)` e confirma o nível de acesso ativo no banco antes de qualquer operação. Isso permite os novos tokens assinados com chaves assimétricas sem tornar o cadastro público.

A mensagem exibida no app agora inclui o motivo retornado: 401 (sessão/token), 403 (perfil sem acesso), 404 (função não publicada) ou erro de banco/serviço. Se não houver setores ativos, cadastre ou reative um setor no painel. Matrícula é opcional, conforme o esquema do banco.
