import { createClient } from 'npm:@supabase/supabase-js@2';

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const resposta = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });
const niveis = ['admin', 'adm', 'gerente', 'administrador'];

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return resposta({ error: 'Método inválido.' }, 405);
  const authorization = req.headers.get('Authorization');
  if (!authorization) return resposta({ error: 'Faça login novamente.' }, 401);
  try {
  const url = Deno.env.get('SUPABASE_URL')!;
  const anon = Deno.env.get('SUPABASE_ANON_KEY')!;
  const service = createClient(url, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!, { auth: { persistSession: false, autoRefreshToken: false } });
  const caller = createClient(url, anon, { global: { headers: { Authorization: authorization } }, auth: { persistSession: false, autoRefreshToken: false } });
  const token = authorization.replace(/^Bearer\s+/i, '');
  const { data: { user }, error: authError } = await caller.auth.getUser(token);
  if (authError || !user) return resposta({ error: 'Sessão inválida.' }, 401);
  const { data: gestor, error: perfilError } = await service.from('profissionais').select('id, ativo, nivel_acesso').eq('auth_id', user.id).single();
  if (perfilError || !gestor?.ativo || !niveis.includes(gestor.nivel_acesso?.trim().toLowerCase())) return resposta({ error: 'Acesso exclusivo de gerente/administrador.' }, 403);

    const body = await req.json();
    const { action } = body;
    if (action === 'list') {
      const [prof, setores, funcoes] = await Promise.all([
        caller.from('profissionais').select('id,nome,email,matricula,funcao,nivel_acesso,ativo,auth_id,profissional_setor(ativo,setor:setores(id,nome,ativo))').order('nome'),
        caller.from('setores').select('id,nome,ativo').eq('ativo', true).order('nome'),
        caller.from('funcoes').select('id,nome,ativo').eq('ativo', true).order('nome'),
      ]);
      if (prof.error || setores.error || funcoes.error) throw prof.error ?? setores.error ?? funcoes.error;
      return resposta({ funcionarios: prof.data?.map(({ profissional_setor, ...p }) => ({ ...p, setores: profissional_setor?.filter(v => v.ativo).map(v => v.setor).filter(Boolean) })), setores: setores.data, funcoes: funcoes.data });
    }
    if (action === 'deactivate' || action === 'reactivate') {
      if (!body.id) throw new Error('Informe o funcionário.');
      const { error } = await caller.from('profissionais').update({ ativo: action === 'reactivate', desativado_em: action === 'deactivate' ? new Date().toISOString() : null }).eq('id', body.id).select().single();
      if (error) throw error;
      // O perfil ativo também é checado pelas policies em toda requisição.
      return resposta({ ok: true });
    }
    if (!['create', 'update'].includes(action)) throw new Error('Ação inválida.');
    if (!body.nome?.trim() || !body.funcao?.trim() || !Array.isArray(body.setorIds) || !body.setorIds.length) throw new Error('Informe nome, função e setores.');
    if (!['assistencial', 'gerente', 'admin'].includes(body.nivel_acesso ?? 'assistencial')) throw new Error('Nível de acesso inválido.');
    const [funcaoResult, setoresResult] = await Promise.all([
      caller.from('funcoes').select('id').eq('nome', body.funcao).eq('ativo', true).single(),
      caller.from('setores').select('id').in('id', body.setorIds).eq('ativo', true),
    ]);
    if (funcaoResult.error || !funcaoResult.data) throw new Error('Selecione uma função ativa.');
    if (setoresResult.error || setoresResult.data?.length !== new Set(body.setorIds).size) throw new Error('Selecione setores ativos e válidos.');
    const dados = { id: action === 'update' ? body.id : null, nome: body.nome, email: body.email, matricula: body.matricula, funcao: body.funcao, nivel_acesso: body.nivel_acesso ?? 'assistencial', setorIds: body.setorIds };
    if (action === 'update') {
      if (!body.id) throw new Error('Informe o funcionário.');
      const { data, error } = await caller.rpc('pp_salvar_funcionario', { dados });
      if (error) throw error;
      return resposta({ ok: true, profissional: data });
    }
    if (!body.email?.trim() || typeof body.senha !== 'string' || body.senha.length < 12) throw new Error('Informe email e uma senha de no mínimo 12 caracteres.');
    // Cria acesso real. Nenhuma senha é gravada em profissionais ou devolvida no resultado.
    const { data: criado, error: createError } = await service.auth.admin.createUser({ email: body.email.trim().toLowerCase(), password: body.senha, email_confirm: true, user_metadata: { nome: body.nome.trim() } });
    if (createError) throw createError;
    const { data, error } = await caller.rpc('pp_salvar_funcionario', { dados: { ...dados, auth_id: criado.user.id } });
    if (error) {
      // Preserva a conta para auditoria se o cadastro falhar. Nunca apaga o usuário.
      const { error: blockError } = await service.auth.admin.updateUserById(criado.user.id, { ban_duration: '876000h' });
      if (blockError) throw new Error('O perfil não foi salvo e não foi possível confirmar o bloqueio do acesso criado. Revise a conta no Supabase antes de tentar novamente.');
      throw new Error(`O cadastro não foi concluído. O acesso criado foi bloqueado para preservação do histórico. Verifique o usuário no Supabase antes de tentar novamente. Motivo: ${error.message}`);
    }
    return resposta({ ok: true, profissional: data });
  } catch (e) {
    return resposta({ error: e instanceof Error ? e.message : (e as { message?: string })?.message ?? 'Não foi possível concluir.' }, 400);
  }
});
