import React, { useMemo } from 'react';
import { Pressable, StyleSheet, Text, View, type TextInputProps } from 'react-native';
import { Input } from '@/components/Input';
import { colors, radius, spacing } from '@/constants/theme';

export function SuggestInput({
  suggestions = [],
  ...props
}: TextInputProps & {
  label?: string;
  hint?: string;
  error?: string | null;
  suggestions?: string[];
}) {
  const value = typeof props.value === 'string' ? props.value : '';
  const shown = useMemo(() => {
    const query = value.trim().toLowerCase();
    const next = query
      ? suggestions.filter((item) => item.toLowerCase().includes(query) && item.toLowerCase() !== query)
      : suggestions;
    return next.slice(0, 6);
  }, [suggestions, value]);

  return (
    <View>
      <Input {...props} />
      {shown.length ? (
        <View style={styles.chips}>
          {shown.map((item) => (
            <Pressable
              key={item}
              onPress={() => props.onChangeText?.(item)}
              accessibilityRole="button"
              accessibilityLabel={`Use ${item}`}
              style={styles.chip}
            >
              <Text style={styles.chipText}>{item}</Text>
            </Pressable>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  chips: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm, marginTop: -spacing.md, marginBottom: spacing.lg },
  chip: { minHeight: 36, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surfaceAlt, justifyContent: 'center', paddingHorizontal: spacing.md },
  chipText: { color: colors.brandDark, fontWeight: '800', fontSize: 13 }
});
