import { supabase } from '../lib/supabase'; // ajuste o caminho se for diferente
// >>> Ajuste estes valores para o que o seu banco aceita (veja o passo 2 do GUIA.md)
export const ESTADOS_GERAIS = ['Estável', 'Atenção', 'Crítico'];
export const STATUS_PENDENCIA = { ABERTA: 'pendente', CONCLUIDA: 'concluida' };

const unwrap = ({ data, error }) => {
  if (error) {
    const wrapped = new Error(error.message || 'Não foi possível concluir a operação.');
    wrapped.code = error.code;
    throw wrapped;
  }
  return data;
};

const requireId = (value, label) => {
  if (value === undefined || value === null || value === '') {
    throw new Error(`${label} não informado.`);
  }
  return value;
};

// id do profissional logado (profissionais.id, não o auth.uid)
let cache = { authId: null, id: null };
export async function getMeuProfissionalId() {
  const { data: { session } } = await supabase.auth.getSession();
  const authId = session?.user?.id;
  if (!authId) return null;
  if (cache.authId === authId) return cache.id;
  const row = unwrap(await supabase.from('profissionais').select('id, ativo').eq('auth_id', authId).single());
  if (!row || row.ativo === false) throw new Error('O perfil profissional está desativado.');
  cache = { authId, id: row.id };
  return row.id;
}

export const pacientesApi = {
  listBySetor: async (setorId, filtro = 'ativos') => {
    requireId(setorId, 'Setor');
    let query = supabase
      .from('pacientes')
      .select('*, leito_detalhe:leitos!pacientes_leito_id_fkey(id, identificacao), passagens_plantao(id, estado_geral, data_hora)')
      .eq('setor_id', setorId);
    if (filtro === 'ativos') query = query.eq('ativo', true);
    if (filtro === 'desativados') query = query.eq('ativo', false);
    const rows = unwrap(
      await query
        .order('identificacao')
        .order('data_hora', { referencedTable: 'passagens_plantao', ascending: false })
        .limit(1, { referencedTable: 'passagens_plantao' })
    ) ?? [];
    if (!Array.isArray(rows)) throw new Error('A lista de pacientes retornou um formato inesperado.');
    const pacientes = rows.map(({ passagens_plantao, leito_detalhe, ...p }) => ({
      ...p,
      leito_id: p.leito_id ?? leito_detalhe?.id ?? null,
      leito: leito_detalhe?.identificacao ?? p.leito ?? null,
      ultima: passagens_plantao?.[0] ?? null,
    }));
    const passagemIds = pacientes.map((p) => p.ultima?.id).filter(Boolean);
    const pendenciasPorPassagem = new Map();
    if (passagemIds.length) {
      const itens = unwrap(await supabase.from('itens_checklist')
        .select('passagem_id, prioridade, cancelado_em, confirmacoes_checklist(item_id)')
        .in('passagem_id', passagemIds)) ?? [];
      for (const item of itens) {
        if (item.cancelado_em || item.confirmacoes_checklist?.length) continue;
        const resumo = pendenciasPorPassagem.get(item.passagem_id) ?? { total: 0, criticos: 0 };
        resumo.total += 1;
        if (item.prioridade === 'critico') resumo.criticos += 1;
        pendenciasPorPassagem.set(item.passagem_id, resumo);
      }
    }
    return pacientes.map((p) => ({
      ...p,
      checklistPendente: pendenciasPorPassagem.get(p.ultima?.id) ?? { total: 0, criticos: 0 },
    }));
  },

  create: async ({
    identificacao,
    leito_id,
    leito = null,
    setor_id,
    cpf = null,
    data_nascimento = null,
    prontuario = null,
    nome_mae = null,
    genero = null,
    nivel_dependencia = null,
  }) => {
    requireId(setor_id, 'Setor');
    if (!identificacao?.trim()) throw new Error('Informe a identificação do paciente.');
    const paciente = unwrap(await supabase
      .from('pacientes')
      .insert({
        identificacao: identificacao.trim(),
        leito: leito ?? '',
        leito_id: leito_id || null,
        setor_id,
        cpf: cpf?.trim() || null,
        data_nascimento: data_nascimento || null,
        prontuario: prontuario?.trim() || null,
        nome_mae: nome_mae?.trim() || null,
        genero: genero || null,
        nivel_dependencia: nivel_dependencia || null,
        ativo: true,
        data_alta: null,
      })
      .select('*, leito_detalhe:leitos!pacientes_leito_id_fkey(id, identificacao)')
      .single());
    if (!paciente) throw new Error('O Supabase não retornou o paciente cadastrado.');
    return { ...paciente, leito: paciente.leito_detalhe?.identificacao ?? null };
  },

  update: async (id, {
    identificacao,
    leito_id,
    leito = null,
    cpf = null,
    data_nascimento = null,
    prontuario = null,
    nome_mae = null,
    genero = null,
    nivel_dependencia = null,
  }) => {
    requireId(id, 'Paciente');
    const updatePayload = {
      identificacao: identificacao.trim(),
      leito_id: leito_id || null,
      ...(leito ? { leito } : {}),
      cpf: cpf?.trim() || null,
      data_nascimento: data_nascimento || null,
      prontuario: prontuario?.trim() || null,
      nome_mae: nome_mae?.trim() || null,
      genero: genero || null,
      nivel_dependencia: nivel_dependencia || null,
    };
    const paciente = unwrap(
      await supabase
        .from('pacientes')
        .update(updatePayload)
        .eq('id', id)
        .select('*, leito_detalhe:leitos!pacientes_leito_id_fkey(id, identificacao)')
        .single()
    );
    return { ...paciente, leito: paciente.leito_detalhe?.identificacao ?? null };
  },

  updateNivelDependencia: async (id, nivel_dependencia) => {
    requireId(id, 'Paciente');
    const paciente = unwrap(
      await supabase
        .from('pacientes')
        .update({ nivel_dependencia })
        .eq('id', id)
        .select('*, leito_detalhe:leitos!pacientes_leito_id_fkey(id, identificacao)')
        .single()
    );
    return { ...paciente, leito: paciente.leito_detalhe?.identificacao ?? null };
  },

  desativar: async (id) => {
    requireId(id, 'Paciente');
    const paciente = unwrap(
      await supabase.from('pacientes').update({ ativo: false, data_alta: new Date().toISOString() }).eq('id', id).select().single()
    );
    return paciente;
  },

  remove: async (id) => pacientesApi.desativar(id),
};

