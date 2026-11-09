import React, { useCallback, useState } from 'react';
import { View, Text, ScrollView, TouchableOpacity, TextInput, Modal, Alert, ActivityIndicator, StyleSheet } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { useAuth } from '../context/AuthContext';
import { podeAdministrar } from '../utils/permissoes';
import { administracaoApi } from '../services/api';
import { colors, fontes } from '../theme';

const tipos = [['setores', 'Setores'], ['funcoes', 'Funções'], ['quartos', 'Quartos']];
export default function AdministracaoScreen({ navigation }) {
  const { profissional } = useAuth();
  const permitido = podeAdministrar(profissional);
  const [tipo, setTipo] = useState('setores');
  const [registros, setRegistros] = useState([]);
  const [setores, setSetores] = useState([]);
  const [form, setForm] = useState(null);
  const [inativos, setInativos] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const carregar = useCallback(async () => {
    if (!permitido) return;
    setLoading(true);
    try {
      const [lista, listaSetores] = await Promise.all([administracaoApi.list(tipo), administracaoApi.list('setores')]);
      setRegistros(lista); setSetores(listaSetores);
    } catch (e) { Alert.alert('Erro ao carregar', e.message); }
    finally { setLoading(false); }
  }, [permitido, tipo]);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));
  const salvar = async () => {
    if (saving) return;
    setSaving(true);
    try { await administracaoApi.salvar(tipo, form); setForm(null); await carregar(); }
    catch (e) { Alert.alert('Erro ao salvar', e.message); }
    finally { setSaving(false); }
  };
  const alternar = (item) => Alert.alert(item.ativo ? 'Desativar cadastro?' : 'Reativar cadastro?', 'Os registros e vínculos históricos serão preservados.', [
    { text: 'Cancelar', style: 'cancel' },
    { text: item.ativo ? 'Desativar' : 'Reativar', onPress: async () => {
      setSaving(true);
      try { await administracaoApi.setAtivo(tipo, item.id, !item.ativo); await carregar(); }
      catch (e) { Alert.alert('Não foi possível alterar', e.message); }
      finally { setSaving(false); }
    } },
  ]);
  if (!permitido) return <View style={s.page}><Text style={s.text}>Acesso exclusivo de gerente/administrador.</Text></View>;
  return <ScrollView style={s.page} contentContainerStyle={s.content}>
    <Text style={s.title}>Administração</Text>
    <Text style={s.hint}>Gerencie a equipe e a estrutura do hospital.</Text>
    <TouchableOpacity style={s.primary} onPress={() => navigation.navigate('Funcionarios')}><Text style={s.primaryText}>Funcionários e acessos</Text></TouchableOpacity>
    <View style={s.row}>{tipos.map(([valor, label]) => <TouchableOpacity accessibilityRole="tab" accessibilityState={{ selected: tipo === valor }} key={valor} style={[s.tab, tipo === valor && s.selected]} onPress={() => { setRegistros([]); setTipo(valor); }}><Text style={tipo === valor ? s.primaryText : s.text}>{label}</Text></TouchableOpacity>)}</View>
    <TouchableOpacity style={s.tab} onPress={() => setInativos(!inativos)}><Text style={s.link}>{inativos ? 'Mostrar somente ativos' : 'Mostrar também desativados'}</Text></TouchableOpacity>
    <TouchableOpacity style={s.primary} onPress={() => setForm({ nome: '', setor_id: '' })}><Text style={s.primaryText}>+ Adicionar {tipo === 'funcoes' ? 'função' : tipo === 'quartos' ? 'quarto' : 'setor'}</Text></TouchableOpacity>
    {loading && <ActivityIndicator color={colors.primary} />}
    {!loading && !registros.some((r) => inativos || r.ativo) && <Text style={s.hint}>Nenhum cadastro encontrado.</Text>}
    {registros.filter((r) => inativos || r.ativo).map((item) => <View key={item.id} style={s.card}>
      <Text style={s.name}>{item.nome}</Text>
      {tipo === 'quartos' && <Text style={s.hint}>{setores.find((setor) => setor.id === item.setor_id)?.nome ?? 'Setor indisponível'}</Text>}
      {!item.ativo && <Text style={s.hint}>Desativado · histórico preservado</Text>}
      <View style={s.row}>
        <TouchableOpacity style={s.tab} disabled={saving} onPress={() => setForm(item)}><Text style={s.link}>Editar</Text></TouchableOpacity>
        <TouchableOpacity style={s.tab} disabled={saving} onPress={() => alternar(item)}><Text style={s.link}>{item.ativo ? 'Desativar' : 'Reativar'}</Text></TouchableOpacity>
        {tipo === 'setores' && item.ativo && <TouchableOpacity style={s.tab} onPress={() => navigation.navigate('Leitos', { setor: item })}><Text style={s.link}>Leitos</Text></TouchableOpacity>}
      </View>
    </View>)}
    <Modal visible={!!form} transparent animationType="slide" onRequestClose={() => { if (!saving) setForm(null); }}>
      <View style={s.backdrop}><ScrollView contentContainerStyle={s.dialogScroll} keyboardShouldPersistTaps="handled"><View style={s.dialog}>
        <Text style={s.name}>{form?.id ? 'Editar cadastro' : 'Novo cadastro'}</Text>
        <Text style={s.text}>Nome</Text>
        <TextInput style={s.input} value={form?.nome ?? ''} onChangeText={(nome) => setForm((f) => ({ ...f, nome }))} />
        {tipo === 'quartos' && <><Text style={s.text}>Setor</Text><View style={s.row}>{setores.filter((setor) => setor.ativo || setor.id === form?.setor_id).map((setor) => <TouchableOpacity key={setor.id} style={[s.tab, form?.setor_id === setor.id && s.selected]} onPress={() => setForm((f) => ({ ...f, setor_id: setor.id }))}><Text style={form?.setor_id === setor.id ? s.primaryText : s.text}>{setor.nome}</Text></TouchableOpacity>)}</View></>}
        <TouchableOpacity style={s.primary} disabled={saving} onPress={salvar}>{saving ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Salvar</Text>}</TouchableOpacity>
        <TouchableOpacity style={s.tab} disabled={saving} onPress={() => setForm(null)}><Text style={s.link}>Cancelar</Text></TouchableOpacity>
      </View></ScrollView></View>
    </Modal>
  </ScrollView>;
}
const s = StyleSheet.create({
 page: { flex: 1, backgroundColor: colors.bg }, content: { padding: 16, gap: 16, paddingBottom: 48 },
 title: { fontFamily: fontes.bold, fontSize: 24, color: colors.primary }, text: { fontFamily: fontes.regular, fontSize: 15, color: colors.text },
 hint: { fontFamily: fontes.regular, fontSize: 14, lineHeight: 22, color: colors.muted },
 row: { flexDirection: 'row', flexWrap: 'wrap', gap: 8 }, tab: { padding: 12, minHeight: 44, borderRadius: 10, justifyContent: 'center' }, selected: { backgroundColor: colors.primary },
 primary: { backgroundColor: colors.primary, padding: 16, borderRadius: 12, alignItems: 'center', minHeight: 48 }, primaryText: { fontFamily: fontes.semibold, color: '#fff', fontSize: 15 },
 link: { color: colors.primary, fontFamily: fontes.semibold, fontSize: 14 }, name: { fontFamily: fontes.semibold, fontSize: 17, color: colors.text },
 card: { backgroundColor: colors.surface, padding: 16, borderWidth: 1, borderColor: colors.border, borderRadius: 12, gap: 8 },
 backdrop: { flex: 1, backgroundColor: '#0006', justifyContent: 'center' }, dialogScroll: { flexGrow: 1, justifyContent: 'center', padding: 24 }, dialog: { padding: 24, backgroundColor: colors.surface, borderRadius: 16, gap: 16 },
 input: { minHeight: 48, padding: 12, borderWidth: 1, borderColor: colors.border, borderRadius: 10, fontSize: 16, color: colors.text },
});
