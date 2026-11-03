import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { funcionariosApi } from '../services/api';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadow, space } from '../theme.js';

const vazio = { id: null, nome: '', email: '', matricula: '', funcao: 'Enfermeiro', setorIds: [] };

export default function FuncionariosScreen() {
  const { profissional } = useAuth();
  const podeGerenciar = /coordena/i.test(profissional?.funcao ?? '');
  const [funcionarios, setFuncionarios] = useState([]);
  const [setores, setSetores] = useState([]);
  const [form, setForm] = useState(vazio);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [editando, setEditando] = useState(false);

  const carregar = useCallback(async () => {
    if (!podeGerenciar) { setCarregando(false); return; }
    setCarregando(true);
    try {
      const result = await funcionariosApi.list();
      setFuncionarios(result.funcionarios ?? []);
      setSetores(result.setores ?? []);
    } catch (e) { Alert.alert('Erro ao carregar funcionários', e.message); }
    finally { setCarregando(false); }
  }, [podeGerenciar]);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const abrir = (funcionario = null) => {
    setForm(funcionario ? {
      id: funcionario.id,
      nome: funcionario.nome ?? '',
      email: funcionario.email ?? '',
      matricula: funcionario.matricula ?? '',
      funcao: funcionario.funcao ?? '',
      setorIds: (funcionario.setores ?? []).map((setor) => setor.id),
    } : vazio);
    setEditando(true);
  };
  const salvar = async () => {
    if (!form.nome.trim() || !form.matricula.trim() || !form.funcao.trim() || !form.setorIds.length || (!form.id && !form.email.trim())) {
      Alert.alert('Dados incompletos', 'Preencha os campos obrigatórios e selecione pelo menos um setor.');
      return;
    }
    setSalvando(true);
    try {
      const payload = { ...form, setorIds: form.setorIds };
      if (form.id) await funcionariosApi.update(payload);
      else await funcionariosApi.create(payload);
      setEditando(false);
      await carregar();
      Alert.alert('Concluído', form.id ? 'Cadastro atualizado.' : 'Convite de acesso enviado por email.');
    } catch (e) { Alert.alert('Erro ao salvar funcionário', e.message); }
    finally { setSalvando(false); }
  };
  const desativar = (funcionario) => Alert.alert('Desativar funcionário', `Desativar o acesso de ${funcionario.nome}? O histórico será preservado.`, [
    { text: 'Cancelar', style: 'cancel' },
    { text: 'Desativar', style: 'destructive', onPress: async () => {
      try { await funcionariosApi.desativar(funcionario.id); await carregar(); }
      catch (e) { Alert.alert('Erro ao desativar', e.message); }
    } },
  ]);
  const toggleSetor = (id) => setForm((prev) => ({
    ...prev,
    setorIds: prev.setorIds.includes(id) ? prev.setorIds.filter((x) => x !== id) : [...prev.setorIds, id],
  }));

  if (!podeGerenciar) return (
    <View style={[s.container, { justifyContent: 'center', alignItems: 'center', padding: space.xl }]}>
      <Text style={s.empty}>O cadastro de funcionários está disponível apenas para a coordenação.</Text>
    </View>
  );

  if (editando) return (
    <ScrollView contentInsetAdjustmentBehavior="automatic" style={s.container} contentContainerStyle={s.form} keyboardShouldPersistTaps="handled">
      <Text style={s.title}>{form.id ? 'Editar funcionário' : 'Novo funcionário'}</Text>
      <Text style={s.label}>Nome</Text>
      <TextInput style={s.input} value={form.nome} onChangeText={(nome) => setForm((p) => ({ ...p, nome }))} />
      <Text style={s.label}>Email de acesso</Text>
      <TextInput style={s.input} value={form.email} onChangeText={(email) => setForm((p) => ({ ...p, email }))} editable={!form.id} keyboardType="email-address" autoCapitalize="none" />
      {form.id && <Text style={s.helper}>O email de acesso é gerenciado pelo Supabase Auth e não é alterado nesta tela.</Text>}
      <Text style={s.label}>Matrícula</Text>
      <TextInput style={s.input} value={form.matricula} onChangeText={(matricula) => setForm((p) => ({ ...p, matricula }))} />
      <Text style={s.label}>Função</Text>
      <TextInput style={s.input} value={form.funcao} onChangeText={(funcao) => setForm((p) => ({ ...p, funcao }))} placeholder="Enfermeiro, supervisor, coordenação…" />
      <Text style={s.label}>Setores</Text>
      <View style={s.sectors}>
        {setores.map((setor) => {
          const selected = form.setorIds.includes(setor.id);
          return <TouchableOpacity key={setor.id} style={[s.sectorChip, selected && s.sectorSelected]} onPress={() => toggleSetor(setor.id)}>
            <Text style={[s.sectorText, selected && s.sectorTextSelected]}>{setor.nome}</Text>
          </TouchableOpacity>;
        })}
      </View>
      <TouchableOpacity style={s.primaryButton} disabled={salvando} onPress={salvar}>
        {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Salvar</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={s.cancelButton} onPress={() => setEditando(false)}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
    </ScrollView>
  );

  return (
    <View style={s.container}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={funcionarios}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={s.list}
        refreshing={carregando}
        onRefresh={carregar}
        ListEmptyComponent={!carregando && <Text style={s.empty}>Nenhum funcionário cadastrado.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.nome}</Text>
              <Text style={s.info}>{item.funcao} · Matrícula {item.matricula || '—'}</Text>
              <Text style={s.info}>{item.setores?.map((setor) => setor.nome).join(', ') || 'Sem setor'}</Text>
              {!item.ativo && <Text style={s.disabled}>Desativado</Text>}
            </View>
            {item.ativo && <>
              <TouchableOpacity onPress={() => abrir(item)}><Text style={s.edit}>Editar</Text></TouchableOpacity>
              <TouchableOpacity onPress={() => desativar(item)}><Text style={s.danger}>Desativar</Text></TouchableOpacity>
            </>}
          </View>
        )}
      />
      <TouchableOpacity style={s.primaryButton} onPress={() => abrir()}><Text style={s.primaryText}>+ Cadastrar funcionário</Text></TouchableOpacity>
    </View>
  );
}

