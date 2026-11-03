import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator, ScrollView, KeyboardAvoidingView, Platform } from 'react-native';
import { passagensApi, checklistApi, ESTADOS_GERAIS, getMeuProfissionalId } from '../services/api';
import { colors, space, radius, shadow, estadoVisual } from '../theme.js';

export default function NovaPassagemScreen({ route, navigation }) {
  const { paciente, passagem } = route.params; // passagem existe => edição
  const editando = !!passagem;
  const [estado, setEstado] = useState(passagem?.estado_geral ?? ESTADOS_GERAIS[0]);
  const [observacao, setObservacao] = useState(passagem?.observacao ?? '');
  const [pendencias, setPendencias] = useState(
    (passagem?.pendencias ?? []).map((p) => ({ id: p.id, descricao: p.descricao }))
  );
  const [nova, setNova] = useState('');
  const [itensChecklist, setItensChecklist] = useState([]);
  const [loadingChecklist, setLoadingChecklist] = useState(!!passagem?.id);
  const [saving, setSaving] = useState(false);
  const [meuProfissionalId, setMeuProfissionalId] = useState(null);

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

  const salvar = async () => {
    if (!observacao.trim()) return Alert.alert('Atenção', 'Descreva a observação.');
    setSaving(true);
    try {
      const dados = { estado_geral: estado, observacao: observacao.trim(), pendencias, itensChecklist };
      if (editando) await passagensApi.update(passagem.id, dados);
      else await passagensApi.create({ ...dados, paciente_id: paciente.id });
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
          <TouchableOpacity style={s.addChecklist} onPress={addItemChecklist}><Text style={s.addTxt}>+ Adicionar item</Text></TouchableOpacity>
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

        <TouchableOpacity style={s.btn} onPress={salvar} disabled={saving || loadingChecklist}>
          {saving || loadingChecklist ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{editando ? 'Salvar alterações' : 'Registrar passagem'}</Text>}
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
  addChecklist: { alignSelf: 'flex-start', borderWidth: 1, borderColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: space.lg, paddingVertical: 9 },
  btn: { backgroundColor: colors.primary, padding: 16, borderRadius: radius.md, alignItems: 'center', marginTop: space.sm },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
});
