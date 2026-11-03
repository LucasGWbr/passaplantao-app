import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, RefreshControl, LayoutAnimation, Platform, UIManager, Modal, TextInput } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { passagensApi, pendenciasApi, checklistApi, getMeuProfissionalId, STATUS_PENDENCIA } from '../services/api';
import PassagemCard from '../components/PassagemCard';
import EstadoBadge from '../components/EstadoBadge';
import { colors, space, radius, shadow } from '../theme.js';

if (Platform.OS === 'android' && UIManager.setLayoutAnimationEnabledExperimental) {
  UIManager.setLayoutAnimationEnabledExperimental(true);
}

export default function PacienteDetalhesScreen({ route, navigation }) {
  const { paciente } = route.params;
  const insets = useSafeAreaInsets();
  const [passagens, setPassagens] = useState([]);
  const [loading, setLoading] = useState(false);
  const [abertos, setAbertos] = useState({}); // { [passagemId]: true } só para o histórico
  const [itensChecklist, setItensChecklist] = useState([]);
  const [meuProfissionalId, setMeuProfissionalId] = useState(null);
  const [modalChecklist, setModalChecklist] = useState(false);
  const [itemEditando, setItemEditando] = useState(null);
  const [descricaoItem, setDescricaoItem] = useState('');
  const [prioridadeItem, setPrioridadeItem] = useState('rotina');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [lista, checklist] = await Promise.all([
        passagensApi.listByPaciente(paciente.id),
        checklistApi.listByPaciente(paciente.id),
      ]);
      const profissionalId = await getMeuProfissionalId();
      setPassagens(lista);
      setItensChecklist(checklist);
      setMeuProfissionalId(profissionalId);
    } catch (e) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  }, [paciente.id]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const toggleAberto = (id) => {
    LayoutAnimation.configureNext(LayoutAnimation.Presets.easeInEaseOut);
    setAbertos((prev) => ({ ...prev, [id]: !prev[id] }));
  };

  const abrirItem = (item = null) => {
    setItemEditando(item);
    setDescricaoItem(item?.descricao ?? '');
    setPrioridadeItem(item?.prioridade ?? 'rotina');
    setModalChecklist(true);
  };

  const salvarItem = async () => {
    try {
      if (itemEditando) {
        await checklistApi.update(itemEditando.id, { descricao: descricaoItem });
      } else {
        const passagemAtual = passagens[0];
        if (!passagemAtual) {
          setModalChecklist(false);
          Alert.alert('Registre uma passagem primeiro', 'Os itens do checklist ficam vinculados à passagem do plantão.');
          return;
        }
        await checklistApi.create({ passagem_id: passagemAtual.id, descricao: descricaoItem, prioridade: prioridadeItem });
      }
      setModalChecklist(false);
      await load();
    } catch (e) { Alert.alert('Erro ao salvar item', e.message); }
  };

  const cancelarItem = (item) => Alert.alert('Cancelar item', 'O item será mantido no histórico e deixará de exigir confirmação. Confirma?', [
    { text: 'Voltar', style: 'cancel' },
    { text: 'Cancelar item', style: 'destructive', onPress: async () => {
      try { await checklistApi.cancel(item.id); await load(); }
      catch (e) { Alert.alert('Erro ao cancelar item', e.message); }
    } },
  ]);

  const confirmarItem = async (item) => {
    try {
      await checklistApi.confirm(item.id);
      await load();
    } catch (e) { Alert.alert('Erro ao confirmar item', e.message); }
  };

  const editarPassagem = (passagem) => navigation.navigate('NovaPassagem', { paciente, passagem });
  const excluirPassagem = (passagem) => Alert.alert('Excluir passagem', 'Esta ação remove a passagem e as pendências ainda ligadas a ela. Confirma?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Excluir', style: 'destructive', onPress: async () => {
      try { await passagensApi.remove(passagem.id); await load(); }
      catch (e) { Alert.alert('Erro ao excluir passagem', e.message); }
    } },
  ]);

  const togglePendencia = async (passagemId, pend) => {
    const novo = pend.status === STATUS_PENDENCIA.CONCLUIDA ? STATUS_PENDENCIA.ABERTA : STATUS_PENDENCIA.CONCLUIDA;
    try {
      await pendenciasApi.setStatus(pend.id, novo);
      setPassagens((prev) =>
        prev.map((p) =>
          p.id !== passagemId
            ? p
            : { ...p, pendencias: p.pendencias.map((x) => (x.id === pend.id ? { ...x, status: novo } : x)) }
        )
      );
    } catch (e) {
      Alert.alert('Erro', e.message);
    }
  };

  const ultima = passagens[0];
  const historico = passagens.slice(1);

  const cardProps = (item) => ({
    item,
    onTogglePendencia: togglePendencia,
    onEdit: String(item.profissional_id) === String(meuProfissionalId) ? editarPassagem : null,
    onDelete: String(item.profissional_id) === String(meuProfissionalId) && !itensChecklist.some((check) => String(check.passagem_id) === String(item.id)) ? excluirPassagem : null,
  });

  const Header = () => (
    <View>
      <View style={s.pacienteCard}>
        <View style={{ flex: 1 }}>
          <Text style={s.nome}>{paciente.identificacao}</Text>
          {!!paciente.leito && <Text style={s.leito}>Leito {paciente.leito}</Text>}
        </View>
        <EstadoBadge estado={ultima?.estado_geral} />
      </View>

      <Text style={s.secao}>Última passagem</Text>
      {ultima ? (
        <PassagemCard {...cardProps(ultima)} destaque />
      ) : (
        !loading && <Text style={s.empty}>Nenhuma passagem registrada.</Text>
      )}

      {historico.length > 0 && <Text style={s.secao}>Histórico ({historico.length})</Text>}

      <View style={s.checklistHeader}>
        <View style={{ flex: 1 }}>
          <Text style={s.secao}>Checklist de passagem</Text>
          <Text style={s.checklistHint}>Confirme cada item recebido. Itens críticos pendentes bloqueiam o registro da próxima passagem.</Text>
        </View>
        {paciente.ativo !== false && <TouchableOpacity style={s.addItemButton} onPress={() => abrirItem()}><Text style={s.addItemText}>+ Item</Text></TouchableOpacity>}
      </View>
      {itensChecklist.length === 0 && !loading && <Text style={s.empty}>Nenhum item de checklist registrado.</Text>}
      {itensChecklist.map((item) => {
        const souAutor = String(item.registrado_por) === String(meuProfissionalId);
        const critico = item.prioridade === 'critico';
        const prioridade = item.prioridade === 'critico' ? 'Crítico' : item.prioridade === 'atencao' ? 'Atenção' : 'Rotina';
        return (
          <View key={item.id} style={[s.checkItemCard, critico && s.criticalCard]}>
            <View style={s.checkItemTop}>
              <Text style={[s.priorityBadge, critico ? s.criticalBadge : item.prioridade === 'atencao' ? s.attentionBadge : s.routineBadge]}>{prioridade}</Text>
              {!item.confirmado && !item.cancelado_em && souAutor && <View style={{ flexDirection: 'row', gap: space.md }}>
                <TouchableOpacity onPress={() => abrirItem(item)}><Text style={s.editItem}>Editar</Text></TouchableOpacity>
                <TouchableOpacity onPress={() => cancelarItem(item)}><Text style={s.deleteItem}>Cancelar</Text></TouchableOpacity>
              </View>}
            </View>
            <Text style={s.checkItemText}>{item.descricao}</Text>
            {item.cancelado_em ? (
              <Text style={s.awaitingText}>Cancelado · mantido no histórico.</Text>
            ) : item.confirmado ? (
              <Text style={s.confirmedText}>Confirmado · {new Date(item.confirmacoes?.[0]?.confirmado_em).toLocaleString('pt-BR')}</Text>
            ) : souAutor ? (
              <Text style={s.awaitingText}>Aguardando confirmação de outro profissional.</Text>
            ) : (
              <TouchableOpacity style={s.confirmButton} onPress={() => confirmarItem(item)}><Text style={s.confirmButtonText}>Confirmar recebimento</Text></TouchableOpacity>
            )}
          </View>
        );
      })}
    </View>
  );

  return (
    <View style={s.container}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={historico}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 96 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          <PassagemCard {...cardProps(item)} expandido={!!abertos[item.id]} onToggle={() => toggleAberto(item.id)} />
        )}
      />

      {paciente.ativo !== false && <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + space.lg }]}
        onPress={() => navigation.navigate('NovaPassagem', { paciente })}
      >
        <Text style={s.fabText}>+ Nova passagem</Text>
      </TouchableOpacity>}

      <Modal visible={modalChecklist} transparent animationType="fade" onRequestClose={() => setModalChecklist(false)}>
        <View style={s.modalBackdrop}>
          <View style={s.modalCard}>
            <Text style={s.modalTitle}>{itemEditando ? 'Editar item do checklist' : 'Novo item do checklist'}</Text>
            <TextInput style={s.modalInput} value={descricaoItem} onChangeText={setDescricaoItem} placeholder="O que a próxima equipe deve verificar?" placeholderTextColor={colors.muted} multiline />
            <Text style={s.modalLabel}>Prioridade{itemEditando ? ' · fixa após o registro' : ''}</Text>
            {itemEditando ? <Text style={s.modalInput}>{prioridadeItem === 'critico' ? 'Crítico' : prioridadeItem === 'atencao' ? 'Atenção' : 'Rotina'}</Text> : <View style={s.priorityOptions}>
              {[
                ['critico', 'Crítico'], ['atencao', 'Atenção'], ['rotina', 'Rotina'],
              ].map(([value, label]) => (
                <TouchableOpacity key={value} onPress={() => setPrioridadeItem(value)} style={[s.priorityOption, prioridadeItem === value && s.priorityOptionSelected]}>
                  <Text style={[s.priorityOptionText, prioridadeItem === value && s.priorityOptionTextSelected]}>{label}</Text>
                </TouchableOpacity>
              ))}
            </View>}
            <TouchableOpacity style={s.confirmButton} onPress={salvarItem}><Text style={s.confirmButtonText}>Salvar item</Text></TouchableOpacity>
            <TouchableOpacity style={s.closeButton} onPress={() => setModalChecklist(false)}><Text style={s.editItem}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
  pacienteCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, marginBottom: space.xl, borderWidth: 1, borderColor: colors.border, ...shadow },
  nome: { fontSize: 22, fontWeight: '800', color: colors.text },
  leito: { color: colors.muted, marginTop: 2 },
  secao: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', letterSpacing: 0.6, marginBottom: space.sm, marginTop: space.xs },
  empty: { textAlign: 'center', marginVertical: space.xl, color: colors.muted },
  fab: { position: 'absolute', right: space.lg, backgroundColor: colors.primary, paddingHorizontal: space.xl, paddingVertical: 14, borderRadius: radius.pill, ...shadow, shadowOpacity: 0.25 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
  checklistHeader: { flexDirection: 'row', alignItems: 'center', gap: space.md, marginTop: space.lg, marginBottom: space.md },
  checklistHint: { color: colors.muted, fontSize: 12, lineHeight: 17 },
  addItemButton: { backgroundColor: colors.primary, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 9 },
  addItemText: { color: '#fff', fontSize: 12, fontWeight: '700' },
  checkItemCard: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.md, marginBottom: space.sm, borderWidth: 1, borderColor: colors.border },
  criticalCard: { borderColor: colors.danger, borderLeftWidth: 5 },
  checkItemTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', marginBottom: space.sm },
  priorityBadge: { borderRadius: radius.pill, overflow: 'hidden', paddingHorizontal: space.sm, paddingVertical: 4, fontSize: 11, fontWeight: '800' },
  criticalBadge: { color: '#B91C1C', backgroundColor: '#FEE2E2' },
  attentionBadge: { color: '#B45309', backgroundColor: '#FEF3C7' },
  routineBadge: { color: '#15803D', backgroundColor: '#DCFCE7' },
  editItem: { color: colors.primary, fontWeight: '700', fontSize: 13 },
  deleteItem: { color: colors.danger, fontWeight: '700', fontSize: 13 },
  checkItemText: { color: colors.text, fontSize: 15, marginBottom: space.sm },
  confirmedText: { color: colors.success, fontSize: 12, fontWeight: '700' },
  awaitingText: { color: colors.muted, fontSize: 12, fontStyle: 'italic' },
  confirmButton: { backgroundColor: colors.primary, borderRadius: radius.sm, padding: space.md, alignItems: 'center' },
  confirmButtonText: { color: '#fff', fontWeight: '700' },
  modalBackdrop: { flex: 1, backgroundColor: '#0007', justifyContent: 'center', padding: space.lg },
  modalCard: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  modalTitle: { color: colors.text, fontSize: 19, fontWeight: '800' },
  modalInput: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: space.md, minHeight: 82, color: colors.text, textAlignVertical: 'top' },
  modalLabel: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase' },
  priorityOptions: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm },
  priorityOption: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingHorizontal: space.md, paddingVertical: 8 },
  priorityOptionSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  priorityOptionText: { color: colors.muted, fontSize: 12, fontWeight: '700' },
  priorityOptionTextSelected: { color: '#fff' },
  closeButton: { alignItems: 'center', padding: space.sm },
});
