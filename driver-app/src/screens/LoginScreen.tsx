import React, { useState } from 'react';
import {
  View, Text, TextInput, TouchableOpacity,
  StyleSheet, KeyboardAvoidingView, Platform,
  ScrollView, ActivityIndicator, StatusBar, Dimensions,
} from 'react-native';
import { Ionicons } from '@expo/vector-icons';
import { useAuth } from '../context/AuthContext';
import { Colors } from '../components/ui';

const { width: SCREEN_WIDTH } = Dimensions.get('window');
const isWeb = Platform.OS === 'web';
const isTablet = SCREEN_WIDTH >= 768;

export default function LoginScreen() {
  const { login } = useAuth();

  const [username, setUsername] = useState('');
  const [password, setPassword] = useState('');
  const [showPass, setShowPass] = useState(false);
  const [loading, setLoading]   = useState(false);
  const [error, setError]       = useState<string | null>(null);

  const handleLogin = async () => {
    if (!username.trim() || !password.trim()) {
      setError('Username and password are required.');
      return;
    }
    setError(null);
    setLoading(true);
    try {
      await login(username.trim(), password);
    } catch (err: any) {
      setError(err.message ?? 'Login failed. Please try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <KeyboardAvoidingView
      style={s.root}
      behavior={Platform.OS === 'ios' ? 'padding' : undefined}
    >
      {!isWeb && (
        <StatusBar barStyle="light-content" backgroundColor={Colors.primaryDk} />
      )}

      <ScrollView
        contentContainerStyle={s.scrollContent}
        keyboardShouldPersistTaps="handled"
      >
        {/* Web/Tablet: side-by-side layout | Mobile: stacked */}
        <View style={s.container}>

          {/* Left panel — branding (web/tablet only) */}
          {(isWeb || isTablet) && (
            <View style={s.leftPanel}>
              <View style={s.iconWrap}>
                <Ionicons name="car" size={48} color={Colors.primary} />
              </View>
              <Text style={s.brandTitle}>Synmed Driver App</Text>
              <Text style={s.brandSubtitle}>
                Manage your deliveries efficiently on the go.
              </Text>
            </View>
          )}

          {/* Right panel — login form */}
          <View style={s.card}>

            {/* Mobile header (only on phone) */}
            {!isWeb && !isTablet && (
              <View style={s.mobileHeader}>
                <View style={s.iconWrapSm}>
                  <Ionicons name="car" size={32} color={Colors.primary} />
                </View>
                <Text style={s.mobileTitle}>Synmed Driver App</Text>
                <Text style={s.mobileSubtitle}>Sign in to your account</Text>
              </View>
            )}

            {(isWeb || isTablet) && (
              <>
                <Text style={s.cardTitle}>Welcome back</Text>
                <Text style={s.cardSubtitle}>Sign in to your account</Text>
              </>
            )}

            {/* Error */}
            {error && (
              <View style={s.errorBox}>
                <Ionicons name="alert-circle-outline" size={16} color={Colors.error} />
                <Text style={s.errorText}>{error}</Text>
              </View>
            )}

            {/* Username */}
            <Text style={s.label}>Username</Text>
            <View style={s.fieldWrap}>
              <Ionicons name="person-outline" size={18} color={Colors.textLight} style={s.fieldIcon} />
              <TextInput
                style={s.input}
                placeholder="Enter your username"
                placeholderTextColor={Colors.textLight}
                value={username}
                onChangeText={setUsername}
                autoCapitalize="none"
                autoCorrect={false}
                returnKeyType="next"
              />
            </View>

            {/* Password */}
            <Text style={s.label}>Password</Text>
            <View style={s.fieldWrap}>
              <Ionicons name="lock-closed-outline" size={18} color={Colors.textLight} style={s.fieldIcon} />
              <TextInput
                style={[s.input, { paddingRight: 44 }]}
                placeholder="Enter your password"
                placeholderTextColor={Colors.textLight}
                value={password}
                onChangeText={setPassword}
                secureTextEntry={!showPass}
                returnKeyType="done"
                onSubmitEditing={handleLogin}
              />
              <TouchableOpacity style={s.eyeBtn} onPress={() => setShowPass(p => !p)}>
                <Ionicons
                  name={showPass ? 'eye-outline' : 'eye-off-outline'}
                  size={18}
                  color={Colors.textLight}
                />
              </TouchableOpacity>
            </View>

            {/* Login button */}
            <TouchableOpacity
              style={[s.loginBtn, loading && { opacity: 0.75 }]}
              onPress={handleLogin}
              disabled={loading}
              activeOpacity={0.85}
            >
              {loading
                ? <ActivityIndicator color="#fff" />
                : <Text style={s.loginBtnText}>Sign In</Text>
              }
            </TouchableOpacity>

            <Text style={s.hint}>
              Your credentials are provided by your distributor.
            </Text>
          </View>

        </View>
      </ScrollView>
    </KeyboardAvoidingView>
  );
}

const s = StyleSheet.create({
  root: {
    flex: 1,
    backgroundColor: isWeb ? '#F3F4F6' : Colors.bg,
  },
  scrollContent: {
    flexGrow: 1,
    justifyContent: 'center',
    alignItems: 'center',
    padding: isWeb ? 40 : 0,
    minHeight: isWeb ? '100vh' as any : undefined,
  },
  container: {
    flexDirection: isWeb || isTablet ? 'row' : 'column',
    width: '100%',
    maxWidth: isWeb ? 900 : isTablet ? 700 : undefined,
    minHeight: isWeb ? 500 : undefined,
    borderRadius: isWeb || isTablet ? 20 : 0,
    overflow: 'hidden',
    shadowColor: '#000',
    shadowOffset: { width: 0, height: isWeb ? 8 : 0 },
    shadowOpacity: isWeb ? 0.12 : 0,
    shadowRadius: isWeb ? 24 : 0,
    elevation: isWeb ? 8 : 0,
  },

  // Left branding panel (web/tablet)
  leftPanel: {
    flex: 1,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    padding: 48,
  },
  iconWrap: {
    width: 90,
    height: 90,
    borderRadius: 45,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 20,
  },
  brandTitle: {
    fontSize: 28,
    fontWeight: '700',
    color: '#fff',
    textAlign: 'center',
    letterSpacing: 0.5,
  },
  brandSubtitle: {
    fontSize: 14,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 10,
    textAlign: 'center',
    maxWidth: 260,
    lineHeight: 22,
  },

  // Right card (form)
  card: {
    flex: isWeb || isTablet ? 1 : undefined,
    backgroundColor: '#fff',
    padding: isWeb || isTablet ? 48 : 24,
    paddingTop: isWeb || isTablet ? 48 : 0,
    width: isWeb || isTablet ? undefined : '100%',
    justifyContent: 'center',
  },
  cardTitle: {
    fontSize: 26,
    fontWeight: '700',
    color: Colors.text,
    marginBottom: 4,
  },
  cardSubtitle: {
    fontSize: 14,
    color: Colors.textLight,
    marginBottom: 28,
  },

  // Mobile-only header
  mobileHeader: {
    backgroundColor: Colors.primary,
    alignItems: 'center',
    paddingTop: 70,
    paddingBottom: 36,
    marginBottom: 24,
    marginHorizontal: -24,
  },
  iconWrapSm: {
    width: 68,
    height: 68,
    borderRadius: 34,
    backgroundColor: '#fff',
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 12,
  },
  mobileTitle: {
    fontSize: 22,
    fontWeight: '700',
    color: '#fff',
  },
  mobileSubtitle: {
    fontSize: 13,
    color: 'rgba(255,255,255,0.8)',
    marginTop: 4,
  },

  // Form elements
  label: {
    fontSize: 13,
    fontWeight: '600',
    color: Colors.text,
    marginBottom: 6,
    marginTop: 10,
  },
  errorBox: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 8,
    backgroundColor: '#FEF2F2',
    borderWidth: 1,
    borderColor: '#FECACA',
    borderRadius: 10,
    padding: 12,
    marginBottom: 12,
  },
  errorText: {
    flex: 1,
    fontSize: 13,
    color: Colors.error,
  },
  fieldWrap: {
    flexDirection: 'row',
    alignItems: 'center',
    backgroundColor: '#F9FAFB',
    borderWidth: 1,
    borderColor: '#E5E7EB',
    borderRadius: 12,
    height: 50,
    paddingHorizontal: 12,
    marginBottom: 4,
  },
  fieldIcon: {
    marginRight: 10,
  },
  input: {
    flex: 1,
    fontSize: 15,
    color: Colors.text,
    outlineStyle: 'none' as any,
  },
  eyeBtn: {
    position: 'absolute',
    right: 12,
    padding: 4,
  },
  loginBtn: {
    height: 50,
    borderRadius: 12,
    backgroundColor: Colors.primary,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 20,
    shadowColor: Colors.primary,
    shadowOffset: { width: 0, height: 4 },
    shadowOpacity: 0.3,
    shadowRadius: 8,
    elevation: 5,
  },
  loginBtnText: {
    color: '#fff',
    fontSize: 16,
    fontWeight: '700',
    letterSpacing: 0.4,
  },
  hint: {
    textAlign: 'center',
    fontSize: 12,
    color: Colors.textLight,
    marginTop: 16,
  },
});