export const leitosApi = {
  listBySetor: async (setorId, { somenteAtivos = true } = {}) => {
    requireId(setorId, 'Setor');
    let query = supabase.from('leitos').select('id, setor_id, identificacao, ativo').eq('setor_id', setorId);
    if (somenteAtivos) query = query.eq('ativo', true);
    return unwrap(await query.order('identificacao')) ?? [];
  },
  listLivresBySetor: async (setorId, pacienteAtualId = null) => {
    const leitos = await leitosApi.listBySetor(setorId);
    const ocupacoes = unwrap(await supabase.from('pacientes').select('id, leito_id').eq('setor_id', setorId).eq('ativo', true)) ?? [];
    const ocupados = new Set(ocupacoes.filter((p) => p.id !== pacienteAtualId && p.leito_id).map((p) => p.leito_id));
    return leitos.filter((leito) => !ocupados.has(leito.id));
  },
  create: async ({ setor_id, identificacao }) => {
    requireId(setor_id, 'Setor');
    if (!identificacao?.trim()) throw new Error('Informe a identificação do leito.');
    return unwrap(await supabase.from('leitos')
      .insert({ setor_id, identificacao: identificacao.trim() })
      .select().single());
  },
  update: async (id, { identificacao }) => {
    requireId(id, 'Leito');
    if (!identificacao?.trim()) throw new Error('Informe a identificação do leito.');
    return unwrap(await supabase.from('leitos')
      .update({ identificacao: identificacao.trim() }).eq('id', id).select().single());
  },
  desativar: async (id) => {
    requireId(id, 'Leito');
    return unwrap(await supabase.from('leitos').update({ ativo: false }).eq('id', id).select().single());
  },
};

