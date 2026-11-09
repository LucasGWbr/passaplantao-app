-- Baseado no esquema UUID informado. Execute depois das migrações de finalização.
begin;
alter table public.setores add column if not exists ativo boolean not null default true;
alter table public.profissional_setor add column if not exists ativo boolean not null default true;
alter table public.passagens_plantao add column if not exists ativo boolean not null default true;
-- Algumas instalações limitavam nivel_acesso a assistencial/admin.
-- Remove apenas CHECKs exclusivos dessa coluna; a escrita é restrita à gestão.
do $$ declare c record; coluna smallint; begin
 select attnum into coluna from pg_attribute where attrelid='public.profissionais'::regclass and attname='nivel_acesso';
 for c in select conname from pg_constraint where conrelid='public.profissionais'::regclass and contype='c' and conkey=array[coluna] loop
  execute format('alter table public.profissionais drop constraint %I',c.conname);
 end loop;
end $$;
create table if not exists public.funcoes (
 id uuid primary key default gen_random_uuid(), nome text not null check (length(trim(nome)) > 0),
 ativo boolean not null default true, criado_em timestamptz not null default now()
);
create unique index if not exists funcoes_nome_unico on public.funcoes(lower(trim(nome)));
insert into public.funcoes(nome) select distinct on (lower(trim(funcao))) trim(funcao)
from public.profissionais where nullif(trim(funcao), '') is not null on conflict do nothing;
insert into public.funcoes(nome) values ('Enfermeiro'), ('Técnico de enfermagem'), ('Gerente') on conflict do nothing;
create table if not exists public.quartos (
 id uuid primary key default gen_random_uuid(), setor_id uuid not null references public.setores(id),
 nome text not null check (length(trim(nome)) > 0), ativo boolean not null default true,
 criado_em timestamptz not null default now(), unique(setor_id, nome)
);
alter table public.leitos add column if not exists quarto_id uuid references public.quartos(id);

create or replace function public.pp_usuario_pode_gerenciar_usuarios()
returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from public.profissionais where auth_id = auth.uid() and ativo
 and lower(trim(nivel_acesso)) in ('admin','adm','gerente','administrador'));
$$;
create or replace function public.pp_acesso_setor(p_setor_id text)
returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from public.setores s where s.id::text = p_setor_id and s.ativo and
 (public.pp_usuario_pode_gerenciar_usuarios() or exists (
 select 1 from public.profissionais pr join public.profissional_setor ps on ps.profissional_id = pr.id
 where pr.auth_id = auth.uid() and pr.ativo and ps.ativo and ps.setor_id = s.id)));
$$;
create or replace function public.pp_acesso_passagem(p_passagem_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from public.passagens_plantao pp join public.pacientes pa on pa.id = pp.paciente_id
 where pp.id = p_passagem_id and pp.ativo and public.pp_acesso_setor(pa.setor_id::text));
$$;
create or replace function public.pp_acesso_item(p_item_id uuid)
returns boolean language sql stable security definer set search_path = public as $$
 select exists(select 1 from public.itens_checklist where id = p_item_id
 and public.pp_acesso_passagem(passagem_id));
$$;

-- Todas as exclusões físicas e TRUNCATE são rejeitados, inclusive cascatas.
create or replace function public.pp_impedir_exclusao_permanente()
returns trigger language plpgsql as $$
begin raise exception 'Exclusão permanente bloqueada. Desative ou arquive o registro para preservar o histórico.'; end;
$$;
do $$ declare tabela text; politica record; begin
 foreach tabela in array array['setores','profissionais','profissional_setor','pacientes','passagens_plantao','pendencias','leitos','itens_checklist','confirmacoes_checklist','funcoes','quartos'] loop
   execute format('alter table public.%I enable row level security', tabela);
   execute format('revoke delete, truncate on public.%I from anon, authenticated', tabela);
   execute format('drop trigger if exists bloquear_exclusao on public.%I', tabela);
   execute format('create trigger bloquear_exclusao before delete on public.%I for each row execute function public.pp_impedir_exclusao_permanente()', tabela);
   execute format('drop trigger if exists bloquear_truncate on public.%I', tabela);
   execute format('create trigger bloquear_truncate before truncate on public.%I for each statement execute function public.pp_impedir_exclusao_permanente()', tabela);
   -- Políticas permissivas se somam com OR. Substitui inclusive os antigos USING(true).
   for politica in select policyname from pg_policies where schemaname='public' and tablename=tabela loop
     execute format('drop policy %I on public.%I', politica.policyname, tabela);
   end loop;
 end loop;
