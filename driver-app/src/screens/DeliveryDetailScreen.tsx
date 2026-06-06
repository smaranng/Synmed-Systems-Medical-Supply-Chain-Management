import React, { useEffect, useState, useCallback, useRef } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity,
  ActivityIndicator, Alert, Linking, Modal, TextInput,
  KeyboardAvoidingView, Platform, Animated,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useRoute, useNavigation } from '@react-navigation/native';
import type { NativeStackNavigationProp, NativeStackScreenProps } from '@react-navigation/native-stack';
import { useAuth } from '../context/AuthContext';
import { fetchDeliveryDetail, updateDeliveryStatus } from '../api/api';
import { Colors, Card, StatusBadge, SectionHeader, Button } from '../components/ui';
import type { Delivery, DeliveryStatus, PharmaOrder } from '../types';
import type { AppStackParamList } from '../navigation';
import {
  locationService,
  type LocationHealth,
  type TrackingMode,
} from '../components/Deliverylocationservice';

type Props = NativeStackScreenProps<AppStackParamList, 'DeliveryDetail'>;

// ─── Status machine ───────────────────────────────────────────────────────────

const NEXT_STATUS: Partial<Record<DeliveryStatus, { label: string; next: DeliveryStatus; color: string }>> = {
  DISPATCHED: { label: 'Mark as Picked Up', next: 'PICKED_UP',  color: Colors.warning },
  PICKED_UP:  { label: 'Mark as Delivered',  next: 'DELIVERED', color: Colors.success },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatAddress = (address: any): string => {
  if (!address) return 'N/A';
  if (typeof address === 'string') return address;
  return [address.line1, address.city, address.state, address.pincode]
    .filter(Boolean).join(', ') || 'N/A';
};

const openInMaps = (lat: number, lng: number) => {
  const url = `https://www.google.com/maps/dir/?api=1&destination=${lat},${lng}&travelmode=driving`;
  Linking.openURL(url);
};

// ─── Location status pill ─────────────────────────────────────────────────────

interface LocationStatusPillProps {
  health: LocationHealth | null;
}

function LocationStatusPill({ health }: LocationStatusPillProps) {
  const pulse = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (health?.mode !== 'idle') {
      const anim = Animated.loop(
        Animated.sequence([
          Animated.timing(pulse, { toValue: 0.4, duration: 800, useNativeDriver: true }),
          Animated.timing(pulse, { toValue: 1,   duration: 800, useNativeDriver: true }),
        ]),
      );
      anim.start();
      return () => anim.stop();
    } else {
      pulse.setValue(1);
    }
  }, [health?.mode]);

  if (!health || health.mode === 'idle') return null;

  const modeLabel: Record<TrackingMode, string> = {
    background: 'Live tracking',
    foreground: 'Tracking (app open)',
    idle:       'Tracking off',
  };

  const isOk   = health.isConnected && health.consecutiveFailures === 0;
  const isWarn = !health.isConnected || (health.consecutiveFailures > 0 && health.consecutiveFailures < 3);
  const isErr  = health.consecutiveFailures >= 3;

  const dotColor = isErr ? Colors.error : isWarn ? Colors.warning : '#22C55E';
  const bgColor  = isErr ? '#FEF2F2'    : isWarn ? '#FFFBEB'     : '#F0FDF4';
  const txColor  = isErr ? Colors.error : isWarn ? '#92400E'     : '#15803D';

  return (
    <View style={[pill.wrapper, { backgroundColor: bgColor }]}>
      <Animated.View style={[pill.dot, { backgroundColor: dotColor, opacity: pulse }]} />
      <Text style={[pill.label, { color: txColor }]}>
        {modeLabel[health.mode]}
        {health.queueSize > 0 ? `  •  ${health.queueSize} pending` : ''}
        {!health.isConnected ? '  •  Offline' : ''}
        {health.consecutiveFailures >= 3 ? '  •  Send errors' : ''}
      </Text>
    </View>
  );
}

const pill = StyleSheet.create({
  wrapper: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    paddingHorizontal: 10, paddingVertical: 5, borderRadius: 20,
    alignSelf: 'flex-start', marginTop: 6,
  },
  dot:   { width: 7, height: 7, borderRadius: 4 },
  label: { fontSize: 11, fontWeight: '600' },
});

