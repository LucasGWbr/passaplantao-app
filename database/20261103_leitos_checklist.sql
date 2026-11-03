-- PassaPlantao: leitos, alta logica e checklist de passagem.
-- Aplicar no SQL Editor do Supabase antes de instalar a versao mobile correspondente.
-- O campo pacientes.leito (texto) e preservado durante a migracao para manter compatibilidade.

begin;

alter table public.pacientes
  add column if not exists ativo boolean not null default true,
  add column if not exists data_alta timestamptz,
  add column if not exists leito_id uuid;

alter table public.profissionais
  add column if not exists matricula text,
  add column if not exists ativo boolean not null default true,
  add column if not exists desativado_em timestamptz;
update public.profissionais set ativo = true where ativo is null;
alter table public.profissionais alter column ativo set default true;
alter table public.profissionais alter column ativo set not null;
create unique index if not exists profissionais_matricula_uidx
  on public.profissionais (matricula) where matricula is not null;

create table if not exists public.leitos (
  id uuid primary key default gen_random_uuid(),
  setor_id text not null,
  identificacao text not null,
  ativo boolean not null default true,
  criado_em timestamptz not null default now()
);

-- Ajusta setor_id ao mesmo tipo usado em setores.id, sem presumir UUID ou inteiro.
do $$
declare
  setor_tipo text;
begin
  select format_type(a.atttypid, a.atttypmod)
    into setor_tipo
  from pg_attribute a
  where a.attrelid = 'public.setores'::regclass
    and a.attname = 'id'
    and not a.attisdropped;

  if setor_tipo is null then
    raise exception 'Não encontrei public.setores.id';
  end if;

  execute format('alter table public.leitos alter column setor_id type %s using setor_id::text::%s', setor_tipo, setor_tipo);
  execute format('alter table public.leitos add constraint leitos_setor_id_fkey foreign key (setor_id) references public.setores(id) on delete restrict');
exception
  when duplicate_object then null;
end $$;

create unique index if not exists leitos_setor_identificacao_uidx
  on public.leitos (setor_id, lower(trim(identificacao)));
create index if not exists leitos_setor_ativo_idx on public.leitos (setor_id, ativo);

-- Cria registros de leito a partir dos textos já existentes e relaciona os pacientes.
insert into public.leitos (setor_id, identificacao)
select distinct p.setor_id, trim(p.leito)
from public.pacientes p
where nullif(trim(p.leito), '') is not null
on conflict do nothing;

update public.pacientes p
set leito_id = l.id
from public.leitos l
where p.leito_id is null
  and nullif(trim(p.leito), '') is not null
  and p.setor_id = l.setor_id
  and lower(trim(p.leito)) = lower(trim(l.identificacao));

do $$
begin
  if not exists (
    select 1 from pg_constraint
    where conname = 'pacientes_leito_id_fkey'
      and conrelid = 'public.pacientes'::regclass
  ) then
    alter table public.pacientes
      add constraint pacientes_leito_id_fkey
      foreign key (leito_id) references public.leitos(id) on delete restrict;
  end if;
end $$;
create index if not exists pacientes_leito_id_idx on public.pacientes (leito_id);
-- Impede duas internações ativas no mesmo leito; se houver duplicidade histórica,
-- resolva-a antes de aplicar esta migração (consulta no final do arquivo).
create unique index if not exists pacientes_um_ativo_por_leito_uidx
  on public.pacientes (leito_id) where ativo = true and leito_id is not null;

create or replace function public.pp_validar_leito_paciente()
returns trigger language plpgsql set search_path = public
as $$
declare
  leito_setor text;
  leito_ativo boolean;
begin
  if new.leito_id is null then return new; end if;
  select l.setor_id::text, l.ativo into leito_setor, leito_ativo
  from public.leitos l where l.id = new.leito_id;
  if leito_setor is null then raise exception 'Leito não encontrado.'; end if;
  if leito_setor <> new.setor_id::text then raise exception 'O leito pertence a outro setor.'; end if;
  if new.ativo and not leito_ativo then raise exception 'Não é possível atribuir um leito desativado.'; end if;
  return new;
