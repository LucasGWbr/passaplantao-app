import React, { useCallback, useState } from 'react';
import { ActivityIndicator, Alert, FlatList, ScrollView, StyleSheet, Text, TextInput, TouchableOpacity, View } from 'react-native';
import { useFocusEffect } from '@react-navigation/native';
import { funcionariosApi, administracaoApi } from '../services/api';
import { podeAdministrar } from '../utils/permissoes';
import { useAuth } from '../context/AuthContext';
import { colors, radius, shadow, space } from '../theme.js';

const vazio = { id: null, nome: '', email: '', matricula: '', funcao: '', nivel_acesso: 'assistencial', senha: '', setorIds: [] };

export default function FuncionariosScreen() {
  const { profissional } = useAuth();
  const podeGerenciar = podeAdministrar(profissional);
  const [funcionarios, setFuncionarios] = useState([]);
  const [funcoes, setFuncoes] = useState([]);
  const [mostrarInativos, setMostrarInativos] = useState(false);
  const [setores, setSetores] = useState([]);
  const [form, setForm] = useState(vazio);
  const [carregando, setCarregando] = useState(true);
  const [salvando, setSalvando] = useState(false);
  const [errosCadastro, setErrosCadastro] = useState([]);
  const [editando, setEditando] = useState(false);

  const carregar = useCallback(async () => {
    if (!podeGerenciar) { setCarregando(false); return; }
    setCarregando(true);
    const resultados = await Promise.allSettled([
      funcionariosApi.list(), administracaoApi.list('setores'), administracaoApi.list('funcoes'),
    ]);
    const [lista, setoresResult, funcoesResult] = resultados;
    if (lista.status === 'fulfilled') setFuncionarios(lista.value.funcionarios ?? []);
    const erros = [];
    if (setoresResult.status === 'fulfilled') setSetores(setoresResult.value.filter((s) => s.ativo));
    else { setSetores([]); erros.push(`Setores: ${setoresResult.reason.message}`); }
    if (funcoesResult.status === 'fulfilled') setFuncoes(funcoesResult.value.filter((f) => f.ativo));
    else { setFuncoes([]); erros.push(`Funções: ${funcoesResult.reason.message}`); }
    setErrosCadastro(erros);
    setCarregando(false);
    if (lista.status === 'rejected') Alert.alert('Erro ao carregar funcionários', lista.reason.message);
  }, [podeGerenciar]);
  useFocusEffect(useCallback(() => { carregar(); }, [carregar]));

  const abrir = (funcionario = null) => {
    setForm(funcionario ? {
      id: funcionario.id,
      nome: funcionario.nome ?? '',
      email: funcionario.email ?? '',
      matricula: funcionario.matricula ?? '',
      funcao: funcionario.funcao ?? '',
      nivel_acesso: ['adm', 'administrador'].includes(funcionario.nivel_acesso) ? 'admin' : funcionario.nivel_acesso ?? 'assistencial',
      senha: '',
      setorIds: (funcionario.setores ?? []).map((setor) => setor.id),
    } : vazio);
    setEditando(true);
  };
  const salvar = async () => {
    if (carregando || errosCadastro.length) { Alert.alert('Cadastros indisponíveis', 'Aguarde o carregamento ou tente carregar setores e funções novamente.'); return; }
    const faltantes = [];
    if (!form.nome.trim()) faltantes.push('nome');
    if (!form.funcao.trim()) faltantes.push('função');
    if (!form.setorIds.length) faltantes.push('pelo menos um setor');
    if (!form.id && !form.email.trim()) faltantes.push('email');
    if (faltantes.length) { Alert.alert('Dados incompletos', `Informe: ${faltantes.join(', ')}.`); return; }
    if (!form.id && form.senha.length < 12) { Alert.alert('Senha de acesso', 'Use pelo menos 12 caracteres.'); return; }
    setSalvando(true);
    try {
      const payload = { ...form, setorIds: form.setorIds };
      if (form.id) await funcionariosApi.update(payload);
      else await funcionariosApi.create(payload);
      setEditando(false);
      setForm(vazio);
      await carregar();
      Alert.alert('Concluído', form.id ? 'Cadastro atualizado.' : 'Funcionário e acesso de login criados. Informe a senha cadastrada ao funcionário por um canal seguro.');
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
      <Text style={s.empty}>O cadastro de funcionários está disponível apenas para gerente/administrador.</Text>
    </View>
  );

  if (editando) return (
    <ScrollView
      contentInsetAdjustmentBehavior="automatic"
      automaticallyAdjustKeyboardInsets
      keyboardDismissMode="on-drag"
      keyboardShouldPersistTaps="handled"
      style={s.container}
      contentContainerStyle={s.form}
    >
      <Text style={s.title}>{form.id ? 'Editar funcionário' : 'Novo funcionário'}</Text>
      <Text style={s.label}>Nome</Text>
      <TextInput style={s.input} value={form.nome} onChangeText={(nome) => setForm((p) => ({ ...p, nome }))} />
      <Text style={s.label}>Email de acesso</Text>
      <TextInput style={s.input} value={form.email} onChangeText={(email) => setForm((p) => ({ ...p, email }))} editable={!form.id} keyboardType="email-address" autoCapitalize="none" />
      {form.id && <Text style={s.helper}>O email de acesso é gerenciado pelo Supabase Auth e não é alterado nesta tela.</Text>}
      <Text style={s.label}>Matrícula (opcional)</Text>
      <TextInput style={s.input} value={form.matricula} onChangeText={(matricula) => setForm((p) => ({ ...p, matricula }))} />
      <Text style={s.label}>Função</Text>
      <View style={s.sectors}>{funcoes.map((funcao) => <TouchableOpacity key={funcao.id} style={[s.sectorChip, form.funcao === funcao.nome && s.sectorSelected]} onPress={() => setForm((p) => ({ ...p, funcao: funcao.nome }))}><Text style={[s.sectorText, form.funcao === funcao.nome && s.sectorTextSelected]}>{funcao.nome}</Text></TouchableOpacity>)}</View>
      {!funcoes.length && <Text style={s.helper}>Cadastre uma função no painel de administração.</Text>}
      <Text style={s.label}>Nível de acesso</Text>
      <View style={s.sectors}>{[['assistencial', 'Assistencial'], ['gerente', 'Gerente'], ['admin', 'Administrador']].map(([valor, label]) => <TouchableOpacity key={valor} style={[s.sectorChip, form.nivel_acesso === valor && s.sectorSelected]} onPress={() => setForm((p) => ({ ...p, nivel_acesso: valor }))}><Text style={[s.sectorText, form.nivel_acesso === valor && s.sectorTextSelected]}>{label}</Text></TouchableOpacity>)}</View>
      <Text style={s.helper}>Gerentes e administradores podem gerenciar funcionários, funções, quartos, setores e leitos.</Text>
      {!form.id && <><Text style={s.label}>Senha de acesso (mínimo 12 caracteres)</Text><TextInput style={s.input} secureTextEntry autoCapitalize="none" autoCorrect={false} value={form.senha} onChangeText={(senha) => setForm((p) => ({ ...p, senha }))} /></>}
      <Text style={s.label}>Setores</Text>
      {carregando && <ActivityIndicator color={colors.primary} />}
      {errosCadastro.length > 0 && <><Text style={s.danger}>{errosCadastro.join('\n')}</Text><TouchableOpacity style={s.cancelButton} onPress={carregar}><Text style={s.cancelText}>Tentar carregar novamente</Text></TouchableOpacity></>}
      {!carregando && !errosCadastro.length && !setores.length && <Text style={s.helper}>Nenhum setor ativo. Cadastre ou reative um setor no painel de administração antes de cadastrar o funcionário.</Text>}
      <View style={s.sectors}>
        {setores.map((setor) => {
          const selected = form.setorIds.includes(setor.id);
          return <TouchableOpacity key={setor.id} style={[s.sectorChip, selected && s.sectorSelected]} onPress={() => toggleSetor(setor.id)}>
            <Text style={[s.sectorText, selected && s.sectorTextSelected]}>{setor.nome}</Text>
          </TouchableOpacity>;
        })}
      </View>
      <TouchableOpacity style={[s.primaryButton, (carregando || errosCadastro.length > 0 || !setores.length || !funcoes.length) && { opacity: 0.5 }]} disabled={salvando || carregando || errosCadastro.length > 0 || !setores.length || !funcoes.length} onPress={salvar}>
        {salvando ? <ActivityIndicator color="#fff" /> : <Text style={s.primaryText}>Salvar</Text>}
      </TouchableOpacity>
      <TouchableOpacity style={s.cancelButton} onPress={() => setEditando(false)}><Text style={s.cancelText}>Cancelar</Text></TouchableOpacity>
    </ScrollView>
  );

  return (
    <View style={s.container}>
      <FlatList
        contentInsetAdjustmentBehavior="automatic"
        data={funcionarios.filter((item) => mostrarInativos || item.ativo)}
        ListHeaderComponent={<TouchableOpacity style={s.cancelButton} onPress={() => setMostrarInativos(!mostrarInativos)}><Text style={s.cancelText}>{mostrarInativos ? 'Mostrar somente ativos' : 'Mostrar também desativados'}</Text></TouchableOpacity>}
        keyExtractor={(item) => String(item.id)}
        contentContainerStyle={s.list}
        refreshing={carregando}
        onRefresh={carregar}
        ListEmptyComponent={!carregando && <Text style={s.empty}>Nenhum funcionário cadastrado.</Text>}
        renderItem={({ item }) => (
          <View style={s.card}>
            <View style={{ flex: 1 }}>
              <Text style={s.name}>{item.nome}</Text>
              <Text style={s.info}>{item.nivel_acesso}</Text>
              <Text style={s.info}>{item.funcao} · Matrícula {item.matricula || '—'}</Text>
              <Text style={s.info}>{item.setores?.map((setor) => setor.nome).join(', ') || 'Sem setor'}</Text>
              {!item.ativo && <Text style={s.disabled}>Desativado</Text>}
            </View>
            {!item.ativo && <TouchableOpacity onPress={async () => { try { await funcionariosApi.reativar(item.id); await carregar(); } catch (e) { Alert.alert('Erro', e.message); } }}><Text style={s.edit}>Reativar</Text></TouchableOpacity>}
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
  form: { padding: space.lg, paddingBottom: space.xl * 2, gap: space.sm },
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
  card: { flexWrap: 'wrap', flexDirection: 'row', alignItems: 'center', gap: space.md, backgroundColor: colors.surface, borderWidth: 1, borderColor: colors.border, borderRadius: radius.md, padding: space.lg, marginBottom: space.md, ...shadow },
  name: { color: colors.text, fontSize: 16, fontWeight: '800' },
  info: { color: colors.muted, fontSize: 12, marginTop: 4 },
  disabled: { color: colors.danger, fontSize: 12, fontWeight: '700', marginTop: 4 },
  edit: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  danger: { color: colors.danger, fontSize: 12, fontWeight: '700' },
  empty: { color: colors.muted, textAlign: 'center', marginTop: space.xl },
});
