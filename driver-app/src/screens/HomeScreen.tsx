import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, ScrollView, StyleSheet, RefreshControl,
  TouchableOpacity, ActivityIndicator,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { fetchDeliveries } from '../api/api';
import { Colors, Card, StatusBadge } from '../components/ui';
import type { Delivery } from '../types';
import type { AppStackParamList } from '../navigation';

type Nav = NativeStackNavigationProp<AppStackParamList>;

export default function HomeScreen() {
  const { driver, logout } = useAuth();
  const navigation = useNavigation<Nav>();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);

  const load = useCallback(async (silent = false) => {
    if (!driver?.driverID) return;
    if (!silent) setLoading(true);
    setError(null);
    try {
      const data = await fetchDeliveries(driver.driverID);
      setDeliveries(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load deliveries');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [driver?.driverID]);

  useEffect(() => { load(); }, [load]);

  const onRefresh = () => { setRefreshing(true); load(true); };

  // Derived stats — status values match the backend enum (uppercase)
  const ACTIVE_STATUSES    = ['DISPATCHED', 'PICKED_UP', 'IN_TRANSIT','DELIVERED'];
  const today = new Date().toDateString();
  const todayDeliveries   = deliveries.filter(d => new Date(d.createdAt).toDateString() === today);
  const active            = deliveries.filter(d => ACTIVE_STATUSES.includes(d.status));
  const completedToday    = todayDeliveries.filter(d => d.status === 'DELIVERED').length;
  const pendingCount      = active.length;

  const greeting = () => {
    const h = new Date().getHours();
    if (h < 12) return 'Good morning';
    if (h < 17) return 'Good afternoon';
    return 'Good evening';
  };

  return (
    <ScrollView
      style={s.scroll}
      contentContainerStyle={s.content}
      refreshControl={<RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />}
    >
      {/* Header */}
      <View style={s.header}>
        <View>
          <Text style={s.greeting}>{greeting()},</Text>
          <Text style={s.name}>{driver?.name ?? '—'}</Text>
        </View>
        <TouchableOpacity
          style={s.logoutBtn}
          onPress={logout}
          activeOpacity={0.7}
        >
          <Ionicons name="log-out-outline" size={20} color="#fff" />
        </TouchableOpacity>
      </View>

      {/* Vehicle pill */}
      {driver?.vehicleNumber && (
        <View style={s.vehiclePill}>
          <Ionicons name="car-outline" size={14} color={Colors.primary} />
          <Text style={s.vehicleText}>
            {driver.vehicleNumber}{driver.vehicleType ? ` · ${driver.vehicleType}` : ''}
          </Text>
        </View>
      )}

      {/* Stat cards */}
      <View style={s.statsRow}>
        <Card style={s.statCard}>
          <Text style={[s.statValue, { color: Colors.primary }]}>{pendingCount}</Text>
          <Text style={s.statLabel}>Active</Text>
        </Card>
        <Card style={s.statCard}>
          <Text style={[s.statValue, { color: Colors.success }]}>{completedToday}</Text>
          <Text style={s.statLabel}>Done Today</Text>
        </Card>
        <Card style={s.statCard}>
          <Text style={[s.statValue, { color: Colors.blue }]}>{deliveries.length}</Text>
          <Text style={s.statLabel}>Total</Text>
        </Card>
      </View>

      {/* Active deliveries */}
      <Text style={s.sectionTitle}>Active Deliveries</Text>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 24 }} />
      ) : error ? (
        <Card style={s.errorCard}>
          <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </Card>
      ) : active.length === 0 ? (
        <Card style={s.emptyCard}>
          <Ionicons name="checkmark-circle-outline" size={40} color={Colors.success} />
          <Text style={s.emptyTitle}>All clear!</Text>
          <Text style={s.emptyText}>No active deliveries right now.</Text>
        </Card>
      ) : (
        active.map(delivery => (
          <TouchableOpacity
            key={delivery.orderNumber}
            activeOpacity={0.85}
            onPress={() => navigation.navigate('DeliveryDetail', { deliveryID: delivery.orderNumber })}
          >
            <Card style={s.deliveryCard}>
              <View style={s.deliveryRow}>
                <View style={s.deliveryLeft}>
                  <Text style={s.orderId}>{delivery.orderNumber}</Text>
                  <Text style={s.customerName} numberOfLines={1}>
                   Pharmacy: {delivery.pharmaName || delivery.orderDetails?.pharmaID}
                  </Text>
                  <View style={s.addressRow}>
                    <Ionicons name="business-outline" size={13} color={Colors.textMuted} />
                    <Text style={s.address} numberOfLines={1}>Distributor: {delivery.companyName}</Text>
                  </View>
                  {delivery.distanceKm != null && (
                    <View style={s.addressRow}>
                      <Ionicons name="navigate-outline" size={13} color={Colors.textMuted} />
                      <Text style={s.address}>{delivery.distanceKm} km away</Text>
                    </View>
                  )}
                </View>
                <View style={s.deliveryRight}>
                  <StatusBadge status={delivery.status} />
                  <Ionicons name="chevron-forward" size={18} color={Colors.textLight} style={{ marginTop: 8 }} />
                </View>
              </View>
            </Card>
          </TouchableOpacity>
        ))
      )}
    </ScrollView>
  );
}

const s = StyleSheet.create({
  scroll:        { flex: 1, backgroundColor: Colors.bg },
  content:       { padding: 20, paddingBottom: 40 },
  header: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 16,
  },
  greeting:      { fontSize: 14, color: Colors.textMuted },
  name:          { fontSize: 22, fontWeight: '700', color: Colors.text },
  logoutBtn: {
    width: 40, height: 40, borderRadius: 20,
    backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center',
  },
  vehiclePill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    alignSelf: 'flex-start',
    backgroundColor: '#FED7AA', borderRadius: 100,
    paddingHorizontal: 12, paddingVertical: 5, marginBottom: 20,
  },
  vehicleText:   { fontSize: 12, fontWeight: '600', color: Colors.primaryDk },
  statsRow:      { flexDirection: 'row', gap: 12, marginBottom: 24 },
  statCard:      { flex: 1, alignItems: 'center', paddingVertical: 16 },
  statValue:     { fontSize: 26, fontWeight: '800' },
  statLabel:     { fontSize: 11, color: Colors.textMuted, marginTop: 2, fontWeight: '500' },
  sectionTitle:  { fontSize: 16, fontWeight: '700', color: Colors.text, marginBottom: 12 },
  deliveryCard:  { marginBottom: 12, padding: 14 },
  deliveryRow:   { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  deliveryLeft:  { flex: 1, marginRight: 12 },
  deliveryRight: { alignItems: 'flex-end' },
  orderId:       { fontSize: 12, color: Colors.primary, fontWeight: '700', marginBottom: 2 },
  customerName:  { fontSize: 15, fontWeight: '600', color: Colors.text, marginBottom: 4 },
  addressRow:    { flexDirection: 'row', alignItems: 'flex-start', gap: 4 },
  address:       { flex: 1, fontSize: 12, color: Colors.textMuted, lineHeight: 17 },
  errorCard: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    borderWidth: 1, borderColor: '#FECACA', backgroundColor: '#FEF2F2',
  },
  errorText:     { flex: 1, fontSize: 13, color: Colors.error },
  retryText:     { fontSize: 13, color: Colors.primary, fontWeight: '600' },
  emptyCard:     { alignItems: 'center', paddingVertical: 32, gap: 8 },
  emptyTitle:    { fontSize: 16, fontWeight: '700', color: Colors.text },
  emptyText:     { fontSize: 13, color: Colors.textMuted },
});