end;
$$;
drop trigger if exists pacientes_validar_leito on public.pacientes;
create trigger pacientes_validar_leito before insert or update of leito_id, setor_id, ativo on public.pacientes
for each row execute function public.pp_validar_leito_paciente();

create or replace function public.pp_impedir_desativacao_leito_ocupado()
returns trigger language plpgsql set search_path = public
as $$
begin
  if old.ativo and not new.ativo and exists (
    select 1 from public.pacientes p where p.leito_id = old.id and p.ativo = true
  ) then raise exception 'Não é possível desativar um leito ocupado.'; end if;
  return new;
end;
$$;
drop trigger if exists leitos_impedir_desativacao_ocupado on public.leitos;
create trigger leitos_impedir_desativacao_ocupado before update of ativo on public.leitos
for each row execute function public.pp_impedir_desativacao_leito_ocupado();

-- Mantem historico antigo como ativo; novas altas devem gravar data_alta.
update public.pacientes set ativo = true where ativo is null;

create table if not exists public.itens_checklist (
  id uuid primary key default gen_random_uuid(),
  passagem_id text not null,
  descricao text not null check (length(trim(descricao)) > 0),
  prioridade text not null default 'rotina' check (prioridade in ('critico', 'atencao', 'rotina')),
  registrado_por text not null,
  registrado_em timestamptz not null default now(),
  atualizado_em timestamptz not null default now()
);

create table if not exists public.confirmacoes_checklist (
  item_id uuid not null references public.itens_checklist(id) on delete restrict,
  confirmado_por text not null,
  confirmado_em timestamptz not null default now(),
  primary key (item_id, confirmado_por)
);

-- Adapta as referencias ao tipo real das chaves existentes.
do $$
declare
  passagem_tipo text;
  profissional_tipo text;
begin
  select format_type(a.atttypid, a.atttypmod) into passagem_tipo
  from pg_attribute a
  where a.attrelid = 'public.passagens_plantao'::regclass
    and a.attname = 'id' and not a.attisdropped;
  select format_type(a.atttypid, a.atttypmod) into profissional_tipo
  from pg_attribute a
  where a.attrelid = 'public.profissionais'::regclass
    and a.attname = 'id' and not a.attisdropped;

  if passagem_tipo is null or profissional_tipo is null then
    raise exception 'Esperava encontrar passagens_plantao.id e profissionais.id';
  end if;

  execute format('alter table public.itens_checklist alter column passagem_id type %s using passagem_id::text::%s', passagem_tipo, passagem_tipo);
  execute format('alter table public.itens_checklist alter column registrado_por type %s using registrado_por::text::%s', profissional_tipo, profissional_tipo);
  execute format('alter table public.confirmacoes_checklist alter column confirmado_por type %s using confirmado_por::text::%s', profissional_tipo, profissional_tipo);

  if not exists (select 1 from pg_constraint where conname = 'itens_checklist_passagem_id_fkey' and conrelid = 'public.itens_checklist'::regclass) then
    alter table public.itens_checklist add constraint itens_checklist_passagem_id_fkey
      foreign key (passagem_id) references public.passagens_plantao(id) on delete cascade;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'itens_checklist_registrado_por_fkey' and conrelid = 'public.itens_checklist'::regclass) then
    alter table public.itens_checklist add constraint itens_checklist_registrado_por_fkey
      foreign key (registrado_por) references public.profissionais(id) on delete restrict;
  end if;
  if not exists (select 1 from pg_constraint where conname = 'confirmacoes_checklist_confirmado_por_fkey' and conrelid = 'public.confirmacoes_checklist'::regclass) then
    alter table public.confirmacoes_checklist add constraint confirmacoes_checklist_confirmado_por_fkey
      foreign key (confirmado_por) references public.profissionais(id) on delete restrict;
  end if;
end $$;