const s = StyleSheet.create({
  container: { flex: 1, backgroundColor: colors.bg },
  list: { padding: space.lg, paddingBottom: space.xl },
  form: { padding: space.lg, gap: space.sm },
  title: { color: colors.text, fontSize: 22, fontWeight: '800', marginBottom: space.sm },
  label: { color: colors.muted, fontSize: 12, fontWeight: '700', textTransform: 'uppercase', marginTop: space.sm },
  input: { borderWidth: 1, borderColor: colors.border, backgroundColor: colors.surface, borderRadius: radius.sm, padding: space.md, color: colors.text, fontSize: 16 },
  helper: { color: colors.muted, fontSize: 12 },
  sectors: { flexDirection: 'row', flexWrap: 'wrap', gap: space.sm, marginVertical: space.sm },
  sectorChip: { borderWidth: 1, borderColor: colors.border, borderRadius: radius.pill, paddingVertical: 8, paddingHorizontal: space.md },
  sectorSelected: { backgroundColor: colors.primary, borderColor: colors.primary },
  sectorText: { color: colors.text, fontSize: 13, fontWeight: '600' },
  sectorTextSelected: { color: '#fff' },
  primaryButton: { backgroundColor: colors.primary, borderRadius: radius.md, padding: space.lg, alignItems: 'center', margin: space.lg },
  primaryText: { color: '#fff', fontWeight: '800' },
  cancelButton: { alignItems: 'center', padding: space.md },
  cancelText: { color: colors.primary, fontWeight: '700' },
  card: { flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.lg, marginBottom: space.md, ...shadow },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  info: { color: colors.muted, fontSize: 12, marginTop: 4 },
  disabled: { color: colors.danger, fontSize: 12, fontWeight: '700', marginTop: 4 },
  edit: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  danger: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: space.xl },
});