export const checklistApi = {
  listByPaciente: async (pacienteId) => {
    requireId(pacienteId, 'Paciente');
    const passagens = unwrap(await supabase.from('passagens_plantao').select('id').eq('paciente_id', pacienteId)) ?? [];
    if (!passagens.length) return [];
    const rows = unwrap(await supabase.from('itens_checklist')
      .select('id, passagem_id, descricao, prioridade, registrado_por, registrado_em, atualizado_em, cancelado_em, cancelado_por, confirmacoes_checklist(item_id, confirmado_por, confirmado_em)')
      .in('passagem_id', passagens.map((p) => p.id))
      .order('registrado_em', { ascending: false })) ?? [];
    return rows.map((item) => ({ ...item, confirmacoes: item.confirmacoes_checklist ?? [], confirmado: !!item.confirmacoes_checklist?.length }));
  },
  listByPassagem: async (passagemId) => {
    requireId(passagemId, 'Passagem');
    const rows = unwrap(await supabase.from('itens_checklist')
      .select('id, passagem_id, descricao, prioridade, registrado_por, registrado_em, atualizado_em, cancelado_em, cancelado_por, confirmacoes_checklist(item_id, confirmado_por, confirmado_em)')
      .eq('passagem_id', passagemId).order('registrado_em')) ?? [];
    return rows.map((item) => ({ ...item, confirmacoes: item.confirmacoes_checklist ?? [], confirmado: !!item.confirmacoes_checklist?.length }));
  },
  create: async ({ passagem_id, descricao, prioridade = 'rotina' }) => {
    requireId(passagem_id, 'Passagem');
    if (!descricao?.trim()) throw new Error('Informe a descrição do item.');
    const passagem = unwrap(await supabase.from('passagens_plantao')
      .select('pacientes!inner(ativo)').eq('id', passagem_id).single());
    if (passagem?.pacientes?.ativo === false) throw new Error('Não é possível adicionar itens a um paciente que recebeu alta.');
    return unwrap(await supabase.from('itens_checklist')
      .insert({ passagem_id, descricao: descricao.trim(), prioridade }).select().single());
  },
  cancel: async (id) => {
    requireId(id, 'Item do checklist');
    return unwrap(await supabase.from('itens_checklist').update({ cancelado_em: new Date().toISOString() }).eq('id', id).select().single());
  },
  update: async (id, { descricao }) => {
    requireId(id, 'Item do checklist');
    if (!descricao?.trim()) throw new Error('Informe a descrição do item.');
    return unwrap(await supabase.from('itens_checklist')
      .update({ descricao: descricao.trim() }).eq('id', id).select().single());
  },
  confirm: async (itemId) => {
    requireId(itemId, 'Item do checklist');
    return unwrap(await supabase.from('confirmacoes_checklist').insert({ item_id: itemId }).select().single());
  },
  hasCriticalPending: async (pacienteId) => {
    const passagens = unwrap(await supabase.from('passagens_plantao').select('id').eq('paciente_id', pacienteId).order('data_hora', { ascending: false }).order('id', { ascending: false }).limit(1)) ?? [];
    if (!passagens.length) return false;
    const items = await checklistApi.listByPassagem(passagens[0].id);
    return items.some((item) => !item.cancelado_em && item.prioridade === 'critico' && !item.confirmado);
  },
};

