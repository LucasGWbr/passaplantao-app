import React, { useCallback, useState } from 'react';
import { Alert, FlatList, Modal, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { podeAdministrar } from '../utils/permissoes';
import { leitosApi, administracaoApi } from '../services/api';
import { colors, radius, shadow, space } from '../theme.js';

export default function LeitosScreen({ route }) {
  const { setor } = route.params;
  const { profissional } = useAuth();
  const permitido = podeAdministrar(profissional);
  const [quartos, setQuartos] = useState([]);
  const [quartoId, setQuartoId] = useState(null);
  const [leitos, setLeitos] = useState([]);
  const [editando, setEditando] = useState(null);
  const [identificacao, setIdentificacao] = useState('');
  const [modal, setModal] = useState(false);
  const carregar = useCallback(async () => {
    if (!permitido) return;
    try { setQuartos((await administracaoApi.list('quartos')).filter((q) => q.setor_id === setor.id)); setLeitos(await leitosApi.listBySetor(setor.id, { somenteAtivos: false })); }
    catch (e) { Alert.alert('Erro ao carregar leitos', e.message); }
  }, [setor.id, permitido]);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const abrir = (leito = null) => {
    setEditando(leito);
    setIdentificacao(leito?.identificacao ?? '');
    setQuartoId(leito?.quarto_id ?? null);
    setModal(true);
  };
  const salvar = async () => {
    try {
      if (editando) await leitosApi.update(editando.id, { identificacao, quarto_id: quartoId });
      else await leitosApi.create({ setor_id: setor.id, identificacao, quarto_id: quartoId });
      setModal(false);
      await carregar();
    } catch (e) { Alert.alert('Erro ao salvar leito', e.message); }
  };
  const desativar = (leito) => Alert.alert('Desativar leito', `Desativar ${leito.identificacao}? O histórico será mantido.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Desativar', style: 'destructive', onPress: async () => {
      try { await leitosApi.desativar(leito.id); await carregar(); }
      catch (e) { Alert.alert('Erro ao desativar', e.message); }
    } },
  ]);

  if (!permitido) return <View style={s.container}><Text style={s.empty}>Acesso exclusivo de gerente/administrador.</Text></View>;
  return (
    <View style={s.container}>
      <Text style={s.subtitle}>{setor.nome}</Text>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={leitos}
        keyExtractor={(item) => item.id}
        contentContainerStyle={s.list}
        ListEmptyComponent={<Text style={s.empty}>Nenhum leito cadastrado neste setor.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.identificacao}</Text>
              <Text style={s.status}>{quartos.find((q) => q.id === item.quarto_id)?.nome ?? 'Sem quarto vinculado'}</Text>
              <Text style={s.status}>{item.ativo ? 'Ativo' : 'Desativado'}</Text>
            </View>
            {!item.ativo && <TouchableOpacity onPress={async () => { try { await leitosApi.reativar(item.id); await carregar(); } catch (e) { Alert.alert('Erro', e.message); } }}><Text style={s.action}>Reativar</Text></TouchableOpacity>}
            {item.ativo && <>
              <TouchableOpacity onPress={() => abrir(item)}><Text style={s.action}>Editar</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => desativar(item)}><Text style={s.danger}>Desativar</Text></TouchableOpacity>
            </>}
          </View>
        )}
      />
      <TouchableOpacity style={s.button} onPress={() => abrir()}><Text style={s.buttonText}>+ Cadastrar leito</Text></TouchableOpacity>
      <Modal visible={modal} transparent animationType="fade" onRequestClose={() => setModal(false)}>
        <View style={s.backdrop}>
          <View style={s.modal}>
            <Text style={s.title}>{editando ? 'Editar leito' : 'Novo leito'}</Text>
            <TextInput autoFocus style={s.input} value={identificacao} onChangeText={setIdentificacao} placeholder="Identificação (ex.: 12A)" placeholderTextColor={colors.muted} />
            <Text style={s.status}>Quarto (opcional)</Text>
            <ScrollView style={{ maxHeight: 180 }}>
              <TouchableOpacity style={s.cancel} onPress={() => setQuartoId(null)}><Text style={s.action}>{quartoId === null ? 'Selecionado: ' : ''}Sem quarto</Text></TouchableOpacity>
              {quartos.filter((q) => q.ativo || q.id === quartoId).map((q) => <TouchableOpacity key={q.id} style={s.cancel} onPress={() => setQuartoId(q.id)}><Text style={s.action}>{quartoId === q.id ? 'Selecionado: ' : ''}{q.nome}</Text></TouchableOpacity>)}
            </ScrollView>
            <TouchableOpacity style={s.button} onPress={salvar}><Text style={s.buttonText}>Salvar</Text></TouchableOpacity>
            <TouchableOpacity style={s.cancel} onPress={() => setModal(false)}><Text style={s.action}>Cancelar</Text></TouchableOpacity>
          </View>
        </View>
      </Modal>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg, padding: space.lg },
  subtitle: { color: colors.muted, marginBottom: space.md },
  list: { paddingBottom: 100 },
  card: { backgroundColor: colors.surface, borderRadius: radius.md, borderWidth: 1, borderColor: colors.border, padding: space.lg, marginBottom: space.md, flexDirection: 'row', alignItems: 'center', gap: space.lg, ...shadow },
  name: { color: colors.text, fontSize: 16, fontWeight: '700' },
  status: { color: colors.muted, fontSize: 12, marginTop: 3 },
  action: { color: colors.primary, fontWeight: '700' },
  danger: { color: colors.danger, fontWeight: '700' },
  empty: { textAlign: 'center', color: colors.muted, marginTop: space.xl },
  button: { backgroundColor: colors.primary, borderRadius: radius.md, padding: space.lg, alignItems: 'center' },
  buttonText: { color: '#fff', fontWeight: '700' },
  backdrop: { flex: 1, backgroundColor: '#0007', justifyContent: 'center', padding: space.lg },
  modal: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: space.lg, gap: space.md },
  title: { color: colors.text, fontSize: 20, fontWeight: '800' },
  input: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.sm, padding: space.md, color: colors.text },
  cancel: { alignItems: 'center', padding: space.sm },
});
