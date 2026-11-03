import React from 'react';
import { View, Text, Pressable, TouchableOpacity, StyleSheet } from 'react-native';
import EstadoBadge from './EstadoBadge';
import { colors, space, radius, shadow, estadoVisual, formatData } from '../theme.js';
import { STATUS_PENDENCIA } from '../services/api';

// destaque: último registro (borda colorida). onToggle: se vier, o card é retrátil.
export default function PassagemCard({
  item, destaque, expandido, onToggle, onTogglePendencia, onEdit, onDelete,
}) {
  const v = estadoVisual(item.estado_geral);
  const pend = item.pendencias ?? [];
  const abertas = pend.filter((p) => p.status !== STATUS_PENDENCIA.CONCLUIDA).length;
  const colapsavel = !!onToggle;
  const aberto = !colapsavel || expandido;

  const header = (
    <View style={s.header}>
      <View style={{ flex: 1, gap: space.xs }}>
        <View style={s.headerTop}>
          <EstadoBadge estado={item.estado_geral} small />
          <Text style={s.meta}>{formatData(item.data_hora)}</Text>
        </View>
        {!!item.profissionais?.nome && <Text style={s.autor}>{item.profissionais.nome}</Text>}
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
      {colapsavel && <Text style={s.chevron}>{aberto ? '▾' : '▸'}</Text>}
    </View>
  );

  return (
    <View
      style={[
        s.card,
        destaque ? { borderColor: v.cor, borderWidth: 2 } : { borderLeftColor: v.cor, borderLeftWidth: 4 },
      ]}
    >
      {colapsavel ? <Pressable onPress={onToggle}>{header}</Pressable> : header}

      {aberto && (
        <View style={s.body}>
          {!!item.observacao && <Text style={s.obs}>{item.observacao}</Text>}

          {pend.length > 0 && (
            <View style={s.pendBox}>
              <Text style={s.pendTitulo}>Pendências ({abertas} em aberto)</Text>
              {pend.map((p) => {
                const ok = p.status === STATUS_PENDENCIA.CONCLUIDA;
                return (
                  <TouchableOpacity key={p.id} style={s.pendRow} onPress={() => onTogglePendencia?.(item.id, p)}>
                    <Text style={[s.check, ok && { color: colors.success }]}>{ok ? '☑' : '☐'}</Text>
                    <Text style={[s.pendTxt, ok && s.pendOk]}>{p.descricao}</Text>
                  </TouchableOpacity>
                );
              })}
            </View>
          )}
          {(onEdit || onDelete) && <View style={s.actions}>
            {onEdit && <TouchableOpacity onPress={() => onEdit(item)}><Text style={s.action}>Editar passagem</Text></TouchableOpacity>}
            {onDelete && <TouchableOpacity onPress={() => onDelete(item)}><Text style={s.deleteAction}>Excluir passagem</Text></TouchableOpacity>}
          </View>}
        </View>
      )}
    </View>
  );
}

const s = StyleSheet.create({
  card: { backgroundColor: colors.surface, borderRadius: radius.md, padding: space.lg, marginBottom: space.md, borderWidth: 1, borderColor: colors.border, ...shadow },
  header: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm },
  headerTop: { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between' },
  meta: { color: colors.muted, fontSize: 12 },
  autor: { color: colors.muted, fontSize: 13 },
  resumo: { color: colors.text, fontSize: 14 },
  pendResumo: { color: '#B45309', fontSize: 12, fontWeight: '600' },
  chevron: { color: colors.muted, fontSize: 18, marginTop: 2 },
  body: { marginTop: space.md, gap: space.md },
  obs: { color: colors.text, fontSize: 15, lineHeight: 22 },
  pendBox: { backgroundColor: colors.bg, borderRadius: radius.sm, padding: space.md, gap: space.xs },
  pendTitulo: { fontSize: 12, fontWeight: '700', color: colors.muted, textTransform: 'uppercase', marginBottom: 2 },
  pendRow: { flexDirection: 'row', alignItems: 'flex-start', gap: space.sm, paddingVertical: 3 },
  check: { fontSize: 18, color: '#B45309' },
  pendTxt: { flex: 1, fontSize: 14, color: colors.text, paddingTop: 2 },
  pendOk: { color: colors.muted, textDecorationLine: 'line-through' },
  actions: { flexDirection: 'row', justifyContent: 'flex-end', gap: space.lg, borderTopWidth: 1, borderTopColor: colors.border, paddingTop: space.md },
  action: { color: colors.primary, fontSize: 12, fontWeight: '700' },
  deleteAction: { color: colors.danger, fontSize: 12, fontWeight: '700' },
});