export const funcionariosApi = {
  request: async (payload) => {
    const { data, error } = await supabase.functions.invoke('gerenciar-funcionarios', { body: payload });
    if (error) throw new Error(data?.error ?? error.message ?? 'Falha ao gerenciar funcionário.');
    if (data?.error) throw new Error(data.error);
    return data;
  },

  list: async () => {
    try {
      return await funcionariosApi.request({ action: 'list' });
    } catch (edgeErr) {
      console.warn('Edge function gerenciar-funcionarios indisponível, usando consulta direta:', edgeErr.message);
      // Fallback para consulta direta via Supabase Client
      const { data: funcs, error: errFunc } = await supabase
        .from('profissionais')
        .select(`
          id, nome, email, matricula, funcao, nivel_acesso, ativo, auth_id,
          profissional_setor(setor:setores(id, nome))
        `)
        .order('ativo', { ascending: false })
        .order('nome');

      const { data: setores, error: errSetores } = await supabase
        .from('setores')
        .select('id, nome')
        .order('nome');

      if (errFunc || errSetores) {
        throw new Error(errFunc?.message || errSetores?.message || edgeErr.message);
      }

      const formatados = (funcs || []).map((f) => ({
        ...f,
        setores: (f.profissional_setor || []).map((ps) => ps.setor).filter(Boolean),
      }));

      return {
        funcionarios: formatados,
        setores: setores || [],
      };
    }
  },

  create: async (dados) => {
    try {
      return await funcionariosApi.request({ action: 'create', ...dados });
    } catch (edgeErr) {
      console.warn('Edge function indisponível para criação, tentando fallback:', edgeErr.message);
      // Se a Edge Function não estiver implantada, tenta inserir o registro de profissional
      const { nome, email, matricula, funcao, nivel_acesso, setorIds = [] } = dados;
      if (!nome?.trim() || !email?.trim()) throw new Error('Nome e email são obrigatórios.');

      const { data: novoProf, error: profErr } = await supabase
        .from('profissionais')
        .insert({
          nome: nome.trim(),
          email: email.trim().toLowerCase(),
          matricula: matricula?.trim() || null,
          funcao: funcao?.trim() || 'Enfermeiro',
          nivel_acesso: nivel_acesso || 'assistencial',
          ativo: true,
        })
        .select()
        .single();

      if (profErr) throw new Error(profErr.message || edgeErr.message);

      if (setorIds?.length && novoProf?.id) {
        await supabase
          .from('profissional_setor')
          .insert(setorIds.map((setorId) => ({ profissional_id: novoProf.id, setor_id: setorId })));
      }

      return { ok: true, profissional: novoProf };
    }
  },

  update: async (dados) => {
    try {
      return await funcionariosApi.request({ action: 'update', ...dados });
    } catch (edgeErr) {
      console.warn('Edge function indisponível para atualização, usando fallback:', edgeErr.message);
      const { id, nome, matricula, funcao, nivel_acesso, setorIds = [] } = dados;
      requireId(id, 'Funcionário');

      const { data: prof, error: updErr } = await supabase
        .from('profissionais')
        .update({
          nome: nome?.trim(),
          matricula: matricula?.trim() || null,
          funcao: funcao?.trim(),
          nivel_acesso: nivel_acesso || undefined,
        })
        .eq('id', id)
        .select()
        .single();

      if (updErr) throw new Error(updErr.message || edgeErr.message);

      await supabase.from('profissional_setor').delete().eq('profissional_id', id);
      if (setorIds?.length) {
        await supabase
          .from('profissional_setor')
          .insert(setorIds.map((setorId) => ({ profissional_id: id, setor_id: setorId })));
      }

      return { ok: true, profissional: prof };
    }
  },

  desativar: async (id) => {
    try {
      return await funcionariosApi.request({ action: 'deactivate', id });
    } catch (edgeErr) {
      console.warn('Edge function indisponível para desativação, usando fallback:', edgeErr.message);
      requireId(id, 'Funcionário');
      const { error } = await supabase
        .from('profissionais')
        .update({ ativo: false, desativado_em: new Date().toISOString() })
        .eq('id', id);
      if (error) throw new Error(error.message || edgeErr.message);
      return { ok: true };
    }
  },
};