create index if not exists itens_checklist_passagem_idx on public.itens_checklist (passagem_id, registrado_em);
create index if not exists confirmacoes_checklist_item_idx on public.confirmacoes_checklist (item_id, confirmado_em);

-- SECURITY DEFINER evita depender da leitura direta de perfis na checagem RLS.
create or replace function public.pp_usuario_tem_setor(p_setor_id text)
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1
    from public.profissionais pr
    join public.profissional_setor ps on ps.profissional_id = pr.id
    where pr.auth_id = auth.uid()
      and pr.ativo = true
      and ps.setor_id::text = p_setor_id
  );
$$;

create or replace function public.pp_usuario_e_coordenacao()
returns boolean language sql stable security definer set search_path = public
as $$
  select exists (
    select 1 from public.profissionais pr
    where pr.auth_id = auth.uid()
      and pr.ativo = true
      and lower(trim(pr.funcao)) in ('coordenacao', 'coordenação', 'coordenador', 'coordenadora', 'supervisor', 'supervisora')
  );
$$;

create or replace function public.pp_profissional_atual()
returns text language sql stable security definer set search_path = public
as $$
  select pr.id::text from public.profissionais pr where pr.auth_id = auth.uid() and pr.ativo = true limit 1;
$$;

create or replace function public.pp_set_autoria_checklist()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  profissional_id text;
begin
  profissional_id := public.pp_profissional_atual();
  if profissional_id is null then raise exception 'Perfil profissional não encontrado'; end if;
  if tg_op = 'INSERT' then
    new.registrado_por := profissional_id;
    new.registrado_em := now();
  else
    if exists (select 1 from public.confirmacoes_checklist cc where cc.item_id = old.id) then
      raise exception 'Itens já confirmados não podem ser alterados; registre um novo item.';
    end if;
    new.registrado_por := old.registrado_por;
    new.registrado_em := old.registrado_em;
  end if;
  new.atualizado_em := now();
  return new;
end;
$$;

create or replace function public.pp_set_autoria_confirmacao()
returns trigger language plpgsql security definer set search_path = public
as $$
declare
  profissional_id text;
begin
  profissional_id := public.pp_profissional_atual();
  if profissional_id is null then raise exception 'Perfil profissional não encontrado'; end if;
  new.confirmado_por := profissional_id;
  new.confirmado_em := now();
  return new;
end;
$$;

-- A regra crítica também é aplicada no banco, mesmo se um cliente mobile a ignorar.
create or replace function public.pp_bloquear_passagem_com_critico_pendente()
returns trigger language plpgsql security definer set search_path = public
as $$
begin
  if exists (
    select 1
    from public.itens_checklist ic
    join public.passagens_plantao anterior on anterior.id = ic.passagem_id
    left join public.confirmacoes_checklist cc on cc.item_id = ic.id
  where anterior.paciente_id::text = new.paciente_id::text
      and ic.prioridade = 'critico'
      and cc.item_id is null
  ) then
    raise exception 'Confirme os itens críticos pendentes antes de registrar a próxima passagem.';
  end if;
  return new;
end;
$$;
drop trigger if exists passagens_bloquear_criticos_pendentes on public.passagens_plantao;
create trigger passagens_bloquear_criticos_pendentes before insert on public.passagens_plantao
for each row execute function public.pp_bloquear_passagem_com_critico_pendente();

drop trigger if exists itens_checklist_autoria on public.itens_checklist;
create trigger itens_checklist_autoria before insert or update on public.itens_checklist
for each row execute function public.pp_set_autoria_checklist();
drop trigger if exists confirmacoes_checklist_autoria on public.confirmacoes_checklist;
create trigger confirmacoes_checklist_autoria before insert on public.confirmacoes_checklist
for each row execute function public.pp_set_autoria_confirmacao();

alter table public.leitos enable row level security;
alter table public.itens_checklist enable row level security;
alter table public.confirmacoes_checklist enable row level security;

