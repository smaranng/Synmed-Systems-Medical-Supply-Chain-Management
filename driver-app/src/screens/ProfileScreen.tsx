import React, { useState, useEffect } from 'react';
import {
  View, Text, ScrollView, StyleSheet, TouchableOpacity, Alert, TextInput,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { changePassword } from '../api/api';
import { Colors, Card, SectionHeader, Button } from '../components/ui';

export default function ProfileScreen() {
  const { driver, logout } = useAuth();
  const vehicle = (driver as any)?.vehicle ?? null;
  const [current, setCurrent]     = useState('');
  const [next, setNext]           = useState('');
  const [showCurr, setShowCurr]   = useState(false);
  const [showNext, setShowNext]   = useState(false);
  const [pwLoading, setPwLoading] = useState(false);

 /* useEffect(() => {
    if (driver?.driverID) {
      fetchDriverVehicle(driver.driverID)
        .then(setVehicle)
        .catch(() => {}); // silently ignore if no vehicle
    }
  }, [driver?.driverID]);*/

  const handleChangePassword = async () => {
    if (!current.trim() || !next.trim()) {
      Alert.alert('Error', 'Both fields are required.');
      return;
    }
    if (next.length < 6) {
      Alert.alert('Error', 'New password must be at least 6 characters.');
      return;
    }
    if (!driver?.driverID) return;
    setPwLoading(true);
    try {
      await changePassword(driver.driverID, current, next);
      Alert.alert('Success', 'Password updated successfully.');
      setCurrent(''); setNext('');
    } catch (err: any) {
      Alert.alert('Error', err.message ?? 'Failed to change password.');
    } finally {
      setPwLoading(false);
    }
  };

  const handleLogout = () => {
    Alert.alert('Sign out', 'Are you sure you want to sign out?', [
      { text: 'Cancel', style: 'cancel' },
      { text: 'Sign Out', style: 'destructive', onPress: logout },
    ]);
  };

  if (!driver) return null;

  const daysUntil = (dateStr: string | null) => {
    if (!dateStr) return null;
    return Math.ceil((new Date(dateStr).getTime() - Date.now()) / 86_400_000);
  };

  const licDays = daysUntil(driver.licenseExpiry);
  const insDays = daysUntil(vehicle?.insuranceExpiry ?? null);
  const perDays = daysUntil(vehicle?.permitExpiry ?? null);

  return (
    <ScrollView style={s.scroll} contentContainerStyle={s.content}>

      {/* Avatar + name */}
      <View style={s.avatarSection}>
        <View style={s.avatar}>
          <Text style={s.avatarText}>
            {driver.name.split(' ').map(n => n[0]).join('').slice(0, 2).toUpperCase()}
          </Text>
        </View>
        <Text style={s.driverName}>{driver.name}</Text>
        <Text style={s.driverId}>{driver.driverID}</Text>
        <View style={[s.statusPill, { backgroundColor: driver.isActive ? '#DCFCE7' : '#F3F4F6' }]}>
          <View style={[s.dot, { backgroundColor: driver.isActive ? Colors.success : Colors.textLight }]} />
          <Text style={[s.statusText, { color: driver.isActive ? Colors.success : Colors.textMuted }]}>
            {driver.isActive ? 'Active' : 'Inactive'}
          </Text>
        </View>
      </View>

      {/* Account Info */}
      <SectionHeader label="Account Info" />
      <Card style={s.infoCard}>
        <InfoRow icon="call-outline"     label="Phone"       value={driver.phone} />
        <InfoRow icon="person-outline"   label="Username"    value={driver.username} />
       <InfoRow icon="business-outline" label="Distributor" value={driver.companyName ?? driver.distributorID} />
      </Card>

      {/* Vehicle (from distributor_vehicles, ownership = Driver) */}
      {vehicle && (
        <>
          <SectionHeader label="My Vehicle" />
          <Card style={s.infoCard}>
            <InfoRow icon="car-outline"         label="Registration" value={vehicle.registrationNumber} />
            <InfoRow icon="speedometer-outline" label="Type"         value={vehicle.vehicleType} />
            <InfoRow icon="cube-outline"        label="Capacity"     value={`${vehicle.capacity} kg`} />
            <InfoRow icon="flame-outline"       label="Fuel Type"    value={vehicle.fuelType} />
            <InfoRow icon="shield-outline"      label="Insurance Expiry"
              value={vehicle.insuranceExpiry ?? 'N/A'}
              warning={insDays !== null && insDays <= 30 && insDays > 0}
              expired={insDays !== null && insDays <= 0}
            />
            <InfoRow icon="document-text-outline" label="Permit Expiry"
              value={vehicle.permitExpiry ?? 'N/A'}
              warning={perDays !== null && perDays <= 30 && perDays > 0}
              expired={perDays !== null && perDays <= 0}
            />
            <View style={[s.statusPill, { alignSelf: 'flex-start', marginTop: 6,
              backgroundColor: vehicle.status === 'Active' ? '#DCFCE7' : '#F3F4F6' }]}>
              <View style={[s.dot, { backgroundColor: vehicle.status === 'Active' ? Colors.success : Colors.textLight }]} />
              <Text style={[s.statusText, { color: vehicle.status === 'Active' ? Colors.success : Colors.textMuted }]}>
                {vehicle.status}
              </Text>
            </View>
          </Card>

          {/* Expiry warnings */}
          {insDays !== null && insDays <= 30 && insDays > 0 && (
            <ExpiryBanner label={`Insurance expires in ${insDays} day${insDays !== 1 ? 's' : ''}.`} />
          )}
          {perDays !== null && perDays <= 30 && perDays > 0 && (
            <ExpiryBanner label={`Permit expires in ${perDays} day${perDays !== 1 ? 's' : ''}.`} />
          )}
        </>
      )}

      {/* License */}
      {driver.licenseNumber && (
        <>
          <SectionHeader label="Driving License" />
          <Card style={s.infoCard}>
            <InfoRow icon="card-outline"     label="DL Number" value={driver.licenseNumber} />
            {driver.licenseExpiry && (
              <InfoRow icon="calendar-outline" label="Expiry" value={driver.licenseExpiry}
                warning={licDays !== null && licDays <= 30 && licDays > 0}
                expired={licDays !== null && licDays <= 0}
              />
            )}
          </Card>
          {licDays !== null && licDays <= 30 && licDays > 0 && (
            <ExpiryBanner label={`DL expires in ${licDays} day${licDays !== 1 ? 's' : ''}. Please renew it.`} />
          )}
        </>
      )}

      {/* Change Password */}
      <SectionHeader label="Change Password" />
      <Card style={s.pwCard}>
        <PasswordField placeholder="Current Password" value={current} onChange={setCurrent}
          show={showCurr} onToggle={() => setShowCurr(p => !p)} />
        <PasswordField placeholder="New Password" value={next} onChange={setNext}
          show={showNext} onToggle={() => setShowNext(p => !p)} />
        <Button label="Update Password" onPress={handleChangePassword} loading={pwLoading} size="lg" />
      </Card>

      {/* Sign out */}
      <TouchableOpacity style={s.logoutBtn} onPress={handleLogout} activeOpacity={0.8}>
        <Ionicons name="log-out-outline" size={18} color={Colors.error} />
        <Text style={s.logoutText}>Sign Out</Text>
      </TouchableOpacity>

    </ScrollView>
  );
}

// ─── Sub-components ───────────────────────────────────────────────────────────

function InfoRow({ icon, label, value, warning, expired }: {
  icon: keyof typeof Ionicons.glyphMap;
  label: string; value: string;
  warning?: boolean; expired?: boolean;
}) {
  const valueColor = expired ? Colors.error : warning ? Colors.warning : Colors.text;
  return (
    <View style={s.infoRow}>
      <Ionicons name={icon} size={16} color={Colors.primary} />
      <View style={{ flex: 1 }}>
        <Text style={s.infoLabel}>{label}</Text>
        <Text style={[s.infoValue, { color: valueColor }]}>{value}</Text>
      </View>
      {(warning || expired) && (
        <Ionicons name="alert-circle" size={16} color={expired ? Colors.error : Colors.warning} />
      )}
    </View>
  );
}

function ExpiryBanner({ label }: { label: string }) {
  return (
    <View style={s.warningBanner}>
      <Ionicons name="warning-outline" size={14} color={Colors.warning} />
      <Text style={s.warningText}>{label}</Text>
    </View>
  );
}

function PasswordField({ placeholder, value, onChange, show, onToggle }: {
  placeholder: string; value: string;
  onChange: (v: string) => void;
  show: boolean; onToggle: () => void;
}) {
  return (
    <View style={s.pwField}>
      <Ionicons name="lock-closed-outline" size={17} color={Colors.textLight} />
      <TextInput style={s.pwInput} placeholder={placeholder}
        placeholderTextColor={Colors.textLight} value={value}
        onChangeText={onChange} secureTextEntry={!show} autoCapitalize="none" />
      <TouchableOpacity onPress={onToggle} hitSlop={{ top: 8, bottom: 8, left: 8, right: 8 }}>
        <Ionicons name={show ? 'eye-outline' : 'eye-off-outline'} size={17} color={Colors.textLight} />
      </TouchableOpacity>
    </View>
  );
}

// ─── Styles ───────────────────────────────────────────────────────────────────

const s = StyleSheet.create({
  scroll:        { flex: 1, backgroundColor: Colors.bg },
  content:       { padding: 20, paddingBottom: 48 },

  avatarSection: { alignItems: 'center', marginBottom: 8, paddingVertical: 16 },
  avatar: {
    width: 80, height: 80, borderRadius: 40, backgroundColor: Colors.primary,
    alignItems: 'center', justifyContent: 'center', marginBottom: 12,
  },
  avatarText:    { fontSize: 28, fontWeight: '800', color: '#fff' },
  driverName:    { fontSize: 20, fontWeight: '700', color: Colors.text },
  driverId:      { fontSize: 12, color: Colors.textMuted, marginTop: 2 },
  statusPill: {
    flexDirection: 'row', alignItems: 'center', gap: 6,
    borderRadius: 100, paddingHorizontal: 12, paddingVertical: 5, marginTop: 10,
  },
  dot:           { width: 7, height: 7, borderRadius: 4 },
  statusText:    { fontSize: 12, fontWeight: '600' },

  infoCard:      { marginBottom: 8, gap: 2 },
  infoRow: {
    flexDirection: 'row', alignItems: 'flex-start', gap: 10,
    paddingVertical: 8, borderBottomWidth: 1, borderBottomColor: '#F9FAFB',
  },
  infoLabel:     { fontSize: 11, color: Colors.textMuted },
  infoValue:     { fontSize: 14, fontWeight: '500', lineHeight: 20 },

  warningBanner: {
    flexDirection: 'row', alignItems: 'center', gap: 8,
    backgroundColor: '#FFFBEB', borderWidth: 1, borderColor: '#FDE68A',
    borderRadius: 10, padding: 10, marginBottom: 8,
  },
  warningText:   { flex: 1, fontSize: 12, color: Colors.warning },

  pwCard:        { marginBottom: 16, gap: 12 },
  pwField: {
    flexDirection: 'row', alignItems: 'center', gap: 10,
    backgroundColor: '#F9FAFB', borderWidth: 1, borderColor: '#E5E7EB',
    borderRadius: 10, height: 48, paddingHorizontal: 12,
  },
  pwInput:       { flex: 1, fontSize: 14, color: Colors.text },

  logoutBtn: {
    flexDirection: 'row', alignItems: 'center', justifyContent: 'center', gap: 8,
    borderWidth: 1.5, borderColor: '#FECACA', borderRadius: 12, height: 48,
    backgroundColor: '#FEF2F2',
  },
  logoutText:    { fontSize: 15, fontWeight: '600', color: Colors.error },
});