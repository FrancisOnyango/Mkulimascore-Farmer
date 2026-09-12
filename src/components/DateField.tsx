import React from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { Input } from '@/components/Input';
import { isoFromChoice, todayKey, yesterdayKey, type DayChoice } from '@/lib/forms/dates';
import { colors, radius, spacing } from '@/constants/theme';

export function DateField({
  label = 'When did this happen?',
  choice,
  custom,
  onChoice,
  onCustom
}: {
  label?: string;
  choice: DayChoice;
  custom: string;
  onChoice: (value: DayChoice) => void;
  onCustom: (value: string) => void;
}) {
  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{label}</Text>
      <View style={styles.row}>
        {([
          ['today', 'Today'],
          ['yesterday', 'Yesterday'],
          ['custom', 'Another day']
        ] as const).map(([id, title]) => (
          <Pressable
            key={id}
            onPress={() => {
              onChoice(id);
              if (id === 'custom' && !custom) onCustom(yesterdayKey());
            }}
            accessibilityRole="button"
            accessibilityState={{ selected: choice === id }}
            style={[styles.chip, choice === id && styles.chipOn]}
          >
            <Text style={[styles.chipText, choice === id && styles.chipTextOn]}>{title}</Text>
          </Pressable>
        ))}
      </View>
      {choice === 'custom' ? (
        <Input
          value={custom}
          onChangeText={onCustom}
          placeholder={todayKey()}
          keyboardType="numbers-and-punctuation"
          autoComplete="off"
          hint="Use year-month-day, for example 2026-09-10."
          accessibilityLabel="Custom date"
        />
      ) : null}
    </View>
  );
}

export function occurredAtFromField(choice: DayChoice, custom: string) {
  return isoFromChoice(choice, custom);
}

const styles = StyleSheet.create({
  wrap: { marginBottom: spacing.lg },
  label: { color: colors.ink, fontSize: 15, fontWeight: '800', marginBottom: spacing.sm },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  chip: { minHeight: 40, borderRadius: radius.pill, borderWidth: 1, borderColor: colors.line, backgroundColor: colors.surface, justifyContent: 'center', paddingHorizontal: spacing.md },
  chipOn: { backgroundColor: colors.brandDark, borderColor: colors.brandDark },
  chipText: { color: colors.ink, fontWeight: '800', fontSize: 13 },
  chipTextOn: { color: '#fff' }
});
