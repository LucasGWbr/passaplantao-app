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

