-- Execute no SQL Editor do Supabase para manter pacientes encerrados no histórico.
alter table public.pacientes
  add column if not exists ativo boolean not null default true;

-- Registros anteriores continuam disponíveis na lista de ativos.
update public.pacientes
set ativo = true
where ativo is null;