// ─── Main screen ──────────────────────────────────────────────────────────────

export default function DeliveryDetailScreen() {
  const { driver }     = useAuth();
  const route          = useRoute<Props['route']>();
  const navigation     = useNavigation<NativeStackNavigationProp<AppStackParamList>>();
  const { deliveryID } = route.params;

  const [delivery,        setDelivery]        = useState<Delivery | null>(null);
  const [loading,         setLoading]         = useState(true);
  const [updating,        setUpdating]        = useState(false);
  const [error,           setError]           = useState<string | null>(null);
  const [otpModalVisible, setOtpModalVisible] = useState(false);
  const [otpInput,        setOtpInput]        = useState('');
  const [otpError,        setOtpError]        = useState<string | null>(null);
  const [pendingStatus,   setPendingStatus]   = useState<DeliveryStatus | null>(null);
  const [hasReached,      setHasReached]      = useState(false);
  const [locHealth,       setLocHealth]       = useState<LocationHealth | null>(null);

  // ── Subscribe to location health events ───────────────────────────────────
  useEffect(() => {
    const onHealth = (h: LocationHealth) => setLocHealth(h);
    locationService.on('health', onHealth);
    return () => { locationService.off('health', onHealth); };
  }, []);

  // ── Load delivery ──────────────────────────────────────────────────────────
  const load = useCallback(async () => {
    if (!driver?.driverID) return;
    setLoading(true);
    setError(null);
    try {
      const data = await fetchDeliveryDetail(driver.driverID, deliveryID);
      setDelivery(data);
    } catch (err: any) {
      setError(err.message ?? 'Failed to load delivery');
    } finally {
      setLoading(false);
    }
  }, [driver?.driverID, deliveryID]);

  useEffect(() => { load(); }, [load]);

  // ── Stop location service on unmount ──────────────────────────────────────
  useEffect(() => {
    return () => { locationService.stop(); };
  }, []);

  // ── Status update ──────────────────────────────────────────────────────────
  const handleUpdateStatus = async (next: DeliveryStatus) => {
    if (!driver?.driverID || !delivery) return;

    if (next === 'DELIVERED') {
      if (delivery.orderDetails?.paymentStatus !== 'PAID') {
        Alert.alert(
          '⚠️ Payment Pending',
          'Payment has not been completed. Delivery cannot be marked as delivered until payment is received.',
        );
        return;
      }
      setOtpInput('');
      setOtpError(null);
      setPendingStatus('DELIVERED');
      setOtpModalVisible(true);
      return;
    }

    Alert.alert(
      'Confirm status update',
      `Mark this delivery as "${next}"?`,
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Confirm',
          onPress: async () => {
            setUpdating(true);
            try {
              if (next === 'PICKED_UP') {
                // Start the location service – it handles permission requests
                // and automatically falls back to foreground mode if needed.
                await locationService.start(deliveryID);
              }

              const updated = await updateDeliveryStatus(driver.driverID, deliveryID, next);
              setDelivery(prev => prev ? { ...prev, ...updated } : updated);
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to update status');
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  // ── OTP submit ────────────────────────────────────────────────────────────
  const handleOtpSubmit = async () => {
    if (!driver?.driverID || !pendingStatus) return;
    const trimmedOtp = otpInput.trim();
    if (!trimmedOtp) { setOtpError('Please enter the OTP.'); return; }

    setUpdating(true);
    setOtpError(null);

    try {
      const updated = await updateDeliveryStatus(
        driver.driverID, deliveryID, pendingStatus, trimmedOtp,
      );
      setDelivery(prev => prev ? { ...prev, ...updated } : updated);
      setOtpModalVisible(false);
      setPendingStatus(null);

      // Stop location tracking on successful delivery
      await locationService.stop();
    } catch (err: any) {
      const msg: string = err.message ?? 'Failed to update status';
      if (msg.toLowerCase().includes('otp')) {
        setOtpError(msg);
      } else {
        setOtpModalVisible(false);
        Alert.alert('Error', msg);
      }
    } finally {
      setUpdating(false);
    }
  };

  // ── Reached destination ───────────────────────────────────────────────────
  const handleReached = () => {
    Alert.alert(
      'Confirm Arrival',
      'Have you reached the delivery location?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: `Yes, I've Reached`,
          onPress: async () => {
            // Stop continuous tracking once the driver is stationary at dest.
            // The delivery confirmation (OTP) will call stop() again on success.
            await locationService.stop();
            setHasReached(true);
          },
        },
      ],
    );
  };

  // ── Mark failed ───────────────────────────────────────────────────────────
  const handleMarkFailed = () => {
    Alert.alert(
      'Mark as Failed?',
      'This will mark the delivery as failed. Are you sure?',
      [
        { text: 'Cancel', style: 'cancel' },
        {
          text: 'Mark Failed',
          style: 'destructive',
          onPress: async () => {
            if (!driver?.driverID) return;
            setUpdating(true);
            try {
              const updated = await updateDeliveryStatus(
                driver.driverID, deliveryID, 'FAILED',
              );
              setDelivery(prev => prev ? { ...prev, ...updated } : updated);
              await locationService.stop();
            } catch (err: any) {
              Alert.alert('Error', err.message ?? 'Failed to update');
            } finally {
              setUpdating(false);
            }
          },
        },
      ],
    );
  };

  // ── Loading / error ────────────────────────────────────────────────────────
  if (loading) {
    return (
      <View style={s.center}>
        <ActivityIndicator size="large" color={Colors.primary} />
      </View>
    );
  }

  if (error || !delivery) {
    return (
      <View style={s.center}>
        <Ionicons name="alert-circle-outline" size={36} color={Colors.error} />
        <Text style={s.errorText}>{error ?? 'Delivery not found'}</Text>
        <TouchableOpacity onPress={load}>
          <Text style={s.retryText}>Retry</Text>
        </TouchableOpacity>
      </View>
    );
  }

  const nextAction = NEXT_STATUS[delivery.status];
  const isTerminal = delivery.status === 'DELIVERED' || delivery.status === 'FAILED';
  const order: PharmaOrder | null | undefined = delivery.orderDetails;
  const isTracking = delivery.status === 'PICKED_UP' && !hasReached;

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>

      {/* ── Header ────────────────────────────────────────────────────────── */}
      <Card style={s.headerCard}>
        <View style={s.headerRow}>
          <Text style={s.orderId}>{delivery.orderNumber}</Text>
          <StatusBadge status={delivery.status} />
        </View>
        <Text style={s.deliveryId}>
          {delivery.vehicleNumber}{'  •  '}{delivery.vehicleType}
        </Text>
        {delivery.pharmaID    && <Text style={s.metaText}>Pharmacy: {delivery.pharmaName}</Text>}
        {delivery.distributorID && <Text style={s.metaText}>Distributor: {delivery.companyName}</Text>}
        {delivery.distanceKm != null && <Text style={s.metaText}>Distance: {delivery.distanceKm} km</Text>}

        {/* Live tracking pill */}
        {isTracking && <LocationStatusPill health={locHealth} />}
      </Card>

      {/* ── Order Details ────────────────────────────────────────────────── */}
      {order ? (
        <>
          <SectionHeader label="Order Details" />
          <Card style={s.sectionCard}>
            <InfoRow icon="document-text-outline" label="Order Number" value={order.orderNumber} />
            <InfoRow icon="medkit-outline"        label="Pharmacy"     value={delivery.pharmaName} />

            <View style={s.addressRow}>
              <View style={{ flex: 1 }}>
                <InfoRow icon="location-outline" label="Pharmacy Address"
                  value={formatAddress(delivery.pharmaAddress)} />
              </View>
              {delivery.pharmaLat != null && delivery.pharmaLng != null && (
                <TouchableOpacity style={s.mapsBtn}
                  onPress={() => openInMaps(delivery.pharmaLat!, delivery.pharmaLng!)}>
                  <Ionicons name="navigate" size={14} color="#fff" />
                  <Text style={s.mapsBtnText}>Open</Text>
                </TouchableOpacity>
              )}
            </View>

            <InfoRow icon="storefront-outline" label="Distributor" value={delivery.companyName} />
            <View style={s.addressRow}>
              <View style={{ flex: 1 }}>
                <InfoRow icon="home-outline" label="Distributor Address"
                  value={formatAddress(delivery.distributorAddress)} />
              </View>
              {delivery.distributorLocation.lat != null &&
               delivery.distributorLocation.lng != null && (
                <TouchableOpacity style={s.mapsBtn}
                  onPress={() => openInMaps(
                    delivery.distributorLocation.lat!,
                    delivery.distributorLocation.lng!,
                  )}>
                  <Ionicons name="navigate" size={14} color="#fff" />
                  <Text style={s.mapsBtnText}>Open</Text>
                </TouchableOpacity>
              )}
            </View>

            {order.grandTotal  != null && (
              <InfoRow icon="cash-outline"     label="Grand Total"
                value={`₹${order.grandTotal.toLocaleString('en-IN')}`} />
            )}
            {order.totalAmount != null && (
              <InfoRow icon="pricetag-outline" label="Taxable Amount"
                value={`₹${order.totalAmount.toLocaleString('en-IN')}`} />
            )}
            {order.paymentMode && (
              <InfoRow icon="card-outline" label="Payment Mode"
                value={order.paymentMode.replace(/_/g, ' ')} />
            )}
            {order.paymentStatus && (
              <View style={s.orderStatusRow}>
                <Text style={s.infoLabel}>Payment Status</Text>
                <View style={[
                  s.orderStatusBadge,
                  order.paymentStatus === 'PAID'   ? s.badgeGreen :
                  order.paymentStatus === 'FAILED' ? s.badgeRed   : s.badgeYellow,
                ]}>
                  <Text style={s.orderStatusText}>{order.paymentStatus}</Text>
                </View>
              </View>
            )}
            <View style={s.orderStatusRow}>
              <Text style={s.infoLabel}>Order Status</Text>
              <View style={[
                s.orderStatusBadge,
                order.status === 'DELIVERED'  ? s.badgeGreen  :
                order.status === 'CANCELLED'  ? s.badgeRed    :
                order.status === 'DISPATCHED' ? s.badgeBlue   :
                order.status === 'PICKED_UP'  ? s.badgePink   : s.badgeYellow,
              ]}>
                <Text style={s.orderStatusText}>{order.status}</Text>
              </View>
            </View>

            {order.taxBreakdown && (
              <View style={s.taxBox}>
                <Text style={s.taxTitle}>Tax Breakdown</Text>
                <TaxRow label="Gross"     value={order.taxBreakdown.gross} />
                <TaxRow label="Discount"  value={-order.taxBreakdown.discount} />
                <TaxRow label="Taxable"   value={order.taxBreakdown.taxable} />
                <TaxRow label="CGST"      value={order.taxBreakdown.cgst} />
                <TaxRow label="SGST"      value={order.taxBreakdown.sgst} />
                <TaxRow label="Total GST" value={order.taxBreakdown.gst} bold />
              </View>
            )}
          </Card>

          {/* Medicines */}
          {order.items?.length > 0 && (
            <>
              <SectionHeader label={`Medicines (${order.items.length})`} />
              <Card style={s.sectionCard}>
                {order.items.map((item, i) => (
                  <View key={i} style={[s.medicineRow, i < order.items.length - 1 && s.itemBorder]}>
                    <View style={s.medicineLeft}>
                      <Text style={s.medicineName}>{item.name}</Text>
                      {item.hsnCode          != null && <Text style={s.medicineMeta}>HSN: {item.hsnCode}</Text>}
                      {item.mrpPerPack       != null && <Text style={s.medicineMeta}>MRP: ₹{item.mrpPerPack}</Text>}
                      {item.price            != null && <Text style={s.medicineMeta}>Price: ₹{item.price}</Text>}
                      {item.discountPercent  != null && <Text style={s.medicineMeta}>Discount: {item.discountPercent}%</Text>}
                      {item.gstRate          != null && <Text style={s.medicineMeta}>GST: {item.gstRate}%</Text>}
                    </View>
                    <View style={s.medicineRight}>
                      <Text style={s.medicineQty}>{item.quantity}</Text>
                      {item.price != null && (
                        <Text style={s.medicinePrice}>
                          Total: ₹{(item.totalAmount || item.price * item.quantity).toLocaleString('en-IN')}
                        </Text>
                      )}
                    </View>
                  </View>
                ))}
              </Card>
            </>
          )}
        </>
      ) : (
        <>
          <SectionHeader label="Order Details" />
          <Card style={s.sectionCard}>
            <View style={s.noOrderRow}>
              <Ionicons name="information-circle-outline" size={16} color={Colors.textMuted} />
              <Text style={s.noOrderText}>Order details not available for {delivery.orderNumber}</Text>
            </View>
          </Card>
        </>
      )}

      {/* ── Driver & Vehicle ──────────────────────────────────────────────── */}
      <SectionHeader label="Driver & Vehicle" />
      <Card style={s.sectionCard}>
        <InfoRow icon="person-outline" label="Driver"  value={delivery.driverName} />
        <InfoRow icon="call-outline"   label="Phone"   value={delivery.driverPhone}
          onPress={() => Linking.openURL(`tel:${delivery.driverPhone}`)} />
        <InfoRow icon="car-outline"    label="Vehicle"
          value={`${delivery.vehicleNumber} (${delivery.vehicleType})`} />
        {delivery.driverRatingAtDispatch != null && (
          <InfoRow icon="star-outline" label="Rating" value={`${delivery.driverRatingAtDispatch} ⭐`} />
        )}
      </Card>

      {/* ── Timeline ──────────────────────────────────────────────────────── */}
      <SectionHeader label="Timeline" />
      <Card style={s.sectionCard}>
        {order?.placedAt   && <InfoRow icon="time-outline"      label="Order Placed"  value={new Date(order.placedAt).toLocaleString('en-IN')} />}
        {order?.acceptedAt && <InfoRow icon="checkmark-outline" label="Accepted At"   value={new Date(order.acceptedAt).toLocaleString('en-IN')} />}
        {order?.eta        && <InfoRow icon="navigate-outline"  label="ETA"           value={new Date(order.eta).toLocaleString('en-IN')} />}
        <InfoRow icon="calendar-outline" label="Dispatched At"
          value={new Date(delivery.createdAt).toLocaleString('en-IN')} />
      </Card>

      {/* ── Action buttons ────────────────────────────────────────────────── */}
      {!isTerminal && (
        <View style={s.actions}>
          {delivery.status === 'DISPATCHED' && nextAction && (
            <Button label={nextAction.label} onPress={() => handleUpdateStatus(nextAction.next)}
              loading={updating} size="lg" style={{ backgroundColor: nextAction.color }} />
          )}

          {delivery.status === 'PICKED_UP' && !hasReached && (
            <Button label="📍  I've Reached" onPress={handleReached}
              size="lg" style={{ backgroundColor: Colors.primary }} />
          )}

          {delivery.status === 'PICKED_UP' && hasReached && (
            <>
              {nextAction && (
                <Button label={nextAction.label} onPress={() => handleUpdateStatus(nextAction.next)}
                  loading={updating} size="lg" style={{ backgroundColor: nextAction.color }} />
              )}
              <Button label="Mark as Failed" onPress={handleMarkFailed}
                loading={updating} variant="danger" size="lg" />
            </>
          )}
        </View>
      )}

      {/* ── Terminal card ─────────────────────────────────────────────────── */}
      {isTerminal && (
        <Card style={[s.terminalCard, {
          borderColor: delivery.status === 'DELIVERED' ? '#BBF7D0' : '#FECACA',
        }]}>
          <Ionicons
            name={delivery.status === 'DELIVERED' ? 'checkmark-circle' : 'close-circle'}
            size={24}
            color={delivery.status === 'DELIVERED' ? Colors.success : Colors.error}
          />
          <Text style={[s.terminalText, {
            color: delivery.status === 'DELIVERED' ? Colors.success : Colors.error,
          }]}>
            {delivery.status === 'DELIVERED'
              ? 'Delivery completed successfully'
              : 'Delivery marked as failed'}
          </Text>
        </Card>
      )}

      {/* ── OTP Modal ─────────────────────────────────────────────────────── */}
      <Modal
        visible={otpModalVisible}
        transparent
        animationType="fade"
        onRequestClose={() => { setOtpModalVisible(false); setOtpInput(''); setOtpError(null); }}
      >
        <KeyboardAvoidingView
          behavior={Platform.OS === 'ios' ? 'padding' : 'height'}
          style={s.modalOverlay}
        >
          <View style={s.modalCard}>
            <View style={s.modalHeader}>
              <Ionicons name="lock-closed-outline" size={22} color={Colors.primary} />
              <Text style={s.modalTitle}>Enter Delivery OTP</Text>
            </View>
            <Text style={s.modalSubtitle}>Ask the recipient for the OTP to confirm delivery.</Text>
            <TextInput
              style={[s.otpInput, otpError ? s.otpInputError : null]}
              placeholder="Enter OTP"
              placeholderTextColor={Colors.textMuted}
              keyboardType="number-pad"
              maxLength={6}
              value={otpInput}
              onChangeText={text => { setOtpInput(text); setOtpError(null); }}
              autoFocus
            />
            {otpError && (
              <View style={s.otpErrorRow}>
                <Ionicons name="alert-circle-outline" size={14} color={Colors.error} />
                <Text style={s.otpErrorText}>{otpError}</Text>
              </View>
            )}
            <View style={s.modalActions}>
              <TouchableOpacity
                style={s.modalCancelBtn}
                onPress={() => { setOtpModalVisible(false); setOtpInput(''); setOtpError(null); }}
                disabled={updating}
              >
                <Text style={s.modalCancelText}>Cancel</Text>
              </TouchableOpacity>
              <TouchableOpacity
                style={[s.modalConfirmBtn, updating && { opacity: 0.6 }]}
                onPress={handleOtpSubmit}
                disabled={updating}
              >
                {updating
                  ? <ActivityIndicator size="small" color="#fff" />
                  : <Text style={s.modalConfirmText}>Confirm Delivery</Text>}
              </TouchableOpacity>
            </View>
          </View>
        </KeyboardAvoidingView>
      </Modal>
    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, onPress }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string;
  value?: string | null;
  onPress?: () => void;
}) {
  return (
    <TouchableOpacity style={s.infoRow} onPress={onPress} disabled={!onPress} activeOpacity={0.7}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoValue, onPress && { color: Colors.blue }]}>{value ?? 'N/A'}</Text>
      </View>
      {onPress && <Ionicons name="chevron-forward" size={14} color={Colors.textLight} />}
    </TouchableOpacity>
  );
}

function TaxRow({ label, value, bold }: { label: string; value: number; bold?: boolean }) {
  return (
    <View style={s.taxRow}>
      <Text style={[s.taxLabel, bold && { fontWeight: '700' }]}>{label}</Text>
      <Text style={[s.taxValue,  bold && { fontWeight: '700' }]}>
        ₹{value.toLocaleString('en-IN', { minimumFractionDigits: 2 })}
      </Text>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll:             { flex: 1, backgroundColor: Colors.bg },
  content:            { padding: 16, paddingBottom: 48, gap: 0 },
  center:             { flex: 1, alignItems: 'center', justifyContent: 'center', gap: 12 },
  headerCard:         { marginBottom: 8, gap: 4 },
  headerRow:          { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start' },
  orderId:            { fontSize: 18, fontWeight: '800', color: Colors.text },
  deliveryId:         { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  metaText:           { fontSize: 11, color: Colors.textMuted },
  sectionCard:        { marginBottom: 8, gap: 2 },
  infoRow:            { flexDirection: 'row', alignItems: 'flex-start', gap: 10, paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB' },
  infoLabel:          { fontSize: 11, color: Colors.textMuted, marginBottom: 1 },
  infoValue:          { fontSize: 14, fontWeight: '500', color: Colors.text, lineHeight: 20 },
  orderStatusRow:     { flexDirection: 'row', alignItems: 'center', justifyContent: 'space-between', paddingVertical: 8 },
  addressRow:         { flexDirection: 'row', alignItems: 'center' },
  mapsBtn:            { flexDirection: 'row', alignItems: 'center', gap: 4, backgroundColor: Colors.blue, borderRadius: 8, paddingHorizontal: 10, paddingVertical: 6, marginLeft: 8 },
  mapsBtnText:        { fontSize: 12, fontWeight: '600', color: '#fff' },
  orderStatusBadge:   { paddingHorizontal: 10, paddingVertical: 3, borderRadius: 20 },
  orderStatusText:    { fontSize: 12, fontWeight: '600', color: '#fff' },
  badgeGreen:         { backgroundColor: Colors.success },
  badgeRed:           { backgroundColor: Colors.error },
  badgeBlue:          { backgroundColor: Colors.blue },
  badgeYellow:        { backgroundColor: Colors.warning },
  badgePink:          { backgroundColor: '#FF69B4' },
  taxBox:             { marginTop: 8, backgroundColor: '#F9FAFB', borderRadius: 8, padding: 10, gap: 4 },
  taxTitle:           { fontSize: 12, fontWeight: '700', color: Colors.textMuted, marginBottom: 4 },
  taxRow:             { flexDirection: 'row', justifyContent: 'space-between' },
  taxLabel:           { fontSize: 12, color: Colors.textMuted },
  taxValue:           { fontSize: 12, color: Colors.text },
  medicineRow:        { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'flex-start', paddingVertical: 10 },
  medicineLeft:       { flex: 1, paddingRight: 8 },
  medicineRight:      { alignItems: 'flex-end' },
  medicineName:       { fontSize: 14, fontWeight: '600', color: Colors.text },
  medicineMeta:       { fontSize: 11, color: Colors.textLight, marginTop: 2 },
  medicineQty:        { fontSize: 14, fontWeight: '600', color: Colors.primary },
  medicinePrice:      { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  noOrderRow:         { flexDirection: 'row', alignItems: 'center', gap: 8, paddingVertical: 8 },
  noOrderText:        { fontSize: 13, color: Colors.textMuted },
  itemBorder:         { borderBottomWidth: 1, borderBottomColor: '#F3F4F6' },
  actions:            { gap: 10, marginTop: 16 },
  terminalCard:       { flexDirection: 'row', alignItems: 'center', gap: 10, borderWidth: 1.5, borderRadius: 12, padding: 16, marginTop: 16, backgroundColor: '#fff' },
  terminalText:       { fontSize: 14, fontWeight: '600', flex: 1 },
  errorText:          { fontSize: 14, color: Colors.error, textAlign: 'center' },
  retryText:          { fontSize: 14, color: Colors.primary, fontWeight: '600' },
  modalOverlay:       { flex: 1, backgroundColor: 'rgba(0,0,0,0.45)', justifyContent: 'center', alignItems: 'center', padding: 24 },
  modalCard:          { width: '100%', backgroundColor: '#fff', borderRadius: 16, padding: 20, gap: 12 },
  modalHeader:        { flexDirection: 'row', alignItems: 'center', gap: 8 },
  modalTitle:         { fontSize: 16, fontWeight: '700', color: Colors.text },
  modalSubtitle:      { fontSize: 13, color: Colors.textMuted, lineHeight: 18 },
  otpInput:           { borderWidth: 1.5, borderColor: '#D1D5DB', borderRadius: 10, padding: 14, fontSize: 22, fontWeight: '700', letterSpacing: 8, textAlign: 'center', color: Colors.text, marginTop: 4 },
  otpInputError:      { borderColor: Colors.error },
  otpErrorRow:        { flexDirection: 'row', alignItems: 'center', gap: 6 },
  otpErrorText:       { fontSize: 13, color: Colors.error },
  modalActions:       { flexDirection: 'row', gap: 10, marginTop: 4 },
  modalCancelBtn:     { flex: 1, padding: 14, borderRadius: 10, borderWidth: 1, borderColor: '#D1D5DB', alignItems: 'center' },
  modalCancelText:    { fontSize: 14, fontWeight: '600', color: Colors.textMuted },
  modalConfirmBtn:    { flex: 2, padding: 14, borderRadius: 10, backgroundColor: Colors.success, alignItems: 'center', justifyContent: 'center' },
  modalConfirmText:   { fontSize: 14, fontWeight: '700', color: '#fff' },
});