export const passagensApi = {
  listByPaciente: async (pacienteId) =>
    unwrap(
      await supabase
        .from('passagens_plantao')
        .select('*, profissionais(nome), pendencias(id, descricao, status)')
        .eq('paciente_id', pacienteId)
        .order('data_hora', { ascending: false })
    ),

  // pendencias: [{ descricao }]
  create: async ({ paciente_id, estado_geral, observacao, pendencias = [], itensChecklist = [], ficha = {}, tipo_ficha = 'clinica', rascunho = true }) => {
    requireId(paciente_id, 'Paciente');
    const paciente = unwrap(await supabase.from('pacientes').select('ativo').eq('id', paciente_id).single());
    if (paciente?.ativo === false) throw new Error('Não é possível registrar passagem para um paciente que recebeu alta.');
    const profissional_id = await getMeuProfissionalId();
    const passagem = unwrap(
      await supabase
        .from('passagens_plantao')
        .insert({ paciente_id, profissional_id, estado_geral, observacao, ficha, tipo_ficha, rascunho, data_hora: new Date().toISOString() })
        .select()
        .single()
    );
    if (pendencias.length) {
      const { error } = await supabase.from('pendencias').insert(
        pendencias.map((p) => ({ passagem_id: passagem.id, descricao: p.descricao, status: STATUS_PENDENCIA.ABERTA }))
      );
      if (error) {
        await supabase.from('passagens_plantao').delete().eq('id', passagem.id); // desfaz
        throw error;
      }
    }
    try {
      for (const item of itensChecklist.filter((i) => i.descricao?.trim())) {
        await checklistApi.create({ passagem_id: passagem.id, descricao: item.descricao, prioridade: item.prioridade });
      }
    } catch (error) {
      await supabase.from('passagens_plantao').delete().eq('id', passagem.id);
      throw error;
    }
    return passagem;
  },

  // Pendencias e itensChecklist: itens ausentes sao cancelados logicamente.
  update: async (id, { estado_geral, observacao, pendencias = [], itensChecklist, ficha = {}, tipo_ficha = 'clinica', rascunho = true }) => {
    const rows = unwrap(
      await supabase.from('passagens_plantao').update({ estado_geral, observacao, ficha, tipo_ficha, rascunho }).eq('id', id).select()
    );
    if (!rows?.length) throw new Error('Só o autor pode editar esta passagem.');

    const existentes = unwrap(await supabase.from('pendencias').select('id').eq('passagem_id', id));
    const mantidos = pendencias.filter((p) => p.id).map((p) => p.id);
    const remover = existentes.map((e) => e.id).filter((eid) => !mantidos.includes(eid));

    if (remover.length) unwrap(await supabase.from('pendencias').delete().in('id', remover).select());
    for (const p of pendencias.filter((x) => x.id)) {
      unwrap(await supabase.from('pendencias').update({ descricao: p.descricao }).eq('id', p.id).select());
    }
    const novas = pendencias.filter((p) => !p.id);
    if (novas.length) {
      unwrap(
        await supabase.from('pendencias').insert(
          novas.map((p) => ({ passagem_id: id, descricao: p.descricao, status: STATUS_PENDENCIA.ABERTA }))
        ).select()
      );
    }
    if (Array.isArray(itensChecklist)) {
      const atuais = await checklistApi.listByPassagem(id);
      const profissionalId = await getMeuProfissionalId();
      const idsAtuais = new Set(itensChecklist.filter((item) => item.id).map((item) => item.id));
      const cancelarIds = new Set(itensChecklist.filter((x) => x.id && x.cancelarAgora).map((x) => x.id));
      for (const item of atuais.filter((x) => (!idsAtuais.has(x.id) || cancelarIds.has(x.id)) && !x.confirmado && !x.cancelado_em && String(x.registrado_por) === String(profissionalId))) {
        await checklistApi.cancel(item.id);
      }
      for (const item of itensChecklist.filter((x) => x.id && !x.confirmado && !x.cancelado_em && !x.cancelarAgora && String(x.registrado_por) === String(profissionalId))) {
        await checklistApi.update(item.id, item);
      }
      for (const item of itensChecklist.filter((x) => !x.id && x.descricao?.trim())) {
        await checklistApi.create({ passagem_id: id, ...item });
      }
    }
    return rows[0];
  },

  remove: async (id) => {
    const data = unwrap(await supabase.from('passagens_plantao').delete().eq('id', id).select());
    if (!data?.length) throw new Error('Só o autor pode excluir esta passagem.');
  },
};

export const pendenciasApi = {
  setStatus: async (id, status) => {
    const data = unwrap(await supabase.from('pendencias').update({ status }).eq('id', id).select());
    if (!data?.length) throw new Error('Não foi possível atualizar a pendência.');
  },
};
