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
      .select('*, leito_detalhe:leitos!pacientes_leito_id_fkey(id, identificacao), passagens_plantao(id, estado_geral, data_hora, ativo)')
      .eq('setor_id', setorId)
      .eq('passagens_plantao.ativo', true);
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
  reativar: async (id) => unwrap(await supabase.from('leitos').update({ ativo: true }).eq('id', id).select().single()),
  listBySetor: async (setorId, { somenteAtivos = true } = {}) => {
    requireId(setorId, 'Setor');
    let query = supabase.from('leitos').select('id, setor_id, identificacao, ativo, quarto_id').eq('setor_id', setorId);
    if (somenteAtivos) query = query.eq('ativo', true);
    return unwrap(await query.order('identificacao')) ?? [];
  },
  listLivresBySetor: async (setorId, pacienteAtualId = null) => {
    const leitos = await leitosApi.listBySetor(setorId);
    const ocupacoes = unwrap(await supabase.from('pacientes').select('id, leito_id').eq('setor_id', setorId).eq('ativo', true)) ?? [];
    const ocupados = new Set(ocupacoes.filter((p) => p.id !== pacienteAtualId && p.leito_id).map((p) => p.leito_id));
    return leitos.filter((leito) => !ocupados.has(leito.id));
  },
  create: async ({ setor_id, identificacao, quarto_id = null }) => {
    requireId(setor_id, 'Setor');
    if (!identificacao?.trim()) throw new Error('Informe a identificação do leito.');
    return unwrap(await supabase.from('leitos')
      .insert({ setor_id, identificacao: identificacao.trim(), quarto_id })
      .select().single());
  },
  update: async (id, { identificacao, quarto_id = null }) => {
    requireId(id, 'Leito');
    if (!identificacao?.trim()) throw new Error('Informe a identificação do leito.');
    return unwrap(await supabase.from('leitos')
      .update({ identificacao: identificacao.trim(), quarto_id }).eq('id', id).select().single());
  },
  desativar: async (id) => {
    requireId(id, 'Leito');
    return unwrap(await supabase.from('leitos').update({ ativo: false }).eq('id', id).select().single());
  },
};

export const checklistApi = {
  listByPaciente: async (pacienteId) => {
    requireId(pacienteId, 'Paciente');
    const passagens = unwrap(await supabase.from('passagens_plantao').select('id').eq('paciente_id', pacienteId).eq('ativo', true)) ?? [];
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
      .select('rascunho, pacientes!inner(ativo)').eq('id', passagem_id).single());
    if (passagem?.rascunho !== true) throw new Error('A passagem finalizada não permite novos cuidados.');
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
    const passagens = unwrap(await supabase.from('passagens_plantao').select('id').eq('paciente_id', pacienteId).eq('ativo', true).order('data_hora', { ascending: false }).order('id', { ascending: false }).limit(1)) ?? [];
    if (!passagens.length) return false;
    const items = await checklistApi.listByPassagem(passagens[0].id);
    return items.some((item) => !item.cancelado_em && item.prioridade === 'critico' && !item.confirmado);
  },
};

export const funcionariosApi = {
  request: async (payload) => {
    const { data, error } = await supabase.functions.invoke('gerenciar-funcionarios', { body: payload });
    if (error) {
      let corpo = data;
      try { corpo = await error.context?.json() ?? corpo; } catch {}
      const detalhe = corpo?.error ?? corpo?.message ?? corpo?.msg ?? error.message;
      const status = error.context?.status;
      const orientacao = status === 401 ? 'Sessão recusada pela função. Saia e entre novamente; se persistir, publique a configuração atualizada da função.'
        : status === 403 ? 'Seu perfil precisa estar ativo e ter acesso de gerente/administrador.'
        : status === 404 ? 'A função de cadastro não foi publicada no Supabase.'
        : !corpo ? 'Não foi possível acessar o serviço de cadastro. Confira a publicação e os logs da função gerenciar-funcionarios.' : '';
      throw new Error([detalhe, orientacao].filter(Boolean).join(' ') || error.message);
    }
    if (data?.error) throw new Error(data.error);
    return data;
  },
  // Consultas usam a sessão e as policies RLS, sem depender da disponibilidade da Edge Function.
  list: async () => {
    const rows = unwrap(await supabase.from('profissionais')
      .select('id,nome,email,matricula,funcao,nivel_acesso,ativo,auth_id,profissional_setor(ativo,setor:setores(id,nome,ativo))')
      .order('nome')) ?? [];
    return { funcionarios: rows.map(({ profissional_setor, ...p }) => ({ ...p, setores: (profissional_setor ?? []).filter((v) => v.ativo).map((v) => v.setor).filter(Boolean) })) };
  },
  create: (dados) => funcionariosApi.request({ ...dados, action: 'create' }),
  update: (dados) => funcionariosApi.request({ ...dados, action: 'update' }),
  desativar: (id) => funcionariosApi.request({ action: 'deactivate', id }),
  reativar: (id) => funcionariosApi.request({ action: 'reactivate', id }),
};

