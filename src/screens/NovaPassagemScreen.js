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

  const addItemChecklist = () => setItensChecklist((prev) => [...prev, { descricao: '', prioridade: 'rotina' }]);
  const setItemChecklist = (idx, patch) => setItensChecklist((prev) => prev.map((item, i) => i === idx ? { ...item, ...patch } : item));
  const removeItemChecklist = (idx) => setItensChecklist((prev) => prev.filter((_, i) => i !== idx));

  const salvar = async (rascunho = true) => {
    if (saving || loadingChecklist) return;
    if (editando && passagem.rascunho !== true) { Alert.alert('Passagem finalizada', 'Este registro está disponível somente para consulta.'); return; }
    setSaving(true);
    try {
      // Atualiza dados do paciente antes de selar o registro da passagem.
      if (nivelDependencia && nivelDependencia !== paciente.nivel_dependencia) {
        await pacientesApi.updateNivelDependencia(paciente.id, nivelDependencia);
        paciente.nivel_dependencia = nivelDependencia;
      }
      const dados = { estado_geral: estado, observacao: observacao.trim(), itensChecklist, ficha, tipo_ficha: tipoFicha, rascunho };
      if (editando) await passagensApi.update(passagem.id, dados);
      else await passagensApi.create({ ...dados, paciente_id: paciente.id });

      navigation.goBack();
    } catch (e) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  };

  if (editando && passagem.rascunho !== true) return <View style={s.container}><Text style={s.paciente}>Passagem finalizada</Text><Text style={s.helper}>Este registro está disponível somente para consulta no histórico.</Text></View>;

  return (
    <KeyboardAvoidingView style={{ flex: 1 }} behavior={Platform.OS === 'ios' ? 'padding' : undefined}>
      <ScrollView contentInsetAdjustmentBehavior="automatic" style={{ backgroundColor: colors.bg }} contentContainerStyle={s.container} keyboardShouldPersistTaps="handled">
        <Text style={s.titulo}>Passagem de plantão</Text>
        <Text style={s.helper}>Comunicação que cuida.</Text>
        <Text style={s.paciente}>{paciente.identificacao}{paciente.leito ? ` · Leito ${paciente.leito}` : ''}</Text>
        {paciente.data_nascimento ? <Text style={s.helper}>Nascimento: {paciente.data_nascimento.split('-').reverse().join('/')}</Text> : null}

        <View style={s.card}>
          <Text style={s.label}>Ficha de passagem · preenchimento parcial</Text>
          <Text style={s.helper}>Os campos começam em branco. Marque ou preencha somente o que foi observado; você pode salvar e continuar depois.</Text>
          <View style={s.chips}>{[['clinica','Clínica / cirúrgica'],['obstetrica','Obstetrícia']].map(([value,label]) => <TouchableOpacity key={value} style={[s.chip, tipoFicha === value && s.templateSelected]} onPress={() => setTipoFicha(value)}><Text style={{ color: tipoFicha === value ? '#fff' : colors.text, fontFamily: 'Inter_700Bold' }}>{label}</Text></TouchableOpacity>)}</View>
          {gruposFicha.map(([grupo, campos]) => <View key={grupo} style={s.formSection}><Text style={s.sectionTitle}>{grupo}</Text>{campos.map(([key,label,opcoes]) => <View key={key} style={s.field}><Text style={s.fieldLabel}>{label}</Text>{opcoes ? <View style={s.chips}>{opcoes.map((opcao) => <TouchableOpacity key={opcao} accessibilityRole="checkbox" accessibilityState={{ checked: ficha[key] === opcao }} style={[s.option, ficha[key] === opcao && s.optionSelected]} onPress={() => atualizarFicha(key, ficha[key] === opcao ? '' : opcao)}><Text style={[s.optionText, ficha[key] === opcao && s.optionTextSelected]}>{ficha[key] === opcao ? '✓ ' : ''}{opcao}</Text></TouchableOpacity>)}</View> : <TextInput style={s.input} value={ficha[key] ?? ''} onChangeText={(v) => atualizarFicha(key, v)} placeholder="Preencher se aplicável" placeholderTextColor={colors.muted} />}</View>)}</View>)}
          <Text style={s.fieldLabel}>Intercorrências</Text>
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
                  <Text style={{ color: on ? '#fff' : v.cor, fontFamily: 'Inter_700Bold' }}>{c}</Text>
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
                  <Text style={{ color: on ? '#fff' : item.cor, fontFamily: 'Inter_700Bold' }}>
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
          <Text style={s.label}>Cuidados para o próximo plantão</Text>
          <Text style={s.helper}>Registre pendências e cuidados, informe a prioridade e a próxima equipe confirmará o recebimento.</Text>
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
            <Text style={s.addChecklistText}>+ Adicionar cuidado ou pendência</Text>
          </TouchableOpacity>
        </View>

        <TouchableOpacity style={[s.btn, s.rascunhoBtn, (saving || loadingChecklist) && { opacity: 0.5 }]} onPress={() => salvar(true)} disabled={saving || loadingChecklist}>
          {saving || loadingChecklist ? <ActivityIndicator color={colors.primary} /> : <Text style={[s.btnText, { color: colors.primary }]}>Salvar rascunho e continuar depois</Text>}
        </TouchableOpacity>
        <TouchableOpacity style={[s.btn, s.finalizarBtn, (saving || loadingChecklist) && { opacity: 0.5 }]} onPress={() => Alert.alert('Finalizar passagem?', 'Após finalizar, o registro não poderá ser editado ou excluído. A próxima equipe poderá consultar e confirmar o recebimento dos cuidados.', [{ text: 'Continuar preenchendo', style: 'cancel' }, { text: 'Finalizar definitivamente', onPress: () => salvar(false) }])} disabled={saving || loadingChecklist}>
          <Text style={s.btnText}>Finalizar passagem definitivamente</Text>
        </TouchableOpacity>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  container: { padding: space.lg, gap: space.lg, flexGrow: 1, width: '100%', maxWidth: 720, alignSelf: 'center' },
  titulo: { fontFamily: 'Inter_700Bold', color: colors.primary, fontSize: 26 },
  paciente: { fontSize: 18, fontFamily: 'Inter_700Bold', color: colors.text },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.border, ...shadow },
  label: { fontSize: 20, lineHeight: 28, fontFamily: 'Inter_600SemiBold', color: colors.primary },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: space.md, fontFamily: 'Inter_400Regular', fontSize: 16, color: colors.text, backgroundColor: colors.surface },
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  chip: { borderWidth: 1.5, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 8 },
  pendRow: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  pendTxt: { flex: 1, color: colors.text, fontSize: 15 },
  addBtn: { backgroundColor: colors.primary, paddingHorizontal: space.lg, paddingVertical: 14, borderRadius: radius.sm },
  addTxt: { color: '#fff', fontFamily: 'Inter_700Bold' },
  del: { color: colors.danger, fontFamily: 'Inter_600SemiBold' },
  helper: { color: colors.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 22 },
  confirmedChecklistItem: { gap: space.xs },
  confirmedChecklistText: { color: colors.text, fontSize: 15, fontFamily: 'Inter_600SemiBold' },
  checkItem: { borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md, gap: space.sm },
  priorityRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  priorityChip: { minHeight: 44, justifyContent: 'center', borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 6 },
  priorityCriticoSelected: { backgroundColor: '#FEE2E2', borderColor: '#DC2626' },
  priorityAtencaoSelected: { backgroundColor: '#FEF3C7', borderColor: '#D97706' },
  priorityRotinaSelected: { backgroundColor: '#DCFCE7', borderColor: '#16A34A' },
  priorityText: { color: colors.muted, fontSize: 12, fontFamily: 'Inter_700Bold' },
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
  addChecklistText: { color: colors.primary, fontFamily: 'Inter_700Bold', fontSize: 13 },
  templateSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  formSection: { borderTopWidth: 1, borderColor: colors.border, paddingTop: space.md, gap: space.sm },
  sectionTitle: { color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 20, lineHeight: 28 },
  field: { gap: 8, paddingVertical: 8 },
  fieldLabel: { color: colors.text, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  option: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: 12, paddingVertical: 12, minHeight: 44, justifyContent: 'center' },
  optionSelected: { backgroundColor: '#E8F3FA', borderColor: colors.primary, borderWidth: 2 },
  optionText: { color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },
  optionTextSelected: { color: colors.primary, fontFamily: 'Inter_700Bold' },
  btn: { backgroundColor: colors.primary, padding: 16, borderRadius: radius.md, alignItems: 'center', marginTop: space.sm },
  btnText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 16 },
  rascunhoBtn: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.primary },
  finalizarBtn: { backgroundColor: colors.primary, marginTop: 0 },
});