grant select, insert, update on public.leitos to authenticated;
revoke delete on public.leitos from anon, authenticated;
grant select, insert, update, delete on public.itens_checklist to authenticated;

drop policy if exists leitos_select_setor on public.leitos;
create policy leitos_select_setor on public.leitos for select to authenticated
using (public.pp_usuario_tem_setor(setor_id::text));
drop policy if exists leitos_insert_coordenacao on public.leitos;
create policy leitos_insert_coordenacao on public.leitos for insert to authenticated
with check (public.pp_usuario_e_coordenacao() and public.pp_usuario_tem_setor(setor_id::text));
drop policy if exists leitos_update_coordenacao on public.leitos;
create policy leitos_update_coordenacao on public.leitos for update to authenticated
using (public.pp_usuario_e_coordenacao() and public.pp_usuario_tem_setor(setor_id::text))
with check (public.pp_usuario_e_coordenacao() and public.pp_usuario_tem_setor(setor_id::text));
drop policy if exists leitos_delete_coordenacao on public.leitos;

drop policy if exists itens_checklist_select_setor on public.itens_checklist;
create policy itens_checklist_select_setor on public.itens_checklist for select to authenticated
using (exists (
  select 1 from public.passagens_plantao pp
  join public.pacientes pa on pa.id = pp.paciente_id
  where pp.id = passagem_id and public.pp_usuario_tem_setor(pa.setor_id::text)
));
drop policy if exists itens_checklist_insert_setor on public.itens_checklist;
create policy itens_checklist_insert_setor on public.itens_checklist for insert to authenticated
with check (exists (
  select 1 from public.passagens_plantao pp
  join public.pacientes pa on pa.id = pp.paciente_id
  where pp.id = passagem_id and public.pp_usuario_tem_setor(pa.setor_id::text)
));
drop policy if exists itens_checklist_update_setor on public.itens_checklist;
create policy itens_checklist_update_setor on public.itens_checklist for update to authenticated
using (exists (
  select 1 from public.passagens_plantao pp
  join public.pacientes pa on pa.id = pp.paciente_id
  where pp.id = passagem_id and public.pp_usuario_tem_setor(pa.setor_id::text)
))
with check (exists (
  select 1 from public.passagens_plantao pp
  join public.pacientes pa on pa.id = pp.paciente_id
  where pp.id = passagem_id and public.pp_usuario_tem_setor(pa.setor_id::text)
));
drop policy if exists itens_checklist_delete_setor on public.itens_checklist;
create policy itens_checklist_delete_setor on public.itens_checklist for delete to authenticated
using (exists (
  select 1 from public.passagens_plantao pp
  join public.pacientes pa on pa.id = pp.paciente_id
  where pp.id = passagem_id and public.pp_usuario_tem_setor(pa.setor_id::text)
));

drop policy if exists confirmacoes_select_setor on public.confirmacoes_checklist;
create policy confirmacoes_select_setor on public.confirmacoes_checklist for select to authenticated
using (exists (
  select 1 from public.itens_checklist ic
  join public.passagens_plantao pp on pp.id = ic.passagem_id
  join public.pacientes pa on pa.id = pp.paciente_id
  where ic.id = item_id and public.pp_usuario_tem_setor(pa.setor_id::text)
));
drop policy if exists confirmacoes_insert_setor on public.confirmacoes_checklist;
create policy confirmacoes_insert_setor on public.confirmacoes_checklist for insert to authenticated
with check (exists (
  select 1 from public.itens_checklist ic
  join public.passagens_plantao pp on pp.id = ic.passagem_id
  join public.pacientes pa on pa.id = pp.paciente_id
  where ic.id = item_id
    and ic.registrado_por::text <> public.pp_profissional_atual()
    and public.pp_usuario_tem_setor(pa.setor_id::text)
));

-- Confirmações são append-only para usuários autenticados.
revoke update, delete on public.confirmacoes_checklist from anon, authenticated;
grant select, insert on public.confirmacoes_checklist to authenticated;

commit;