end $$;

grant select, insert, update on public.funcoes, public.quartos, public.setores, public.profissionais, public.profissional_setor, public.leitos to authenticated;
create policy setores_leitura on public.setores for select to authenticated using (public.pp_acesso_setor(id::text) or public.pp_usuario_pode_gerenciar_usuarios());
create policy setores_gestao on public.setores for all to authenticated using (public.pp_usuario_pode_gerenciar_usuarios()) with check (public.pp_usuario_pode_gerenciar_usuarios());
create policy funcoes_leitura on public.funcoes for select to authenticated using (exists(select 1 from public.profissionais where auth_id=auth.uid() and ativo));
create policy funcoes_gestao on public.funcoes for all to authenticated using (public.pp_usuario_pode_gerenciar_usuarios()) with check (public.pp_usuario_pode_gerenciar_usuarios());
create policy quartos_leitura on public.quartos for select to authenticated using (public.pp_acesso_setor(setor_id::text));
create policy quartos_gestao on public.quartos for all to authenticated using (public.pp_usuario_pode_gerenciar_usuarios()) with check (public.pp_usuario_pode_gerenciar_usuarios());
-- Nomes de autores continuam disponíveis no histórico.
create or replace function public.pp_perfil_ativo()
returns boolean language sql stable security definer set search_path=public as $$
 select exists(select 1 from public.profissionais where auth_id=auth.uid() and ativo);
