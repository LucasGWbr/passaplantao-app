import React from 'react';
import { View, Text, StyleSheet } from 'react-native';
import { estadoVisual, radius, space } from '../theme.js';

export default function EstadoBadge({ estado, small }) {
  const v = estadoVisual(estado);
  return (
    <View style={[s.badge, { backgroundColor: v.fundo }, small && s.small]}>
      <View style={[s.dot, { backgroundColor: v.cor }]} />
      <Text style={[s.text, { color: v.cor }, small && { fontSize: 12 }]}>{v.rotulo}</Text>
    </View>
  );
}

const s = StyleSheet.create({
  badge: { flexDirection: 'row', alignItems: 'center', alignSelf: 'flex-start', gap: 6, paddingHorizontal: space.md, paddingVertical: 5, borderRadius: radius.pill },
  small: { paddingHorizontal: space.sm, paddingVertical: 3 },
  dot: { width: 8, height: 8, borderRadius: 4 },
  text: { fontSize: 13, fontWeight: '700' },
});
