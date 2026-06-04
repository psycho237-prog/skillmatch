import React, { useState } from 'react';
import { View, StyleSheet, Image, ScrollView } from 'react-native';
import { useRouter } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import * as WebBrowser from 'expo-web-browser';
import * as Google from 'expo-auth-session/providers/google';
import { makeRedirectUri } from 'expo-auth-session';
import { useApp } from '../../src/contexts/AppContext';
import { Typography } from '../../src/components/Typography';
import { Button } from '../../src/components/Button';
import { icons, images } from '../../src/constants';
import ENV from '../../src/config/env';
import { api } from '../../src/services/api';

WebBrowser.maybeCompleteAuthSession();

export default function Welcome() {
  const router = useRouter();
  const { t, setUser, colors } = useApp();
  const [loading, setLoading] = useState(false);

  const redirectUri = makeRedirectUri({
    scheme: 'com.xyberbridge.skillmatch',
    path: 'auth/callback',
  });

  const [request, response, promptAsync] = Google.useAuthRequest({
    webClientId: ENV.GOOGLE_WEB_CLIENT_ID,
    androidClientId: ENV.GOOGLE_ANDROID_CLIENT_ID,
    iosClientId: ENV.GOOGLE_IOS_CLIENT_ID,
    redirectUri,
  });

  React.useEffect(() => {
    if (response?.type === 'success') {
      const { authentication } = response;
      handleGoogleLogin(authentication?.accessToken);
    }
  }, [response]);

  const handleGoogleLogin = async (accessToken: string | undefined) => {
    if (!accessToken) return;
    try {
      setLoading(true);
      const userInfoResponse = await fetch('https://www.googleapis.com/userinfo/v2/me', {
        headers: { Authorization: `Bearer ${accessToken}` },
      });
      const userInfo = await userInfoResponse.json();

      const res = await api.loginWithGoogle({
        user_info: userInfo,
        id_token: null,
      });

      await setUser(res.user);
      router.replace('/(tabs)/home');
    } catch (error) {
      console.error('Login error', error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <StatusBar style="dark" />
      <ScrollView contentContainerStyle={styles.scroll}>
        <View style={styles.imageGrid}>
          <Image source={images.onboarding} style={styles.onboardingImage} resizeMode="contain" />
        </View>

        <View style={[styles.content, { backgroundColor: colors.background }]}>
          <Typography variant="caption" weight="medium" color={colors.black3} style={styles.subtitle}>
            {t('welcome_to')}
          </Typography>

          <Typography variant="h1" align="center" style={styles.title}>
            {t('welcome_title')}
            <Typography variant="h1" color={colors.primary}>
              {t('welcome_highlight')}
            </Typography>
          </Typography>

          <Typography variant="body2" color={colors.black2} align="center" style={styles.desc}>
            {t('welcome_subtitle')}
          </Typography>

          <Button
            title={t('sign_up_google')}
            onPress={() => promptAsync()}
            loading={loading}
            leftIcon={icons.google}
            fullWidth
            style={[styles.btn, { backgroundColor: colors.card, borderWidth: 1, borderColor: colors.border }]}
            variant="outline"
          />
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1 },
  scroll: { flexGrow: 1 },
  imageGrid: {
    width: '100%',
    height: 480,
    alignItems: 'center',
    justifyContent: 'center',
    marginTop: 40,
  },
  onboardingImage: { width: '90%', height: '100%' },
  content: {
    padding: 24,
    alignItems: 'center',
    borderTopLeftRadius: 30,
    borderTopRightRadius: 30,
    marginTop: -30,
    flex: 1,
  },
  subtitle: { marginTop: 10, marginBottom: 20, letterSpacing: 1.5 },
  title: { marginBottom: 20 },
  desc: { marginBottom: 40 },
  btn: { width: '100%', borderRadius: 30 },
});