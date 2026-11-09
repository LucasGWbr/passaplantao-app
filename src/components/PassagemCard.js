import React from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import EstadoBadge from './EstadoBadge';
import { colors, space, radius, shadow, estadoVisual, formatData } from '../theme.js';
import { agruparFicha } from '../utils/fichaLabels';
import { STATUS_PENDENCIA } from '../services/api';

// destaque: último registro (borda colorida). onToggle: se vier, o card é retrátil.
export default function PassagemCard({
  item, destaque, expandido, onToggle, onEdit, onDelete, cuidados = [], profissionalId, onConfirmar,
}) {
  const gruposFicha = agruparFicha(item.ficha ?? {});
  const v = estadoVisual(item.estado_geral);
  const pend = item.pendencias ?? [];
  const abertas = pend.filter((p) => p.status !== STATUS_PENDENCIA.CONCLUIDA).length;
  const cuidadosOrdenados = [...cuidados].sort((a, b) => Number(!!(a.confirmado || a.cancelado_em)) - Number(!!(b.confirmado || b.cancelado_em)) || ({ critico: 0, atencao: 1, rotina: 2 }[a.prioridade] - { critico: 0, atencao: 1, rotina: 2 }[b.prioridade]));
  const aReceber = cuidados.filter((c) => !c.confirmado && !c.cancelado_em).length;
  const colapsavel = !!onToggle;
  const aberto = !colapsavel || expandido;

  const header = (
    <View style={s.header}>
      <View style={{ flex: 1, gap: space.xs }}>
        <View style={s.headerTop}>
          <EstadoBadge estado={item.estado_geral} small />
          <Text style={[s.draftBadge, !item.rascunho && s.finalBadge]}>{item.rascunho ? 'Em preenchimento' : 'Finalizada'}</Text>
          <Text style={s.meta}>{formatData(item.data_hora)}</Text>
        </View>
        {!!item.profissionais?.nome && <Text style={s.autor}>{item.profissionais.nome}</Text>}
        <Text style={aReceber ? s.pendResumo : s.meta}>{aReceber ? `${aReceber} ${aReceber === 1 ? 'cuidado aguardando' : 'cuidados aguardando'} recebimento` : 'Sem cuidados aguardando recebimento'}</Text>
        {!aberto && (
          <>
            {!!item.observacao && <Text numberOfLines={1} style={s.resumo}>{item.observacao}</Text>}
            {abertas > 0 && (
              <Text style={s.pendResumo}>
                {abertas} {abertas === 1 ? 'pendência em aberto' : 'pendências em aberto'}
              </Text>
            )}
          </>
        )}
      </View>
      {colapsavel && <Text style={s.chevron}>{aberto ? 'Ocultar' : 'Ver detalhes'}</Text>}
    </View>
  );

  return (
    <View
      style={[
        s.card,
        { borderTopColor: destaque ? v.cor : colors.border, borderTopWidth: destaque ? 3 : 1 },
      ]}
    >
      {colapsavel ? <Pressable accessibilityRole="button" accessibilityState={{ expanded: aberto }} onPress={onToggle}>{header}</Pressable> : header}

      {aberto && (
        <View style={s.body}>
          <View style={s.fichaBox}><Text style={s.pendTitulo}>Resumo do plantão</Text><Text style={s.obs}>{item.observacao || 'Nenhuma observação adicional registrada.'}</Text></View>
          <View style={s.fichaBox}>
            <Text style={s.pendTitulo}>Cuidados para o próximo plantão</Text>
            <Text style={s.meta}>{item.rascunho ? 'Itens em preparação. Disponíveis para recebimento após finalizar.' : 'Recebimento não significa conclusão da tarefa.'}</Text>
            {cuidadosOrdenados.length === 0 && <Text style={s.obs}>Nenhum cuidado adicional registrado.</Text>}
            {cuidadosOrdenados.map((cuidado) => <View key={cuidado.id} style={[s.cuidado, cuidado.cancelado_em ? s.cuidadoCancelado : cuidado.confirmado ? s.cuidadoRecebido : s.cuidadoPendente]}>
              <Text style={[s.priority, cuidado.prioridade === 'critico' ? s.critical : cuidado.prioridade === 'atencao' ? s.attention : s.routine]}>{({ critico: 'Crítico', atencao: 'Atenção', rotina: 'Rotina' })[cuidado.prioridade]}</Text>
              <View style={s.cuidadoHeading}><Text style={s.cuidadoDescricao}>{cuidado.descricao}</Text></View>
              {cuidado.cancelado_em ? <Text style={s.meta}>Cancelado · mantido no histórico</Text> : cuidado.confirmado ? <View style={s.recebimento}><Text style={s.recebido}>{'\u2713'} Recebido</Text><Text style={s.meta}>Em {formatData(cuidado.confirmacoes?.[0]?.confirmado_em)}{cuidado.confirmacoes?.[0]?.profissionais?.nome ? ` · ${cuidado.confirmacoes[0].profissionais.nome}` : ''}</Text></View> : !item.rascunho && String(cuidado.registrado_por) !== String(profissionalId) ? <TouchableOpacity accessibilityRole="button" style={s.confirmar} onPress={() => onConfirmar?.(cuidado)}><Text style={s.action}>Confirmar recebimento</Text></TouchableOpacity> : <Text style={s.pendente}>Aguardando recebimento</Text>}
            </View>)}
          </View>

          {gruposFicha.length > 0 && <View style={s.avaliacao}>
            <Text style={s.pendTitulo}>Avaliação {item.tipo_ficha === 'obstetrica' ? 'obstétrica' : 'clínica / cirúrgica'}</Text>
            {gruposFicha.map((grupo) => <View key={grupo.titulo} style={s.grupo}>
              <Text style={s.grupoTitulo}>{grupo.titulo}</Text>
              {grupo.campos.map(({ campo, rotulo, valor }) => <View key={campo} style={s.resposta}>
                <Text style={s.rotulo}>{rotulo}</Text>
                <Text style={s.valor}>{valor}</Text>
              </View>)}
            </View>)}
          </View>}

          {pend.length > 0 && (
            <View style={s.pendBox}>
              <Text style={s.pendTitulo}>Pendências de registros anteriores ({abertas} em aberto)</Text>
              {pend.map((p) => {
                const ok = p.status === STATUS_PENDENCIA.CONCLUIDA;
                return (
                  <View key={p.id} style={s.pendRow}>
                    <Text style={[s.check, ok && { color: colors.success }]}>{ok ? '☑' : '☐'}</Text>
                    <Text style={[s.pendTxt, ok && s.pendOk]}>{p.descricao}</Text>
                  </View>
                );
              })}
            </View>
          )}
          {item.rascunho === true && (onEdit || onDelete) && <View style={s.actions}>
            {onEdit && <TouchableOpacity onPress={() => onEdit(item)}><Text style={s.action}>Editar passagem</Text></TouchableOpacity>}
            {onDelete && <TouchableOpacity onPress={() => onDelete(item)}><Text style={s.deleteAction}>Arquivar rascunho</Text></TouchableOpacity>}
          </View>}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.lg, padding: 16, marginBottom: 24, borderWidth: 1, borderColor: colors.border, ...shadow },
  header: { gap: 8 },
  headerTop: { flexWrap: 'wrap', gap: 8, flexDirection: 'row', alignItems: 'center' },
  meta: { color: colors.muted, fontFamily: 'Inter_400Regular', fontSize: 14, lineHeight: 21, flexShrink: 1 },
  autor: { color: colors.text, fontFamily: 'Inter_500Medium', fontSize: 15, lineHeight: 23 },
  resumo: { color: colors.text, fontSize: 16, lineHeight: 24 },
  pendResumo: { color: '#92400E', fontSize: 15, lineHeight: 23, fontFamily: 'Inter_600SemiBold' },
  draftBadge: { color: '#92400E', backgroundColor: '#FEF3C7', paddingHorizontal: 8, paddingVertical: 4, borderRadius: 8, overflow: 'hidden', fontSize: 13, fontFamily: 'Inter_600SemiBold' },
  finalBadge: { color: colors.primary, backgroundColor: '#E8F3FA' },
  chevron: { color: colors.primary, fontFamily: 'Inter_600SemiBold', fontSize: 15, paddingVertical: 12 },
  body: { marginTop: 16, gap: 24 },
  obs: { color: colors.text, fontFamily: 'Inter_400Regular', fontSize: 16, lineHeight: 24 },
  fichaBox: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 16, gap: 12 },
  avaliacao: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 16, gap: 16 },
  grupo: { gap: 4 },
  pendTitulo: { fontSize: 17, lineHeight: 25, fontFamily: 'Inter_600SemiBold', color: colors.primary },
  grupoTitulo: { fontSize: 15, lineHeight: 23, fontFamily: 'Inter_600SemiBold', color: colors.text },
  resposta: { flexDirection: 'row', alignItems: 'flex-start', gap: 16, paddingVertical: 8, borderBottomWidth: StyleSheet.hairlineWidth, borderColor: colors.border },
  rotulo: { flex: 1, fontSize: 14, lineHeight: 21, color: colors.muted, fontFamily: 'Inter_500Medium' },
  valor: { flex: 1.2, color: colors.text, fontSize: 16, lineHeight: 24, fontFamily: 'Inter_600SemiBold' },
  cuidado: { borderLeftWidth: 3, borderRadius: 8, padding: 12, gap: 8 },
  cuidadoPendente: { backgroundColor: '#FFFBEB', borderColor: '#FDE68A', borderLeftColor: '#D97706' },
  cuidadoRecebido: { backgroundColor: '#F0FDF8', borderLeftColor: '#047857' },
  cuidadoCancelado: { backgroundColor: colors.bg, borderColor: colors.border, borderLeftColor: colors.muted },
  cuidadoHeading: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  cuidadoDescricao: { flex: 1, fontFamily: 'Inter_600SemiBold', color: colors.text, fontSize: 16, lineHeight: 24 },
  recebimento: { gap: 4 },
  pendente: { color: '#92400E', fontFamily: 'Inter_500Medium', fontSize: 14, lineHeight: 21 },
  priority: { alignSelf: 'flex-start', borderRadius: 8, paddingHorizontal: 8, paddingVertical: 4, fontFamily: 'Inter_600SemiBold', fontSize: 14 },
  critical: { backgroundColor: '#FEE2E2', color: '#991B1B' },
  attention: { backgroundColor: '#FEF3C7', color: '#92400E' },
  routine: { backgroundColor: '#E8F3FA', color: colors.primary },
  recebido: { color: '#047857', fontFamily: 'Inter_600SemiBold', fontSize: 14, lineHeight: 21 },
  confirmar: { minHeight: 48, padding: 12, justifyContent: 'center', alignItems: 'center', borderWidth: 1, borderColor: colors.primary, borderRadius: 12, backgroundColor: colors.surface },
  pendBox: { borderTopWidth: 1, borderColor: colors.border, paddingTop: 16, gap: 12 },
  pendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: 8 },
  check: { fontSize: 20, color: '#92400E' },
  pendTxt: { flex: 1, fontSize: 16, lineHeight: 24, color: colors.text },
  pendOk: { color: colors.muted, textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', flexWrap: 'wrap', gap: 16, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: 16 },
  action: { color: colors.primary, fontSize: 16, fontFamily: 'Inter_600SemiBold', paddingVertical: 8 },
  deleteAction: { color: colors.danger, fontSize: 16, fontFamily: 'Inter_600SemiBold', paddingVertical: 8 },
});