// Nomes de tabelas fechados: a tela nunca envia um nome arbitrário ao banco.
const tabelasAdministrativas = { setores: 'setores', funcoes: 'funcoes', quartos: 'quartos' };
export const administracaoApi = {
  list: async (tipo) => {
    const tabela = tabelasAdministrativas[tipo];
    if (!tabela) throw new Error('Cadastro inválido.');
    return unwrap(await supabase.from(tabela).select('*').order('nome')) ?? [];
  },
  salvar: async (tipo, { id, nome, setor_id }) => {
    const tabela = tabelasAdministrativas[tipo];
    if (!tabela || !nome?.trim()) throw new Error('Informe o nome.');
    const dados = { nome: nome.trim(), ...(tipo === 'quartos' ? { setor_id: requireId(setor_id, 'Setor') } : {}) };
    const query = id ? supabase.from(tabela).update(dados).eq('id', id) : supabase.from(tabela).insert(dados);
    return unwrap(await query.select().single());
  },
  setAtivo: async (tipo, id, ativo) => {
    const tabela = tabelasAdministrativas[tipo];
    if (!tabela) throw new Error('Cadastro inválido.');
    return unwrap(await supabase.from(tabela).update({ ativo }).eq('id', id).select().single());
  },
};

export const passagensApi = {
  listByPaciente: async (pacienteId) =>
    unwrap(
      await supabase
        .from('passagens_plantao')
        .select('*, profissionais(nome), pendencias(id, descricao, status)')
        .eq('paciente_id', pacienteId)
        .eq('ativo', true)
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
        .insert({ paciente_id, profissional_id, estado_geral, observacao, ficha, tipo_ficha, rascunho: true, data_hora: new Date().toISOString() })
        .select()
        .single()
    );
    if (pendencias.length) {
      const { error } = await supabase.from('pendencias').insert(
        pendencias.map((p) => ({ passagem_id: passagem.id, descricao: p.descricao, status: STATUS_PENDENCIA.ABERTA }))
      );
      if (error) {
        await supabase.from('passagens_plantao').update({ ativo: false }).eq('id', passagem.id); // desfaz
        throw error;
      }
    }
    try {
      for (const item of itensChecklist.filter((i) => i.descricao?.trim())) {
        await checklistApi.create({ passagem_id: passagem.id, descricao: item.descricao, prioridade: item.prioridade });
      }
    } catch (error) {
      await supabase.from('passagens_plantao').update({ ativo: false }).eq('id', passagem.id);
      throw error;
    }
    if (!rascunho) return unwrap(await supabase.from('passagens_plantao').update({ rascunho: false }).eq('id', passagem.id).eq('rascunho', true).select().single());
    return passagem;
  },

  // Cuidados só podem ser alterados no rascunho; a finalização acontece após salvar todos os itens.
  update: async (id, { estado_geral, observacao, itensChecklist, ficha = {}, tipo_ficha = 'clinica', rascunho = true }) => {
    const rows = unwrap(
      await supabase.from('passagens_plantao').update({ estado_geral, observacao, ficha, tipo_ficha }).eq('id', id).eq('rascunho', true).select()
    );
    if (!rows?.length) throw new Error('Só o autor pode editar esta passagem.');

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
    if (!rascunho) return unwrap(await supabase.from('passagens_plantao').update({ rascunho: false }).eq('id', id).eq('rascunho', true).select().single());
    return rows[0];
  },

  remove: async (id) => {
    const data = unwrap(await supabase.from('passagens_plantao').update({ ativo: false }).eq('id', id).eq('rascunho', true).select());
    if (!data?.length) throw new Error('Só o autor pode excluir esta passagem.');
  },
};

export const pendenciasApi = {
  setStatus: async (id, status) => {
    const data = unwrap(await supabase.from('pendencias').update({ status }).eq('id', id).select());
    if (!data?.length) throw new Error('Não foi possível atualizar a pendência.');
  },
};
