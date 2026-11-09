-- Execute pelo SQL Editor depois da migração de administração.
-- Primeiro crie o login em Authentication > Users > Add user no Supabase.
-- Substitua o email na chamada ao final. Não coloque senha neste arquivo.
begin;
create or replace function public.pp_configurar_primeiro_admin(email_admin text)
returns uuid language plpgsql security definer set search_path=public as $$
declare usuario uuid; perfil uuid;
begin
 perform pg_advisory_xact_lock(190911);
 if exists(select 1 from public.profissionais where ativo and auth_id is not null and lower(trim(nivel_acesso)) in ('admin','adm','gerente','administrador')) then
   raise exception 'Já existe um gerente/administrador ativo. Use o painel para criar outros.';
 end if;
 select id into usuario from auth.users where lower(email)=lower(trim(email_admin));
 if usuario is null then raise exception 'Crie primeiro o login desse email no Supabase Authentication.'; end if;
 if exists(select 1 from public.profissionais where lower(email)=lower(trim(email_admin)) and auth_id is not null and auth_id<>usuario) then raise exception 'Email vinculado a outro acesso.'; end if;
 update public.profissionais set auth_id=usuario,nivel_acesso='admin',ativo=true,desativado_em=null where lower(email)=lower(trim(email_admin)) returning id into perfil;
 if perfil is null then
   insert into public.profissionais(auth_id,nome,email,funcao,nivel_acesso,ativo)
   values(usuario,'Administrador',lower(trim(email_admin)),'Gerente','admin',true) returning id into perfil;
 end if;
 return perfil;
end; $$;
revoke all on function public.pp_configurar_primeiro_admin(text) from public, anon, authenticated;
commit;
-- Execute separadamente com o email correto:
-- select public.pp_configurar_primeiro_admin('EMAIL_DO_ADMIN');
