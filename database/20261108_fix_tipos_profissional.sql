-- Corrige comparações quando pp_profissional_atual() retorna UUID ou texto.
-- Aplicar no SQL Editor após 20261108_finalizacao_passagem.sql.
-- Não altera dados nem o tipo de retorno da função existente.
begin;

create or replace function public.pp_proteger_passagem_finalizada()
returns trigger language plpgsql set search_path = public as $$
begin
  if old.profissional_id::text is distinct from public.pp_profissional_atual()::text then
    raise exception 'Somente o autor pode alterar o rascunho.';
  end if;
  if not old.rascunho then
    raise exception 'Passagem finalizada: registro disponível somente para consulta.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  if new.profissional_id is distinct from old.profissional_id
     or new.paciente_id is distinct from old.paciente_id then
    raise exception 'Não é permitido alterar o paciente ou o autor da passagem.';
  end if;
  if old.rascunho and not new.rascunho then new.data_hora := now(); end if;
  return new;
end;
$$;

create or replace function public.pp_proteger_itens_passagem()
returns trigger language plpgsql security definer set search_path = public as $$
declare
  passagem text;
  autor text;
  em_rascunho boolean;
begin
  if tg_op = 'DELETE' then passagem := old.passagem_id::text;
  else passagem := new.passagem_id::text;
  end if;
  if tg_op = 'UPDATE' and new.passagem_id is distinct from old.passagem_id then
    raise exception 'Não é permitido transferir itens entre passagens.';
  end if;
  select p.rascunho, p.profissional_id::text into em_rascunho, autor
  from public.passagens_plantao p where p.id::text = passagem for update;
  -- Permite somente a cascata de exclusão de um rascunho autorizado.
  if not found and tg_op = 'DELETE' then return old; end if;
  if em_rascunho is distinct from true then
    raise exception 'Os cuidados de uma passagem finalizada não podem ser alterados.';
  end if;
  if autor is distinct from public.pp_profissional_atual()::text then
    raise exception 'Somente o autor pode editar os cuidados do rascunho.';
  end if;
  if tg_op = 'DELETE' then return old; end if;
  return new;
end;
$$;

commit;
