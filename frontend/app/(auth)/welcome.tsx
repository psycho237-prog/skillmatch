import React, { useState } from 'react';
import { View, StyleSheet, ScrollView, TextInput, TouchableOpacity, Alert, Image, Text, Platform } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { Button } from '../../src/components/Button';
import { api } from '../../src/services/api';
import { images } from '../../src/constants';
import { SafeAreaView } from 'react-native-safe-area-context';
import { CountryPicker, COUNTRIES } from '../../src/components/CountryPicker';

export default function Welcome() {
  const router = useRouter();
  const { t, setUser, colors, theme } = useApp();
  const [loading, setLoading] = useState(false);
  const [isLogin, setIsLogin] = useState(true);
  const [showOtpInput, setShowOtpInput] = useState(false);

  const onboardingImage = theme === 'dark' ? images.onboarding_dark : images.onboarding;

  // Form state
  const [countryCode, setCountryCode] = useState('237');
  const [phoneNumber, setPhoneNumber] = useState('');
  const [password, setPassword] = useState('');
  const [displayName, setDisplayName] = useState('');
  const [otpCode, setOtpCode] = useState('');

  const showAlert = (title: string, message: string) => {
    if (Platform.OS === 'web') {
      window.alert(`${title}: ${message}`);
    } else {
      Alert.alert(title, message);
    }
  };

  const handleToggleMode = () => {
    setIsLogin(!isLogin);
    setShowOtpInput(false);
    setOtpCode('');
  };

  // Normalize the phone number: strip non-digits, avoid double country code
  const normalizePhone = (raw: string, code: string): string => {
    const clean = raw.trim();
    // Strip everything except digits
    let digits = clean.replace(/[^\d]/g, '');
    // Remove leading zeros
    digits = digits.replace(/^0+/, '');
    
    // If user explicitly typed '+', trust the code and don't prepend picker code
    if (clean.startsWith('+')) {
      return digits;
    }
    
    // If the number already starts with any known country code, don't double it
    const matchedCountry = COUNTRIES.find(c => digits.startsWith(c.code));
    if (matchedCountry) {
      return digits;
    }
    
    return code + digits;
  };

  const handleSubmit = async () => {
    if (isLogin) {
      if (!phoneNumber || !password) {
        showAlert('Error', 'Please fill in all fields');
        return;
      }

      try {
        setLoading(true);
        const fullPhone = normalizePhone(phoneNumber, countryCode);
        const res = await api.loginWithPhone(fullPhone, password);
        await setUser(res.user, res.token);
        router.replace('/(tabs)/home');
      } catch (error: any) {
        showAlert('Authentication Failed', error.message || 'An error occurred.');
      } finally {
        setLoading(false);
      }
    } else {
      if (!showOtpInput) {
        if (!phoneNumber || !password || !displayName) {
          showAlert('Error', 'Please fill in all fields');
          return;
        }

        try {
          setLoading(true);
          const fullPhone = normalizePhone(phoneNumber, countryCode);
          const res = await api.sendOtp(fullPhone);
          if (res.debug_otp) {
            showAlert('Verification Code (Debug)', `Your code is: ${res.debug_otp}`);
          } else {
            showAlert('Verification Code Sent', 'A verification code has been sent to your number via WhatsApp.');
          }
          setShowOtpInput(true);
        } catch (error: any) {
          showAlert('Verification Failed', error.message || 'Could not send verification code.');
        } finally {
          setLoading(false);
        }
      } else {
        if (!otpCode) {
          showAlert('Error', 'Please enter the verification code');
          return;
        }

        try {
          setLoading(true);
          const fullPhone = normalizePhone(phoneNumber, countryCode);
          const res = await api.registerWithPhone(fullPhone, password, displayName, otpCode);
          await setUser(res.user, res.token);
          router.replace('/(tabs)/home');
        } catch (error: any) {
          showAlert('Registration Failed', error.message || 'An error occurred.');
        } finally {
          setLoading(false);
        }
      }
    }
  };

  return (
    <SafeAreaView key={theme} style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style={theme === 'dark' ? 'light' : 'dark'} />
       
      <ScrollView contentContainerStyle={styles.scroll}>
        <Image style={styles.image} source={onboardingImage}/>
        <View style={styles.header}>
          <Typography variant="h1" align="center" style={styles.title}>
            Welcome to <Text style={{color: colors.primary}}>Swapster</Text>
          </Typography>
          <Typography variant="body2" color={colors.black2} align="center" style={styles.desc}>
            Let's Bridge You to <Text style={{color: colors.primary }}>Your Ideal Client</Text>
          </Typography>
        </View>

        <View style={styles.formContainer}>
          {!showOtpInput ? (
            <>
              {!isLogin && (
                <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                  <TextInput
                    placeholder="Full Name"
                    placeholderTextColor={colors.black3}
                    style={[styles.input, { color: colors.black1 }]}
                    value={displayName}
                    onChangeText={setDisplayName}
                  />
                </View>
              )}

              <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border, flexDirection: 'row', alignItems: 'center' }]}>
                <CountryPicker selectedCode={countryCode} onSelectCode={setCountryCode} />
                <TextInput
                  placeholder="Phone Number"
                  placeholderTextColor={colors.black3}
                  keyboardType="phone-pad"
                  style={[styles.input, { color: colors.black1 }]}
                  value={phoneNumber}
                  onChangeText={setPhoneNumber}
                />
              </View>

              <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  placeholder="Password"
                  placeholderTextColor={colors.black3}
                  secureTextEntry
                  style={[styles.input, { color: colors.black1 }]}
                  value={password}
                  onChangeText={setPassword}
                />
              </View>
            </>
          ) : (
            <>
              <Typography variant="body2" color={colors.black2} align="center" style={{ marginBottom: 15 }}>
                Enter the 6-digit code sent to <Text style={{ fontWeight: 'bold', color: colors.primary }}>+{countryCode} {phoneNumber}</Text> via WhatsApp.
              </Typography>
              
              <View style={[styles.inputGroup, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <TextInput
                  placeholder="6-Digit Code"
                  placeholderTextColor={colors.black3}
                  keyboardType="number-pad"
                  style={[styles.input, { color: colors.black1, textAlign: 'center', letterSpacing: 8 }]}
                  value={otpCode}
                  onChangeText={setOtpCode}
                  maxLength={6}
                />
              </View>
            </>
          )}

          <Button
            title={isLogin ? 'Login' : showOtpInput ? 'Verify & Sign Up' : 'Send Verification Code'}
            onPress={handleSubmit}
            loading={loading}
            fullWidth
            style={styles.btn}
          />

          {showOtpInput && (
            <TouchableOpacity onPress={() => setShowOtpInput(false)} style={styles.toggleBtn}>
              <Typography variant="body2" color={colors.primary} align="center">
                Change Phone Number
              </Typography>
            </TouchableOpacity>
          )}

          {!showOtpInput && (
            <TouchableOpacity onPress={handleToggleMode} style={styles.toggleBtn}>
              <Typography variant="body2" color={colors.primary} align="center">
                {isLogin ? 'Don\'t have an account? Sign Up' : 'Already have an account? Login'}
              </Typography>
            </TouchableOpacity>
          )}
        </View>
      </ScrollView>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  image:{
    width: '100%',
    height: 300,
    resizeMode:'cover',
    marginTop: 0,
    marginBottom: 25,
  },
  scroll: { 
    flexGrow: 1, 
    justifyContent: 'center',
    paddingBottom: 24,
  },
  header: {
    paddingHorizontal: 4,
    alignItems: 'center',
  },
  title: { marginBottom: 10 },
  desc: { marginBottom: 15 },
  formContainer: {
    paddingHorizontal: 4,
    paddingVertical:10,
    width: '100%',
  },
  inputGroup: {
    width: '100%',
    height: 45,
    borderRadius: 16,
    borderWidth: 1,
    marginBottom: 14,
    paddingHorizontal: 16,
    justifyContent: 'center',
  },
  input: {
    flex: 1,
    fontSize: 16,
    fontFamily: 'Rubik-Medium',
  },
  btn: { width: '100%', borderRadius: 30, marginTop: 0 },
  toggleBtn: {
    marginTop: 10,
    padding: 10,
  },
});