$$;
create policy profissionais_leitura on public.profissionais for select to authenticated using (auth_id=auth.uid() or public.pp_perfil_ativo());
create policy profissionais_gestao on public.profissionais for all to authenticated using (public.pp_usuario_pode_gerenciar_usuarios()) with check (public.pp_usuario_pode_gerenciar_usuarios());
create policy vinculos_leitura on public.profissional_setor for select to authenticated using (public.pp_usuario_pode_gerenciar_usuarios() or profissional_id::text=public.pp_profissional_atual()::text);
create policy vinculos_gestao on public.profissional_setor for all to authenticated using (public.pp_usuario_pode_gerenciar_usuarios()) with check (public.pp_usuario_pode_gerenciar_usuarios());
create policy pacientes_leitura on public.pacientes for select to authenticated using (public.pp_acesso_setor(setor_id::text));
create policy pacientes_inserir on public.pacientes for insert to authenticated with check (public.pp_acesso_setor(setor_id::text));
create policy pacientes_atualizar on public.pacientes for update to authenticated using (public.pp_acesso_setor(setor_id::text)) with check (public.pp_acesso_setor(setor_id::text));
create policy leitos_leitura on public.leitos for select to authenticated using (public.pp_acesso_setor(setor_id::text));
create policy leitos_gestao on public.leitos for all to authenticated using (public.pp_usuario_pode_gerenciar_usuarios()) with check (public.pp_usuario_pode_gerenciar_usuarios());
create policy passagens_leitura on public.passagens_plantao for select to authenticated using (exists(select 1 from public.pacientes p where p.id=paciente_id and public.pp_acesso_setor(p.setor_id::text)));
create policy passagens_inserir on public.passagens_plantao for insert to authenticated with check (profissional_id::text=public.pp_profissional_atual()::text and exists(select 1 from public.pacientes p where p.id=paciente_id and p.ativo and public.pp_acesso_setor(p.setor_id::text)));
create policy passagens_atualizar on public.passagens_plantao for update to authenticated using ((profissional_id::text=public.pp_profissional_atual()::text and public.pp_acesso_passagem(id)) or public.pp_usuario_pode_gerenciar_usuarios()) with check (profissional_id::text=public.pp_profissional_atual()::text or public.pp_usuario_pode_gerenciar_usuarios());
create policy pendencias_leitura on public.pendencias for select to authenticated using(public.pp_acesso_passagem(passagem_id));
create policy pendencias_inserir on public.pendencias for insert to authenticated with check(public.pp_acesso_passagem(passagem_id));
create policy pendencias_atualizar on public.pendencias for update to authenticated using(public.pp_acesso_passagem(passagem_id)) with check(public.pp_acesso_passagem(passagem_id));
create policy checklist_leitura on public.itens_checklist for select to authenticated using(public.pp_acesso_passagem(passagem_id));
create policy checklist_inserir on public.itens_checklist for insert to authenticated with check(public.pp_acesso_passagem(passagem_id));
create policy checklist_atualizar on public.itens_checklist for update to authenticated using(public.pp_acesso_passagem(passagem_id) and registrado_por::text=public.pp_profissional_atual()::text) with check(public.pp_acesso_passagem(passagem_id) and registrado_por::text=public.pp_profissional_atual()::text);
create policy confirmacoes_leitura on public.confirmacoes_checklist for select to authenticated using(public.pp_acesso_item(item_id));
create policy confirmacoes_inserir on public.confirmacoes_checklist for insert to authenticated with check(public.pp_acesso_item(item_id) and exists(select 1 from public.itens_checklist i where i.id=item_id and i.cancelado_em is null and i.registrado_por::text<>public.pp_profissional_atual()::text));
revoke update, delete on public.confirmacoes_checklist from authenticated;

-- Finalizados permanecem imutáveis; apenas a visibilidade pode ser alterada.
create or replace function public.pp_proteger_passagem_finalizada()
returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='DELETE' then raise exception 'Use o arquivamento; exclusão permanente bloqueada.'; end if;
 if (to_jsonb(new)-'ativo') = (to_jsonb(old)-'ativo') and new.ativo is distinct from old.ativo then
   if public.pp_usuario_pode_gerenciar_usuarios() or (old.rascunho and old.profissional_id::text=public.pp_profissional_atual()::text) then return new; end if;
   raise exception 'Sem permissão para arquivar esta passagem.';
 end if;
 if not old.ativo then raise exception 'Passagem arquivada.'; end if;
 if old.profissional_id::text is distinct from public.pp_profissional_atual()::text then raise exception 'Somente o autor pode editar o rascunho.'; end if;
 if not old.rascunho then raise exception 'Passagem finalizada: somente leitura.'; end if;
 if new.profissional_id is distinct from old.profissional_id or new.paciente_id is distinct from old.paciente_id then raise exception 'Não altere o autor ou paciente.'; end if;
 if not new.rascunho then new.data_hora := now(); end if;
 return new;
end; $$;

drop trigger if exists passagens_proteger_finalizada on public.passagens_plantao;
create trigger passagens_proteger_finalizada before update or delete on public.passagens_plantao for each row execute function public.pp_proteger_passagem_finalizada();

