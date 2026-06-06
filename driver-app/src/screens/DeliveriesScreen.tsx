import React, { useEffect, useState, useCallback } from 'react';
import {
  View, Text, FlatList, StyleSheet, TouchableOpacity,
  ActivityIndicator, RefreshControl,
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
type Tab = 'Active' | 'Completed' | 'All';

// ← uppercase to match DeliveryStatus
const ACTIVE_STATUSES: string[] = ['DISPATCHED', 'PICKED_UP', 'IN_TRANSIT'];
const DONE_STATUSES: string[]   = ['DELIVERED', 'FAILED', 'CANCELLED'];

export default function DeliveriesScreen() {
  const { driver }   = useAuth();
  const navigation   = useNavigation<Nav>();

  const [deliveries, setDeliveries] = useState<Delivery[]>([]);
  const [loading, setLoading]       = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError]           = useState<string | null>(null);
  const [activeTab, setActiveTab]   = useState<Tab>('Active');

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

  const filtered = deliveries.filter(d => {
    if (activeTab === 'Active')    return ACTIVE_STATUSES.includes(d.status);
    if (activeTab === 'Completed') return DONE_STATUSES.includes(d.status);
    return true;
  });

  const renderItem = ({ item }: { item: Delivery }) => {
    // ← items now live on orderDetails
    const itemCount = item.orderDetails?.items?.length ?? 0;

    return (
      <TouchableOpacity
        activeOpacity={0.85}
        onPress={() => navigation.navigate('DeliveryDetail', { deliveryID: item.orderNumber })}
      >
        <Card style={s.card}>
          {/* Top row */}
          <View style={s.topRow}>
            {/* ← orderID → orderNumber */}
            <Text style={s.orderId}>{item.orderNumber}</Text>
            <StatusBadge status={item.status} />
          </View>

          {/* ← customerName removed; show pharmaID + distributor instead */}
          <Text style={s.customer}>Pharma: {item.pharmaID}</Text>
          <Text style={s.subCustomer}>Distributor: {item.distributorID}</Text>

          {/* Driver & vehicle */}
          <View style={s.infoRow}>
            <Ionicons name="person-outline" size={14} color={Colors.textMuted} />
            <Text style={s.infoText}>{item.driverName}  ·  {item.vehicleNumber}</Text>
          </View>

          {/* Distance */}
          {item.distanceKm != null && (
            <View style={s.infoRow}>
              <Ionicons name="navigate-outline" size={14} color={Colors.textMuted} />
              <Text style={s.infoText}>{item.distanceKm} km</Text>
            </View>
          )}

          {/* Time — ← assignedAt → createdAt */}
          <View style={s.infoRow}>
            <Ionicons name="time-outline" size={14} color={Colors.textMuted} />
            <Text style={s.infoText}>
              Dispatched: {new Date(item.createdAt).toLocaleString('en-IN', {
                day: '2-digit', month: 'short', hour: '2-digit', minute: '2-digit',
              })}
            </Text>
          </View>

          {/* Items count — ← item.items → item.orderDetails?.items */}
          {itemCount > 0 && (
            <View style={s.infoRow}>
              <Ionicons name="cube-outline" size={14} color={Colors.textMuted} />
              <Text style={s.infoText}>{itemCount} item{itemCount > 1 ? 's' : ''}</Text>
            </View>
          )}

          {/* Grand total if available */}
          {item.orderDetails?.grandTotal != null && (
            <View style={s.infoRow}>
              <Ionicons name="cash-outline" size={14} color={Colors.textMuted} />
              <Text style={s.infoText}>
                ₹{item.orderDetails.grandTotal.toLocaleString('en-IN')}
              </Text>
            </View>
          )}

          {/* Tap hint */}
          <View style={s.tapHint}>
            <Text style={s.tapHintText}>View details</Text>
            <Ionicons name="chevron-forward" size={14} color={Colors.primary} />
          </View>
        </Card>
      </TouchableOpacity>
    );
  };

  return (
    <View style={s.container}>
      {/* Tab bar */}
      <View style={s.tabs}>
        {(['Active', 'Completed', 'All'] as Tab[]).map(tab => (
          <TouchableOpacity
            key={tab}
            style={[s.tab, activeTab === tab && s.tabActive]}
            onPress={() => setActiveTab(tab)}
          >
            <Text style={[s.tabText, activeTab === tab && s.tabTextActive]}>{tab}</Text>
          </TouchableOpacity>
        ))}
      </View>

      {loading ? (
        <ActivityIndicator color={Colors.primary} style={{ marginTop: 48 }} />
      ) : error ? (
        <View style={s.center}>
          <Ionicons name="alert-circle-outline" size={32} color={Colors.error} />
          <Text style={s.errorText}>{error}</Text>
          <TouchableOpacity onPress={() => load()}>
            <Text style={s.retryText}>Retry</Text>
          </TouchableOpacity>
        </View>
      ) : (
        <FlatList
          data={filtered}
          keyExtractor={d => d.orderNumber}   // ← deliveryID → orderNumber
          renderItem={renderItem}
          contentContainerStyle={s.list}
          refreshControl={
            <RefreshControl refreshing={refreshing} onRefresh={onRefresh} tintColor={Colors.primary} />
          }
          ListEmptyComponent={
            <View style={s.center}>
              <Ionicons name="file-tray-outline" size={40} color={Colors.textLight} />
              <Text style={s.emptyText}>No {activeTab.toLowerCase()} deliveries</Text>
            </View>
          }
        />
      )}
    </View>
  );
}

const s = StyleSheet.create({
  container:      { flex: 1, backgroundColor: Colors.bg },
  tabs: {
    flexDirection: 'row',
    backgroundColor: '#fff',
    borderBottomWidth: 1,
    borderBottomColor: '#F3F4F6',
    paddingHorizontal: 20,
  },
  tab: {
    paddingVertical: 14,
    paddingHorizontal: 16,
    borderBottomWidth: 2,
    borderBottomColor: 'transparent',
    marginRight: 4,
  },
  tabActive:      { borderBottomColor: Colors.primary },
  tabText:        { fontSize: 14, fontWeight: '500', color: Colors.textMuted },
  tabTextActive:  { color: Colors.primary, fontWeight: '700' },
  list:           { padding: 16, gap: 12, paddingBottom: 40 },
  card:           { gap: 6 },
  topRow:         { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  orderId:        { fontSize: 12, fontWeight: '700', color: Colors.primary },
  customer:       { fontSize: 15, fontWeight: '600', color: Colors.text },
  subCustomer:    { fontSize: 12, color: Colors.textMuted, marginTop: -2 },
  infoRow:        { flexDirection: 'row', alignItems: 'flex-start', gap: 6 },
  infoText:       { flex: 1, fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  tapHint:        { flexDirection: 'row', alignItems: 'center', justifyContent: 'flex-end', gap: 2, marginTop: 4 },
  tapHintText:    { fontSize: 12, color: Colors.primary, fontWeight: '600' },
  center:         { flex: 1, alignItems: 'center', justifyContent: 'center', paddingTop: 80, gap: 10 },
  errorText:      { fontSize: 14, color: Colors.error, textAlign: 'center' },
  retryText:      { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  emptyText:      { fontSize: 14, color: Colors.textMuted },
});