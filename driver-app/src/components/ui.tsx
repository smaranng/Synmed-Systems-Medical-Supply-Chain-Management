import React from 'react';
import {
  View, Text, TouchableOpacity, ActivityIndicator,
  StyleSheet, ViewStyle, TextStyle,
} from 'react-native';

// ─── Colors ───────────────────────────────────────────────────────────────────

export const Colors = {
  primary:   '#EA580C',
  primaryDk: '#C2410C',
  bg:        '#FFF7ED',
  bgCard:    '#FFFFFF',
  border:    '#FED7AA',
  text:      '#111827',
  textMuted: '#6B7280',
  textLight: '#9CA3AF',
  success:   '#16A34A',
  warning:   '#D97706',
  error:     '#DC2626',
  blue:      '#2563EB',
};

export const StatusColors: Record<string, { bg: string; text: string }> = {
  'DISPATCHED': { bg: '#DBEAFE', text: '#1D4ED8' },
  'PICKED_UP':  { bg: '#FF69B4', text: '#FFFFFF' },
  'DELIVERED':  { bg: '#DCFCE7', text: '#15803D' },
  'FAILED':     { bg: '#FEE2E2', text: '#B91C1C' },
  'CANCELLED':  { bg: '#F3F4F6', text: '#374151' },
};

// ─── Button ───────────────────────────────────────────────────────────────────

interface ButtonProps {
  label: string;
  onPress: () => void;
  loading?: boolean;
  disabled?: boolean;
  variant?: 'primary' | 'outline' | 'ghost' | 'danger';
  size?: 'sm' | 'md' | 'lg';
  style?: ViewStyle;
}

export function Button({
  label, onPress, loading, disabled, variant = 'primary', size = 'md', style,
}: ButtonProps) {
  const h = size === 'sm' ? 36 : size === 'lg' ? 54 : 46;
  const isDisabled = disabled || loading;

  const bg = variant === 'primary' ? Colors.primary
    : variant === 'danger'  ? Colors.error
    : 'transparent';

  const borderColor = variant === 'outline' ? Colors.primary : 'transparent';
  const textCol     = variant === 'primary' || variant === 'danger' ? '#fff'
    : variant === 'outline' ? Colors.primary
    : Colors.textMuted;

  return (
    <TouchableOpacity
      onPress={onPress}
      disabled={isDisabled}
      activeOpacity={0.8}
      style={[
        styles.btn,
        { height: h, backgroundColor: bg, borderColor, borderWidth: variant === 'outline' ? 1.5 : 0,
          opacity: isDisabled ? 0.6 : 1 },
        style,
      ]}
    >
      {loading
        ? <ActivityIndicator color={variant === 'primary' ? '#fff' : Colors.primary} />
        : <Text style={[styles.btnText, { color: textCol, fontSize: size === 'sm' ? 13 : 15 }]}>
            {label}
          </Text>
      }
    </TouchableOpacity>
  );
}

// ─── Card ─────────────────────────────────────────────────────────────────────

export function Card({ children, style }: { children: React.ReactNode; style?: ViewStyle }) {
  return (
    <View style={[styles.card, style]}>
      {children}
    </View>
  );
}

// ─── Status Badge ─────────────────────────────────────────────────────────────

export function StatusBadge({ status }: { status: string }) {
  const c = StatusColors[status] ?? { bg: '#F3F4F6', text: '#374151' };
  return (
    <View style={[styles.badge, { backgroundColor: c.bg }]}>
      <Text style={[styles.badgeText, { color: c.text }]}>{status}</Text>
    </View>
  );
}

// ─── Section Header ───────────────────────────────────────────────────────────

export function SectionHeader({ label }: { label: string }) {
  return (
    <View style={styles.sectionHeaderRow}>
      <View style={styles.sectionLine} />
      <Text style={styles.sectionLabel}>{label}</Text>
      <View style={styles.sectionLine} />
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const styles = StyleSheet.create({
  btn: {
    borderRadius: 12,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 20,
  },
  btnText: {
    fontWeight: '600',
    letterSpacing: 0.3,
  },
  card: {
    backgroundColor: Colors.bgCard,
    borderRadius: 16,
    padding: 16,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 1 },
    shadowOpacity: 0.07,
    shadowRadius: 4,
    elevation: 2,
  },
  badge: {
    paddingHorizontal: 10,
    paddingVertical: 3,
    borderRadius: 100,
    alignSelf: 'flex-start',
  },
  badgeText: {
    fontSize: 12,
    fontWeight: '600',
  },
  sectionHeaderRow: {
    flexDirection: 'row',
    alignItems: 'center',
    marginVertical: 8,
  },
  sectionLine: {
    flex: 1,
    height: 1,
    backgroundColor: '#FED7AA',
  },
  sectionLabel: {
    fontSize: 11,
    fontWeight: '700',
    color: Colors.primary,
    textTransform: 'uppercase',
    letterSpacing: 1,
    marginHorizontal: 10,
  },
});