create or replace function public.pp_validar_cadastros_ativos()
returns trigger language plpgsql set search_path=public as $$
begin
 if tg_table_name='leitos' then
   if new.quarto_id is not null then
     if not exists(select 1 from public.quartos q where q.id=new.quarto_id and q.setor_id=new.setor_id and (not new.ativo or q.ativo)) then raise exception 'Escolha um quarto ativo do mesmo setor.'; end if;
   end if;
   if new.ativo and not exists(select 1 from public.setores where id=new.setor_id and ativo) then raise exception 'Selecione um setor ativo.'; end if;
 elsif tg_table_name='setores' then
   if old.ativo and not new.ativo and (exists(select 1 from public.pacientes where setor_id=old.id and ativo) or exists(select 1 from public.leitos where setor_id=old.id and ativo) or exists(select 1 from public.quartos where setor_id=old.id and ativo)) then raise exception 'Desative ou transfira pacientes, leitos e quartos antes de desativar o setor.'; end if;
 elsif tg_table_name='quartos' then
   if tg_op='UPDATE' then
     if old.ativo and not new.ativo and exists(select 1 from public.leitos where quarto_id=old.id and ativo) then raise exception 'O quarto possui leitos ativos.'; end if;
     if new.setor_id is distinct from old.setor_id and exists(select 1 from public.leitos where quarto_id=old.id) then raise exception 'Não transfira um quarto com leitos vinculados.'; end if;
   end if;
   if new.ativo and not exists(select 1 from public.setores where id=new.setor_id and ativo) then raise exception 'Selecione um setor ativo.'; end if;
 elsif tg_table_name='funcoes' then
   if old.ativo and not new.ativo and exists(select 1 from public.profissionais where lower(trim(funcao))=lower(trim(old.nome)) and ativo) then raise exception 'A função está em uso por funcionários ativos.'; end if;
   if new.nome is distinct from old.nome then update public.profissionais set funcao=new.nome where lower(trim(funcao))=lower(trim(old.nome)); end if;
 end if;
 return new;
end; $$;
drop trigger if exists validar_quarto_leito on public.leitos;
create trigger validar_quarto_leito before insert or update on public.leitos for each row execute function public.pp_validar_cadastros_ativos();
drop trigger if exists validar_setor_ativo on public.setores;
create trigger validar_setor_ativo before update on public.setores for each row execute function public.pp_validar_cadastros_ativos();
drop trigger if exists validar_quarto_ativo on public.quartos;
create trigger validar_quarto_ativo before insert or update on public.quartos for each row execute function public.pp_validar_cadastros_ativos();
drop trigger if exists validar_funcao_ativa on public.funcoes;
create trigger validar_funcao_ativa after update on public.funcoes for each row execute function public.pp_validar_cadastros_ativos();

create or replace function public.pp_validar_perfil_gestao()
returns trigger language plpgsql set search_path=public as $$
begin
 if tg_op='INSERT' then
   if lower(trim(new.nivel_acesso)) not in ('assistencial','admin','adm','administrador','gerente','supervisor','coordenacao') then raise exception 'Nível de acesso inválido.'; end if;
 elsif new.nivel_acesso is distinct from old.nivel_acesso then
   if lower(trim(new.nivel_acesso)) not in ('assistencial','admin','adm','administrador','gerente','supervisor','coordenacao') then raise exception 'Nível de acesso inválido.'; end if;
 end if;
 if new.ativo and not exists(select 1 from public.funcoes where lower(trim(nome))=lower(trim(new.funcao)) and ativo) then raise exception 'Selecione uma função ativa.'; end if;
 return new;
end; $$;
drop trigger if exists validar_perfil_gestao on public.profissionais;
create trigger validar_perfil_gestao before insert or update on public.profissionais for each row execute function public.pp_validar_perfil_gestao();

-- Bloqueia a desativação/rebaixamento do último administrador, inclusive em concorrência.
create or replace function public.pp_preservar_ultimo_admin()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 perform pg_advisory_xact_lock(190911);
 if old.ativo and old.auth_id is not null and lower(trim(old.nivel_acesso)) in ('admin','adm','gerente','administrador') and
 (not new.ativo or new.auth_id is distinct from old.auth_id or lower(trim(new.nivel_acesso)) not in ('admin','adm','gerente','administrador')) and not exists
 (select 1 from public.profissionais where id<>old.id and ativo and auth_id is not null and lower(trim(nivel_acesso)) in ('admin','adm','gerente','administrador')) then raise exception 'Mantenha pelo menos um gerente/administrador ativo.'; end if;
 return new;
