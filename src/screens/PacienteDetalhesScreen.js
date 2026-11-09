import React, { useCallback, useState } from 'react';
import { View, Text, FlatList, TouchableOpacity, Alert, StyleSheet, RefreshControl, LayoutAnimation, Platform, UIManager } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { passagensApi, checklistApi, getMeuProfissionalId } from '../services/api';
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
  const [alturaBotao, setAlturaBotao] = useState(56);
  const [loading, setLoading] = useState(false);
  const [abertos, setAbertos] = useState({}); // { [passagemId]: true } só para o histórico
  const [itensChecklist, setItensChecklist] = useState([]);
  const [meuProfissionalId, setMeuProfissionalId] = useState(null);
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

  const confirmarItem = async (item) => {
    try {
      await checklistApi.confirm(item.id);
      await load();
    } catch (e) { Alert.alert('Erro ao confirmar item', e.message); }
  };

  const editarPassagem = (passagem) => navigation.navigate('NovaPassagem', { paciente, passagem });
  const excluirPassagem = (passagem) => Alert.alert('Arquivar rascunho', 'O registro deixará de aparecer na consulta, mas todo o histórico será preservado. Confirma?', [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Arquivar', style: 'destructive', onPress: async () => {
      try { await passagensApi.remove(passagem.id); await load(); }
      catch (e) { Alert.alert('Erro ao excluir passagem', e.message); }
    } },
  ]);

  const rascunhos = passagens.filter((p) => p.rascunho === true);
  const finalizadas = passagens.filter((p) => p.rascunho !== true);
  const ultima = finalizadas[0];
  const historico = finalizadas.slice(1);

  const cardProps = (item) => ({
    item,
    cuidados: itensChecklist.filter((check) => String(check.passagem_id) === String(item.id)),
    profissionalId: meuProfissionalId,
    onConfirmar: confirmarItem,
    onEdit: item.rascunho === true && paciente.ativo !== false && String(item.profissional_id) === String(meuProfissionalId) ? editarPassagem : null,
    onDelete: item.rascunho === true && String(item.profissional_id) === String(meuProfissionalId) && !itensChecklist.some((check) => String(check.passagem_id) === String(item.id)) ? excluirPassagem : null,
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

      {rascunhos.length > 0 && <Text style={s.secao}>Em preenchimento ({rascunhos.length})</Text>}
      {rascunhos.map((item) => <PassagemCard key={item.id} {...cardProps(item)} expandido={!!abertos[item.id]} onToggle={() => toggleAberto(item.id)} />)}
      <Text style={s.secao}>Última passagem finalizada</Text>
      {ultima ? (
        <PassagemCard {...cardProps(ultima)} destaque />
      ) : (
        !loading && <Text style={s.empty}>Nenhuma passagem finalizada. Os rascunhos podem ser continuados durante o plantão.</Text>
      )}


      {historico.length > 0 && <Text style={s.secao}>Passagens anteriores ({historico.length})</Text>}
    </View>
  );

  return (
    <View style={s.container}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={historico}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[s.list, { paddingBottom: paciente.ativo !== false ? insets.bottom + alturaBotao + space.lg * 3 : insets.bottom + space.lg }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={Header}
        renderItem={({ item }) => (
          <PassagemCard {...cardProps(item)} expandido={!!abertos[item.id]} onToggle={() => toggleAberto(item.id)} />
        )}
      />

      {paciente.ativo !== false && <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + space.lg }]}
        onLayout={(event) => setAlturaBotao(event.nativeEvent.layout.height)}
        accessibilityRole="button"
        onPress={() => { const rascunho = passagens.find((p) => p.rascunho && String(p.profissional_id) === String(meuProfissionalId)); navigation.navigate('NovaPassagem', { paciente, passagem: rascunho }); }}
      >
        <Text style={s.fabText}>{passagens.some((p) => p.rascunho && String(p.profissional_id) === String(meuProfissionalId)) ? 'Continuar rascunho' : '+ Nova passagem'}</Text>
      </TouchableOpacity>}


    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
  pacienteCard: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, marginBottom: space.xl, borderWidth: 1, borderColor: colors.border, ...shadow },
  nome: { fontSize: 22, fontFamily: 'Inter_700Bold', color: colors.text },
  leito: { color: colors.muted, marginTop: 2 },
  secao: { fontFamily: 'Inter_600SemiBold', fontSize: 18, lineHeight: 26, color: colors.primary, marginBottom: space.sm, marginTop: space.xs },
  empty: { textAlign: 'center', marginVertical: space.xl, color: colors.muted },
  fab: { position: 'absolute', right: space.lg, backgroundColor: colors.primary, paddingHorizontal: space.xl, paddingVertical: 14, borderRadius: radius.pill, ...shadow, shadowOpacity: 0.25 },
  fabText: { color: '#fff', fontFamily: 'Inter_700Bold', fontSize: 15 },
});
