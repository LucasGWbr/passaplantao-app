import React, { useCallback, useMemo, useState } from 'react';
import { View, Text, TextInput, FlatList, TouchableOpacity, Pressable, Alert, StyleSheet, RefreshControl } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { pacientesApi } from '../services/api';
import EstadoBadge from '../components/EstadoBadge';
import { colors, space, radius, shadow, estadoVisual, formatData } from '../theme.js';

export default function PacientesScreen({ route, navigation }) {
  const { setor } = route.params; // { id, nome }
  const insets = useSafeAreaInsets();
  const [pacientes, setPacientes] = useState([]);
  const [loading, setLoading] = useState(false);
  const [filtro, setFiltro] = useState('ativos');
  const [busca, setBusca] = useState('');
  const [somentePendentes, setSomentePendentes] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      setPacientes(await pacientesApi.listBySetor(setor.id, filtro));
    } catch (e) {
      Alert.alert('Erro', e.message);
    } finally {
      setLoading(false);
    }
  }, [setor.id, filtro]);

  useFocusEffect(useCallback(() => { load(); }, [load]));

  const resumo = useMemo(() => {
    const m = new Map();
    pacientes.forEach((p) => {
      const v = estadoVisual(p.ultima?.estado_geral);
      const cur = m.get(v.cor) ?? { ...v, n: 0 };
      cur.n += 1;
      m.set(v.cor, cur);
    });
    return [...m.values()];
  }, [pacientes]);

  const encerrarAtendimento = (p, motivo) =>
    Alert.alert(motivo === 'óbito' ? 'Registrar óbito' : 'Dar alta', `Confirmar ${motivo} de ${p.identificacao}? O paciente será removido da lista de ativos.`, [
      { text: 'Cancelar', style: 'cancel' },
      {
        text: 'Confirmar',
        style: 'destructive',
        onPress: async () => {
          try {
            await pacientesApi.desativar(p.id);
            setPacientes((prev) => prev.filter((x) => x.id !== p.id));
          } catch (e) {
            Alert.alert('Erro', e.message);
          }
        },
      },
    ]);

  const pacientesVisiveis = useMemo(() => {
    const termo = busca.trim().toLocaleLowerCase('pt-BR');
    if (!termo) return pacientes;
    return pacientes.filter((p) => `${p.identificacao} ${p.leito ?? ''}`.toLocaleLowerCase('pt-BR').includes(termo));
  }, [pacientes, busca]);

  const listaFinal = useMemo(() => somentePendentes
    ? pacientesVisiveis.filter((p) => p.checklistPendente?.total > 0)
    : pacientesVisiveis, [pacientesVisiveis, somentePendentes]);

  const Header = () =>
    pacientes.length ? (
      <View style={s.resumoRow}>
        {resumo.map((r) => (
          <View key={r.cor} style={[s.resumoChip, { backgroundColor: r.fundo }]}>
            <View style={[s.dot, { backgroundColor: r.cor }]} />
            <Text style={[s.resumoTxt, { color: r.cor }]}>{r.n} {r.rotulo}</Text>
          </View>
        ))}
      </View>
    ) : null;

  return (
    <View style={s.container}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={listaFinal}
        keyExtractor={(i) => i.id}
        contentContainerStyle={[s.list, { paddingBottom: insets.bottom + 96 }]}
        refreshControl={<RefreshControl refreshing={loading} onRefresh={load} />}
        ListHeaderComponent={(
          <View>
            <TextInput
              style={s.search}
              value={busca}
              onChangeText={setBusca}
              placeholder="Buscar por nome ou leito"
              placeholderTextColor={colors.muted}
              accessibilityLabel="Buscar pacientes por nome ou leito"
            />
            <View style={s.filters}>
              {[['ativos', 'Ativos'], ['desativados', 'Alta/óbito'], ['todos', 'Todos']].map(([value, label]) => (
                <TouchableOpacity key={value} onPress={() => setFiltro(value)} style={[s.filterChip, filtro === value && s.filterChipSelected]}>
                  <Text style={[s.filterText, filtro === value && s.filterTextSelected]}>{label}</Text>
                </TouchableOpacity>
              ))}
              <TouchableOpacity onPress={() => setSomentePendentes((value) => !value)} style={[s.filterChip, somentePendentes && s.filterChipSelected]}>
                <Text style={[s.filterText, somentePendentes && s.filterTextSelected]}>Com checklist pendente</Text>
              </TouchableOpacity>
            </View>
            <Header />
          </View>
        )}
        ListEmptyComponent={!loading && <Text style={s.empty}>{somentePendentes ? 'Nenhum paciente com checklist pendente.' : busca ? 'Nenhum paciente encontrado.' : 'Nenhum paciente neste filtro.'}</Text>}
        renderItem={({ item }) => {
          const v = estadoVisual(item.ultima?.estado_geral);
          return (
            <Pressable
              style={({ pressed }) => [s.card, { borderLeftColor: v.cor }, pressed && { opacity: 0.85 }]}
              onPress={() => navigation.navigate('PacienteDetalhes', { paciente: item })}
            >
              <View style={s.cardTop}>
                <View style={{ flex: 1 }}>
                  <Text style={s.nome} numberOfLines={1}>{item.identificacao}</Text>
                  {!!item.leito && <Text style={s.leito}>Leito {item.leito}</Text>}
                  {!!item.checklistPendente?.total && <Text style={[s.pendingBadge, item.checklistPendente.criticos > 0 && s.criticalPending]}>
                    {item.checklistPendente.total} {item.checklistPendente.total === 1 ? 'item pendente' : 'itens pendentes'}
                    {item.checklistPendente.criticos > 0 ? ` · ${item.checklistPendente.criticos} crítico${item.checklistPendente.criticos === 1 ? '' : 's'}` : ''}
                  </Text>}
                </View>
                <EstadoBadge estado={item.ultima?.estado_geral} />
              </View>

              <View style={s.cardBottom}>
                <Text style={s.data}>
                  {item.ultima ? `Última passagem: ${formatData(item.ultima.data_hora)}` : 'Nenhuma passagem registrada'}
                </Text>
                <View style={s.actions}>
                  <TouchableOpacity hitSlop={8} onPress={() => navigation.navigate('PacienteForm', { setor, paciente: item })}>
                    <Text style={s.edit}>Editar</Text>
                  </TouchableOpacity>
                  {item.ativo !== false && (
                    <TouchableOpacity hitSlop={8} onPress={() => Alert.alert('Encerrar atendimento', 'Escolha como encerrar o atendimento.', [
                      { text: 'Cancelar', style: 'cancel' },
                      { text: 'Dar alta', onPress: () => encerrarAtendimento(item, 'alta') },
                      { text: 'Registrar óbito', style: 'destructive', onPress: () => encerrarAtendimento(item, 'óbito') },
                    ])}>
                      <Text style={s.discharge}>Alta/óbito</Text>
                    </TouchableOpacity>
                  )}
                </View>
              </View>
            </Pressable>
          );
        }}
      />

      {filtro !== 'desativados' && <TouchableOpacity
        style={[s.fab, { bottom: insets.bottom + space.lg }]}
        onPress={() => navigation.navigate('PacienteForm', { setor })}
      >
        <Text style={s.fabText}>+ Paciente</Text>
      </TouchableOpacity>}
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, width: '100%', maxWidth: 720, alignSelf: 'center' },
  resumoRow: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  search: { backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, paddingHorizontal: space.md, paddingVertical: 12, marginBottom: space.md, color: colors.text },
  filters: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginBottom: space.lg },
  filterChip: { borderRadius: radius.pill, borderWidth: 1, borderColor: colors.border, paddingHorizontal: space.md, paddingVertical: 8 },
  filterChipSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  filterText: { color: colors.text, fontWeight: '600', fontSize: 13 },
  filterTextSelected: { color: '#fff' },
  resumoChip: { flexDirection: 'row', alignItems: 'center', gap: 6, paddingHorizontal: space.md, paddingVertical: 6, borderRadius: radius.pill },
  resumoTxt: { fontSize: 12, fontWeight: '700' },
  dot: { width: 8, height: 8, borderRadius: 4 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, marginBottom: space.md, borderLeftWidth: 6, borderWidth: 1, borderColor: colors.border, gap: space.md, ...shadow },
  cardTop: { flexDirection: 'row', alignItems: 'center', gap: space.md },
  nome: { fontSize: 17, fontWeight: '700', color: colors.text },
  leito: { color: colors.muted, marginTop: 2 },
  pendingBadge: { color: '#B45309', fontWeight: '700', fontSize: 12, marginTop: 5 },
  criticalPending: { color: colors.danger },
  cardBottom: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', gap: space.md },
  data: { flex: 1, color: colors.muted, fontSize: 12 },
  actions: { flexDirection: 'row', gap: space.lg },
  edit: { color: colors.primary, fontWeight: '600', fontSize: 13 },
  del: { color: colors.danger, fontWeight: '600', fontSize: 13 },
  discharge: { color: colors.muted, fontWeight: '600', fontSize: 13 },
  empty: { textAlign: 'center', marginTop: 48, color: colors.muted },
  fab: { position: 'absolute', right: space.lg, backgroundColor: colors.primary, paddingHorizontal: space.xl, paddingVertical: 14, borderRadius: radius.pill, ...shadow, shadowOpacity: 0.25 },
  fabText: { color: '#fff', fontWeight: '700', fontSize: 15 },
});
