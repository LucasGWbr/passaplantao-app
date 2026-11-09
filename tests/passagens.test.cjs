const { test } = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const vm = require('node:vm');

function client({ finalized = false, failChecklist = false } = {}) {
  const calls = [];
  let draft = !finalized;
  const supabase = {
    auth: { getSession: async () => ({ data: { session: { user: { id: 'auth' } } } }) },
    from(table) {
      let action = 'select', payload, filters = [];
      const query = {
        select() { return query; },
        eq(key, value) { filters.push([key, value]); return query; },
        insert(value) { action = 'insert'; payload = value; return query; },
        update(value) { action = 'update'; payload = value; return query; },
        delete() { action = 'delete'; return query; },
        order() { return query; },
        single() { return query; },
        then(resolve, reject) {
          calls.push({ table, action, payload, filters });
          let data;
          if (table === 'profissionais') data = { id: 'author', ativo: true };
          if (table === 'pacientes') data = { ativo: true };
          if (table === 'itens_checklist') {
            if (failChecklist && action === 'insert') return Promise.resolve({ error: { message: 'Falha no cuidado' } }).then(resolve, reject);
            data = action === 'select' ? [] : { id: 'care' };
          }
          if (table === 'passagens_plantao') {
            if (action === 'insert') { draft = payload.rascunho; data = { id: 'handover', ...payload }; }
            if (action === 'select') data = { rascunho: draft, pacientes: { ativo: true } };
            if (action === 'update') {
              if (filters.some(([k,v]) => k === 'rascunho' && v !== draft)) data = [];
              else { draft = payload.rascunho ?? draft; data = payload.rascunho === false ? { id: 'handover', rascunho: false } : [{ id: 'handover', rascunho: draft }]; }
            }
            if (action === 'delete') data = draft ? [{ id: 'handover' }] : [];
          }
          return Promise.resolve({ data }).then(resolve, reject);
        },
      };
      return query;
    },
  };
  const source = fs.readFileSync('src/services/api.js', 'utf8').replace(/^import .*$/m, '').replace(/export /g, '');
  const api = vm.runInNewContext(source + '\n({ passagensApi, checklistApi });', { supabase, console });
  return { ...api, calls };
}

test('saves care items before finalizing a new handover', async () => {
  const { passagensApi, calls } = client();
  await passagensApi.create({ paciente_id: 'patient', rascunho: false, itensChecklist: [{ descricao: 'Conferir acesso', prioridade: 'atencao' }] });
  const create = calls.find(c => c.table === 'passagens_plantao' && c.action === 'insert');
  assert.equal(create.payload.rascunho, true);
  const careIndex = calls.findIndex(c => c.table === 'itens_checklist' && c.action === 'insert');
  const finalIndex = calls.findIndex(c => c.payload?.rascunho === false);
  assert.ok(careIndex >= 0 && finalIndex > careIndex);
});

test('does not finalize when saving a care item fails', async () => {
  const { passagensApi, calls } = client({ failChecklist: true });
  await assert.rejects(passagensApi.create({ paciente_id: 'patient', rascunho: false, itensChecklist: [{ descricao: 'Conferir acesso' }] }), /Falha no cuidado/);
  assert.ok(!calls.some(c => c.payload?.rascunho === false));
  assert.ok(calls.some(c => c.action === 'update' && c.payload?.ativo === false));
  assert.ok(!calls.some(c => c.action === 'delete'));
});

test('rejects editing, deleting and adding care to a finalized handover', async () => {
  const { passagensApi, checklistApi } = client({ finalized: true });
  await assert.rejects(passagensApi.update('handover', { observacao: 'Alterada' }));
  await assert.rejects(passagensApi.remove('handover'));
  await assert.rejects(checklistApi.create({ passagem_id: 'handover', descricao: 'Novo cuidado' }), /finalizada/);
});


test('archives a draft without deleting its data', async () => {
  const { passagensApi, calls } = client();
  await passagensApi.remove('handover');
  assert.ok(calls.some(c => c.table === 'passagens_plantao' && c.action === 'update' && c.payload.ativo === false));
  assert.ok(!calls.some(c => c.action === 'delete'));
});
