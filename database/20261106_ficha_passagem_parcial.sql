-- Dados estruturados das fichas FOR 004 (clínica/cirúrgica) e FOR 005 (obstetrícia).
-- Campos em branco ficam sem resposta; rascunhos podem ser retomados durante o plantão.
alter table public.passagens_plantao
  add column if not exists ficha jsonb not null default '{}'::jsonb,
  add column if not exists tipo_ficha text not null default 'clinica',
  add column if not exists rascunho boolean not null default false;

alter table public.passagens_plantao
  drop constraint if exists passagens_plantao_tipo_ficha_check;
alter table public.passagens_plantao
  add constraint passagens_plantao_tipo_ficha_check
  check (tipo_ficha in ('clinica', 'obstetrica'));
