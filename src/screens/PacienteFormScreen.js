import React, { useEffect, useState } from 'react';
import { View, Text, TextInput, TouchableOpacity, Alert, StyleSheet, ActivityIndicator, Modal, FlatList } from 'react-native';
import { pacientesApi, leitosApi } from '../services/api';
import { colors, space, radius, shadow } from '../theme.js';

export default function PacienteFormScreen({ route, navigation }) {
  const { setor, paciente } = route.params; // paciente existe => edição
  const editando = !!paciente;
  const [identificacao, setIdentificacao] = useState(paciente?.identificacao ?? '');
  const [leitos, setLeitos] = useState([]);
  const [leitoId, setLeitoId] = useState(paciente?.leito_id ?? null);
  const [modalLeitos, setModalLeitos] = useState(false);
  const [loadingLeitos, setLoadingLeitos] = useState(true);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    let ativo = true;
    leitosApi.listLivresBySetor(setor.id, paciente?.id ?? null)
      .then((lista) => { if (ativo) setLeitos(lista); })
      .catch((e) => Alert.alert('Erro ao carregar leitos', e.message))
      .finally(() => { if (ativo) setLoadingLeitos(false); });
    return () => { ativo = false; };
  }, [setor.id, paciente?.id]);

  const salvar = async () => {
    if (!identificacao.trim()) return Alert.alert('Atenção', 'Informe a identificação do paciente.');
    setSaving(true);
    try {
      if (!leitoId) return Alert.alert('Atenção', 'Escolha um leito livre para este paciente.');
      const payload = { identificacao: identificacao.trim(), leito_id: leitoId };
      if (editando) await pacientesApi.update(paciente.id, payload);
      else await pacientesApi.create({ ...payload, setor_id: setor.id });
      navigation.goBack();
    } catch (e) {
      Alert.alert('Erro', e.message);
    } finally {
      setSaving(false);
    }
  };

  return (
    <View style={s.container}>
      <View style={s.card}>
        <Text style={s.label}>Identificação</Text>
        <TextInput style={s.input} value={identificacao} onChangeText={setIdentificacao} placeholder="Ex.: iniciais ou código" placeholderTextColor={colors.muted} />
        <Text style={[s.label, { marginTop: space.md }]}>Leito livre</Text>
        <TouchableOpacity style={s.input} onPress={() => setModalLeitos(true)} disabled={loadingLeitos}>
          <Text style={{ color: leitoId ? colors.text : colors.muted }}>
            {loadingLeitos ? 'Carregando leitos…' : leitos.find((l) => l.id === leitoId)?.identificacao ?? (leitoId ? paciente?.leito : null) ?? 'Selecionar leito'}
          </Text>
        </TouchableOpacity>
        {!loadingLeitos && !leitos.length && <Text style={s.helper}>Não há leitos livres ativos neste setor.</Text>}
      </View>
      <TouchableOpacity style={s.btn} onPress={salvar} disabled={saving}>
        {saving ? <ActivityIndicator color="#fff" /> : <Text style={s.btnText}>{editando ? 'Salvar alterações' : 'Cadastrar paciente'}</Text>}
      </TouchableOpacity>
      <Modal visible={modalLeitos} transparent animationType="slide" onRequestClose={() => setModalLeitos(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>Escolha um leito livre</Text>
            <FlatList
              data={leitos}
              keyExtractor={(item) => item.id}
              ListEmptyComponent={<Text style={s.helper}>Nenhum leito livre disponível.</Text>}
              renderItem={({ item }) => (
                <TouchableOpacity style={s.leitoOption} onPress={() => { setLeitoId(item.id); setModalLeitos(false); }}>
                  <Text style={s.optionText}>{item.identificacao}</Text>
                  {leitoId === item.id && <Text style={s.selectedMark}>Selecionado</Text>}
                </TouchableOpacity>
              )}
            />
            {editando && paciente?.leito_id && !leitos.some((l) => l.id === paciente.leito_id) && (
              <TouchableOpacity style={s.leitoOption} onPress={() => { setLeitoId(paciente.leito_id); setModalLeitos(false); }}>
                <Text style={s.optionText}>{paciente.leito} (atual)</Text>
              </TouchableOpacity>
            )}
            <TouchableOpacity style={s.cancelButton} onPress={() => setModalLeitos(false)}><Text style={s.cancelText}>Fechar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, padding: space.lg, backgroundColor: colors.bg, gap: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, gap: space.sm, borderWidth: 1, borderColor: colors.border, ...shadow },
  label: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6 },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: space.md, fontSize: 16, color: colors.text, backgroundColor: colors.bg },
  btn: { backgroundColor: colors.primary, padding: 16, borderRadius: radius.md, alignItems: 'center' },
  btnText: { color: '#fff', fontWeight: '700', fontSize: 16 },
  helper: { color: colors.muted, fontSize: 13, marginTop: space.sm },
  modalBackdrop: { flex: 1, backgroundColor: '#0007', justifyContent: 'flex-end' },
  modalCard: { backgroundColor: colors.surface, borderTopLeftRadius: radius.lg, borderTopRightRadius: radius.lg, padding: space.lg, maxHeight: '70%' },
  modalTitle: { color: colors.text, fontSize: 18, fontWeight: '700', marginBottom: space.md },
  leitoOption: { borderBottomWidth: 1, borderColor: colors.border, paddingVertical: space.md, flexDirection: 'row', justifyContent: 'space-between' },
  optionText: { color: colors.text, fontSize: 16 },
  selectedMark: { color: colors.primary, fontWeight: '700' },
  cancelButton: { marginTop: space.md, padding: space.md, alignItems: 'center' },
  cancelText: { color: colors.primary, fontWeight: '700' },
});