end; $$;
drop trigger if exists preservar_ultimo_admin on public.profissionais;
create trigger preservar_ultimo_admin before update on public.profissionais for each row execute function public.pp_preservar_ultimo_admin();

-- Caso a instalação ainda tenha a trava de cuidados críticos, considere somente
-- passagens finalizadas visíveis. Um cadastro que falhou e foi arquivado não bloqueia o próximo.
create or replace function public.pp_bloquear_passagem_com_critico_pendente()
returns trigger language plpgsql security definer set search_path=public as $$
begin
 if exists(select 1 from public.itens_checklist i join public.passagens_plantao p on p.id=i.passagem_id
 where p.paciente_id=new.paciente_id and p.ativo and not p.rascunho and i.cancelado_em is null
 and i.prioridade='critico' and not exists(select 1 from public.confirmacoes_checklist c where c.item_id=i.id)) then
 raise exception 'Confirme os cuidados críticos pendentes antes da próxima passagem.';
 end if;
 return new;
end; $$;

-- Cadastro e vínculos são gravados na mesma transação. Vínculos removidos ficam inativos.
create or replace function public.pp_salvar_funcionario(dados jsonb)
returns jsonb language plpgsql security definer set search_path=public as $$
declare perfil public.profissionais; setor uuid; ids uuid[];
begin
 if not public.pp_usuario_pode_gerenciar_usuarios() then raise exception 'Acesso exclusivo de gerente/administrador.'; end if;
 if nullif(trim(dados->>'nome'),'') is null then raise exception 'Informe o nome.'; end if;
 if coalesce(dados->>'nivel_acesso','assistencial') not in ('assistencial','gerente','admin') then raise exception 'Nível de acesso inválido.'; end if;
 if not exists(select 1 from public.funcoes where nome=dados->>'funcao' and ativo) then raise exception 'Selecione uma função ativa.'; end if;
 select array_agg(value::uuid) into ids from jsonb_array_elements_text(dados->'setorIds');
 if coalesce(array_length(ids,1),0)=0 then raise exception 'Selecione pelo menos um setor.'; end if;
 foreach setor in array ids loop
  if not exists(select 1 from public.setores where id=setor and ativo) then raise exception 'Setor desativado ou inexistente.'; end if;
 end loop;
 if nullif(dados->>'id','') is null then
  insert into public.profissionais(auth_id,nome,email,matricula,funcao,nivel_acesso,ativo)
  values ((dados->>'auth_id')::uuid,trim(dados->>'nome'),lower(trim(dados->>'email')),nullif(trim(dados->>'matricula'),''),dados->>'funcao',coalesce(dados->>'nivel_acesso','assistencial'),true) returning * into perfil;
 else
  update public.profissionais set nome=trim(dados->>'nome'), matricula=nullif(trim(dados->>'matricula'),''),funcao=dados->>'funcao',nivel_acesso=coalesce(dados->>'nivel_acesso','assistencial') where id=(dados->>'id')::uuid returning * into perfil;
  if not found then raise exception 'Funcionário não encontrado.'; end if;
 end if;
 update public.profissional_setor set ativo=false where profissional_id=perfil.id;
 foreach setor in array ids loop
  update public.profissional_setor set ativo=true where profissional_id=perfil.id and setor_id=setor;
  if not found then insert into public.profissional_setor(profissional_id,setor_id,ativo) values(perfil.id,setor,true); end if;
 end loop;
 return to_jsonb(perfil);
end; $$;
revoke all on function public.pp_salvar_funcionario(jsonb) from public, anon;
grant execute on function public.pp_salvar_funcionario(jsonb) to authenticated;
commit;
