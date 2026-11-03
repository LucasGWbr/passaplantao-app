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

3. Publique a função segura usada para convidar usuários e gerenciar funcionários:

```bash
supabase functions deploy gerenciar-funcionarios
```

Ela usa as variáveis `SUPABASE_URL`, `SUPABASE_ANON_KEY` e `SUPABASE_SERVICE_ROLE_KEY` disponibilizadas no ambiente das Supabase Edge Functions. A chave de serviço fica somente no servidor e não deve ser adicionada ao app mobile.

4. Depois, instale/abra a versão mobile atualizada. As telas de leitos e funcionários e a nova relação de leitos dependem da migração já aplicada.
