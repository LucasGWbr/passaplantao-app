-- Aplicar depois de 20261103 e 20261106. Preserva os registros existentes.
begin;
alter table public.itens_checklist
  add column if not exists cancelado_em timestamptz,
  add column if not exists cancelado_por text;

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
drop trigger if exists passagens_proteger_finalizada on public.passagens_plantao;
create trigger passagens_proteger_finalizada before update or delete on public.passagens_plantao
for each row execute function public.pp_proteger_passagem_finalizada();

-- Bloqueia alterações nos cuidados e pendências sem bloquear o recebimento.
-- O lock serializa as mudanças dos itens com a finalização do registro pai.
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
drop trigger if exists checklist_proteger_passagem on public.itens_checklist;
create trigger checklist_proteger_passagem before insert or update or delete on public.itens_checklist
for each row execute function public.pp_proteger_itens_passagem();
drop trigger if exists pendencias_proteger_passagem on public.pendencias;
create trigger pendencias_proteger_passagem before insert or update or delete on public.pendencias
for each row execute function public.pp_proteger_itens_passagem();

create or replace function public.pp_validar_recebimento_passagem()
returns trigger language plpgsql security definer set search_path = public as $$
begin
  if not exists (
    select 1 from public.itens_checklist i
    join public.passagens_plantao p on p.id = i.passagem_id
    where i.id = new.item_id and not p.rascunho and i.cancelado_em is null
  ) then raise exception 'Somente cuidados ativos de passagens finalizadas podem ser recebidos.';
  end if;
  return new;
end;
$$;
drop trigger if exists confirmacoes_validar_passagem on public.confirmacoes_checklist;
create trigger confirmacoes_validar_passagem before insert on public.confirmacoes_checklist
for each row execute function public.pp_validar_recebimento_passagem();
commit;
