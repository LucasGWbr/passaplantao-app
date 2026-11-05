import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { passagensApi, checklistApi, pacientesApi, ESTADOS_GERAIS, getMeuProfissionalId } from '../services/api';
import { colors, space, radius, shadow, estadoVisual } from '../theme.js';
import { NIVEIS_DEPENDENCIA } from '../utils/formatters';

export default function NovaPassagemScreen({ route, navigation }) {
  const { paciente, passagem } = route.params; // passagem existe => edição
  const editando = !!passagem;
  const [estado, setEstado] = useState(passagem?.estado_geral ?? ESTADOS_GERAIS[0]);
  const [nivelDependencia, setNivelDependencia] = useState(paciente?.nivel_dependencia ?? 'Cuidados Mínimos');
  const [observacao, setObservacao] = useState(passagem?.observacao ?? '');
  const [pendencias, setPendencias] = useState(
    (passagem?.pendencias ?? []).map((p) => ({ id: p.id, descricao: p.descricao }))
  );
  const [nova, setNova] = useState('');
  const [itensChecklist, setItensChecklist] = useState([]);
  const [loadingChecklist, setLoadingChecklist] = useState(!!passagem?.id);
  const [saving, setSaving] = useState(false);
  const [meuProfissionalId, setMeuProfissionalId] = useState(null);
  const [tipoFicha, setTipoFicha] = useState(passagem?.tipo_ficha ?? (paciente?.setor?.toLowerCase?.().includes('obst') ? 'obstetrica' : 'clinica'));
  const [ficha, setFicha] = useState(passagem?.ficha ?? {});
  const atualizarFicha = (campo, valor) => setFicha((atual) => ({ ...atual, [campo]: valor }));
  const gruposFicha = tipoFicha === 'obstetrica' ? [
    ['Avaliação materna', [['consciencia','Consciência',['Lúcido','Confuso','Sonolento','Comunicativo','Não verbaliza','Gemente']],['dor','Dor',['Sim','Não']],['local_dor','Local da dor'],['respiracao','Padrão respiratório',['Eupneico','Dispneico','Tosse produtiva','Tosse improdutiva']],['dieta','Dieta',['ABDVO','APDVO','ARDVO']],['acesso','Acesso venoso',['MSD','MSE','Sem acesso','Salinizado','Soroterapia']],['utero','Útero',['Contraído abaixo da cicatriz umbilical','Contraído na altura da cicatriz umbilical','Contraído acima da cicatriz umbilical']],['loquios','Lóquios',['Pequena quantidade','Quantidade moderada','Grande quantidade']],['curativo','Curativo',['Sim','Não']],['local_curativo','Local / aspecto do curativo'],['eliminacao_vesical','Eliminação vesical',['Presentes','Ausentes','SVA','SVD']],['quantidade_svd','Quantidade / irrigação'],['eliminacao_intestinal','Eliminação intestinal',['Presentes','Ausentes']]]],
    ['Sinais vitais', [['pa','PA'],['fc','FC'],['fr','FR'],['tax','Temperatura'],['sat','Saturação'],['hgt','HGT']]],
    ['Recém-nascido (se aplicável)', [['rn_sexo','Sexo do RN',['Feminino','Masculino']],['rn_dieta','Dieta do RN',['Seio materno','Fórmula']],['rn_diurese','Diurese',['Presente','Ausente']],['rn_meconio','Mecônio',['Presente','Ausente']],['rn_sinais','Sinais vitais do RN']]],
  ] : [
    ['Avaliação clínica', [['consciencia','Consciência',['Lúcido','Confuso','Sonolento','Comunicativo','Não verbaliza','Gemente']],['dor','Dor',['Sim','Não']],['local_dor','Local da dor'],['respiracao','Padrão respiratório',['Eupneico','Dispneico','O₂ óculos nasal','O₂ máscara de Hudson','Tosse produtiva','Tosse improdutiva']],['oxigenio','Oxigênio (L/min)'],['dieta','Dieta',['ABDVO','APDVO','ARDVO','NPO','SNE','SNG aberta']],['dieta_detalhe','Dieta / velocidade (ml/h)'],['acesso','Acesso venoso',['MSD','MSE','Central','Sem acesso','Salinizado','Soroterapia','Bomba de infusão']],['acesso_detalhe','Acesso / infusão (ml/h)'],['abdomen','Abdômen',['Flácido','Globoso','Distendido','Timpânico']],['curativo','Curativo',['Sim','Não']],['curativo_detalhe','Local / aspecto do curativo'],['dreno','Drenos',['Penrose','Sump','Portovac','Tórax']],['dreno_detalhe','Secreção / quantidade'],['eliminacao_vesical','Eliminação vesical',['Presentes','Ausentes','SVA','SVD','Irrigação']],['eliminacao_vesical_detalhe','Débito / detalhe'],['eliminacao_intestinal','Eliminação intestinal',['Presentes','Ausentes','Fralda']]]],
    ['Sinais vitais', [['pa','PA'],['fc','FC'],['fr','FR'],['tax','Temperatura'],['sat','Saturação'],['hgt','HGT']]],
  ];

  useEffect(() => {
    getMeuProfissionalId().then(setMeuProfissionalId).catch((e) => Alert.alert('Erro', e.message));
    if (!passagem?.id) { setLoadingChecklist(false); return; }
    let ativo = true;
    checklistApi.listByPassagem(passagem.id)
      .then((items) => { if (ativo) setItensChecklist(items.map(({ confirmacoes, ...item }) => item)); })
      .catch((e) => Alert.alert('Erro ao carregar checklist', e.message))
      .finally(() => { if (ativo) setLoadingChecklist(false); });
    return () => { ativo = false; };
  }, [passagem?.id]);

  const addPendencia = () => {
    if (!nova.trim()) return;
    setPendencias((prev) => [...prev, { descricao: nova.trim() }]);
    setNova('');
  };
  const removePendencia = (idx) => setPendencias((prev) => prev.filter((_, i) => i !== idx));
  const addItemChecklist = () => setItensChecklist((prev) => [...prev, { descricao: '', prioridade: 'rotina' }]);
  const setItemChecklist = (idx, patch) => setItensChecklist((prev) => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  const removeItemChecklist = (idx) => setItensChecklist((prev) => prev.filter((_, i) => i !== idx));

  const salvar = async (rascunho = true) => {
    setSaving(true);
    try {
      const dados = { estado_geral: estado, observacao: observacao.trim(), pendencias, itensChecklist, ficha, tipo_ficha: tipoFicha, rascunho };
      if (editando) await passagensApi.update(passagem.id, dados);
      else await passagensApi.create({ ...dados, paciente_id: paciente.id });

      // Atualiza o nível de dependência do paciente se foi alterado
      if (nivelDependencia && nivelDependencia !== paciente.nivel_dependencia) {
        await pacientesApi.updateNivelDependencia(paciente.id, nivelDependencia);
        paciente.nivel_dependencia = nivelDependencia;
      }

      navigation.goBack();
    } catch (e) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.paciente}>{paciente.identificacao}{paciente.leito ? ` · Leito ${paciente.leito}` : ''}</Text>
        {paciente.data_nascimento ? <Text style={s.helper}>Nascimento: {paciente.data_nascimento.split('-').reverse().join('/')}</Text> : null}

        <View style={s.card}>
          <Text style={s.label}>Ficha de passagem · preenchimento parcial</Text>
          <Text style={s.helper}>Os campos começam em branco. Marque ou preencha somente o que foi observado; você pode salvar e continuar depois.</Text>
          <View style={s.chips}>{[['clinica','Clínica / cirúrgica'],['obstetrica','Obstetrícia']].map(([value,label]) => <TouchableOpacity key={value} style={[s.chip, tipoFicha === value && s.templateSelected]} onPress={() => setTipoFicha(value)}><Text style={{ color: tipoFicha === value ? '#fff' : colors.text, fontWeight: '700' }}>{label}</Text></TouchableOpacity>)}</View>
          {gruposFicha.map(([grupo, campos]) => <View key={grupo} style={s.formSection}><Text style={s.sectionTitle}>{grupo}</Text>{campos.map(([key,label,opcoes]) => <View key={key} style={s.field}><Text style={s.fieldLabel}>{label}</Text>{opcoes ? <View style={s.chips}>{opcoes.map((opcao) => <TouchableOpacity key={opcao} style={[s.option, ficha[key] === opcao && s.optionSelected]} onPress={() => atualizarFicha(key, ficha[key] === opcao ? '' : opcao)}><Text style={[s.optionText, ficha[key] === opcao && s.optionTextSelected]}>{opcao}</Text></TouchableOpacity>)}</View> : <TextInput style={s.input} value={ficha[key] ?? ''} onChangeText={(v) => atualizarFicha(key, v)} placeholder="Preencher se aplicável" placeholderTextColor={colors.muted} />}</View>)}</View>)}
          <TextInput style={s.input} value={ficha.intercorrencias ?? ''} onChangeText={(v) => atualizarFicha('intercorrencias', v)} placeholder="Intercorrências" placeholderTextColor={colors.muted} multiline />
        </View>

        <View style={s.card}>
          <Text style={s.label}>Estado geral</Text>
          <View style={s.chips}>
            {ESTADOS_GERAIS.map((c) => {
              const v = estadoVisual(c);
              const on = estado === c;
              return (
                <TouchableOpacity
                  key={c}
                  style={[s.chip, { borderColor: v.cor, backgroundColor: on ? v.cor : v.fundo }]}
                  onPress={() => setEstado(c)}
                >
                  <Text style={{ color: on ? '#fff' : v.cor, fontWeight: '700' }}>{c}</Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Nível de dependência (Enfermagem)</Text>
          <View style={s.chips}>
            {NIVEIS_DEPENDENCIA.map((item) => {
              const on = nivelDependencia === item.valor;
              return (
                <TouchableOpacity
                  key={item.valor}
                  style={[
                    s.chip,
                    { borderColor: item.cor, backgroundColor: on ? item.cor : item.fundo },
                  ]}
                  onPress={() => setNivelDependencia(item.valor)}
                >
                  <Text style={{ color: on ? '#fff' : item.cor, fontWeight: '700' }}>
                    {item.rotulo}
                  </Text>
                </TouchableOpacity>
              );
            })}
          </View>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Observações</Text>
          <TextInput style={[s.input, { height: 120 }]} multiline value={observacao} onChangeText={setObservacao} textAlignVertical="top" placeholder="Como o paciente está, o que aconteceu no plantão..." placeholderTextColor={colors.muted} />
        </View>

        <View style={s.card}>
          <Text style={s.label}>Checklist da passagem</Text>
          <Text style={s.helper}>Registre o que a próxima equipe precisa verificar e confirmar.</Text>
          {itensChecklist.map((item, idx) => (
            <View key={item.id ?? `check-${idx}`} style={s.checkItem}>
              {item.cancelado_em || item.cancelarAgora ? (
                <View style={s.confirmedChecklistItem}>
                  <Text style={s.confirmedChecklistText}>{item.descricao}</Text>
                  <Text style={s.helper}>Cancelado · mantido no histórico</Text>
                </View>
              ) : item.confirmado || (item.id && String(item.registrado_por) !== String(meuProfissionalId)) ? (
                <View style={s.confirmedChecklistItem}>
                  <Text style={s.confirmedChecklistText}>{item.descricao}</Text>
                  <Text style={s.helper}>{item.confirmado ? 'Confirmado · não pode ser alterado' : 'Registrado por outro profissional · sem permissão para editar'}</Text>
                </View>
              ) : <>
                <TextInput style={[s.input, { flex: 1 }]} value={item.descricao} onChangeText={(descricao) => setItemChecklist(idx, { descricao })} placeholder="Item a verificar" placeholderTextColor={colors.muted} />
                <TouchableOpacity onPress={() => item.id ? setItemChecklist(idx, { cancelarAgora: true }) : removeItemChecklist(idx)}><Text style={s.del}>{item.id ? 'Cancelar item' : 'Remover'}</Text></TouchableOpacity>
                {!item.id && <View style={s.priorityRow}>
                  {[
                    ['critico', 'Crítico'],
                    ['atencao', 'Atenção'],
                    ['rotina', 'Rotina'],
                  ].map(([value, label]) => (
                    <TouchableOpacity key={value} style={[s.priorityChip, item.prioridade === value && s[`priority${value[0].toUpperCase()}${value.slice(1)}Selected`]]} onPress={() => setItemChecklist(idx, { prioridade: value })}>
                      <Text style={[s.priorityText, item.prioridade === value && s.priorityTextSelected]}>{label}</Text>
                    </TouchableOpacity>
                  ))}
                </View>}
              </>}
            </View>
          ))}
          <TouchableOpacity style={s.addChecklist} onPress={addItemChecklist}>
            <Text style={s.addChecklistText}>+ Adicionar item ao checklist</Text>
          </TouchableOpacity>
        </View>

        <View style={s.card}>
          <Text style={s.label}>Pendências para o próximo plantão</Text>
          {pendencias.map((p, i) => (
            <View key={p.id ?? `n${i}`} style={s.pendRow}>
              <Text style={s.pendTxt}>{p.descricao}</Text>
              <TouchableOpacity hitSlop={8} onPress={() => removePendencia(i)}>
                <Text style={s.del}>Remover</Text>
              </TouchableOpacity>
            </View>
          ))}
          <View style={s.pendRow}>
            <TextInput style={[s.input, { flex: 1 }]} value={nova} onChangeText={setNova} placeholder="Nova pendência" placeholderTextColor={colors.muted} onSubmitEditing={addPendencia} returnKeyType="done" />
            <TouchableOpacity style={s.addBtn} onPress={addPendencia}>
              <Text style={s.addTxt}>Adicionar</Text>
            </TouchableOpacity>
          </View>
        </View>

        <TouchableOpacity style={s.btn} onPress={() => salvar(true)} disabled={saving || loadingChecklist}>
          {saving || loadingChecklist ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>Salvar rascunho e continuar depois</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.finalizarBtn]} onPress={() => salvar(false)} disabled={saving || loadingChecklist}>
          <Text style={s.btnText}>Concluir passagem</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { padding: space.lg, gap: space.lg, flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  paciente: { fontSize: 18, fontWeight: '800', color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.border, ...shadow },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: space.md, fontSize: 16, color: colors.text, backgroundColor: colors.bg },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 8 },
  pendRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pendTxt: { flex: 1, color: colors.text, fontSize: 15 },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: space.lg, paddingVertical: 14, borderRadius: radius.sm },
  addTxt: { color: '#fff', fontWeight: '700' },
  del: { color: colors.danger, fontWeight: '600' },
  helper: { color: colors.muted, fontSize: 13 },
  confirmedChecklistItem: { gap: space.xs },
  confirmedChecklistText: { color: colors.text, fontSize: 15, fontWeight: '600' },
  checkItem: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md, gap: space.sm },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  priorityChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  priorityCriticoSelected: { backgroundColor: '#FEE2E2', borderColor: '#DC2626' },
  priorityAtencaoSelected: { backgroundColor: '#FEF3C7', borderColor: '#D97706' },
  priorityRotinaSelected: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  priorityText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  priorityTextSelected: { color: colors.text },
  addChecklist: {
    backgroundColor: '#EFF6FF',
    borderWidth: 1.5,
    borderColor: colors.primary,
    borderRadius: radius.pill,
    paddingHorizontal: space.lg,
    paddingVertical: 10,
    alignSelf: 'flex-start',
    marginTop: space.xs,
  },
  addChecklistText: { color: colors.primary, fontWeight: '800', fontSize: 13 },
  templateSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  formSection: { borderTopWidth: 1, borderColor: colors.border, paddingTop: space.md, gap: space.sm },
  sectionTitle: { color: colors.text, fontWeight: '800', fontSize: 15 },
  field: { gap: 6 },
  fieldLabel: { color: colors.text, fontWeight: '600', fontSize: 14 },
  option: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 10, paddingVertical: 7 },
  optionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  optionText: { color: colors.text, fontSize: 13 },
  optionTextSelected: { color: '#fff', fontWeight: '700' },
  btn: { backgroundColor: colors.primary, padding: 16, borderRadius: radius.md, alignItems: 'center', marginTop: space.sm },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  finalizarBtn: { backgroundColor: '#15803D', marginTop: 0 },
});
