import React, { useEffect, useRef, useState } from 'react';
import {
  View,
  Text,
  StyleSheet,
  Animated,
  Easing,
  Dimensions,
  Image,
} from 'react-native';
import { Redirect } from 'expo-router';
import { useApp } from '../src/contexts/AppContext';

const { width, height } = Dimensions.get('window');

export default function Index() {
  const { isLoggedIn, colors } = useApp();
  const [isReady, setIsReady] = useState(false);

  // Animations
  const logoOpacity = useRef(new Animated.Value(0)).current;
  const logoScale = useRef(new Animated.Value(0.7)).current;
  const subtitleOpacity = useRef(new Animated.Value(0)).current;
  const subtitleY = useRef(new Animated.Value(20)).current;
  const dividerWidth = useRef(new Animated.Value(0)).current;
  const pulse1 = useRef(new Animated.Value(1)).current;
  const pulse2 = useRef(new Animated.Value(1)).current;
  const pulse3 = useRef(new Animated.Value(1)).current;
  const pulseOpacity1 = useRef(new Animated.Value(0.6)).current;
  const pulseOpacity2 = useRef(new Animated.Value(0.4)).current;
  const pulseOpacity3 = useRef(new Animated.Value(0.2)).current;
  const dotAnim1 = useRef(new Animated.Value(0)).current;
  const dotAnim2 = useRef(new Animated.Value(0)).current;
  const dotAnim3 = useRef(new Animated.Value(0)).current;
  const shimmer = useRef(new Animated.Value(0)).current;
  const bgGlow = useRef(new Animated.Value(0)).current;

  const startPulse = (anim: Animated.Value, opacityAnim: Animated.Value, delay: number) => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.parallel([
          Animated.timing(anim, {
            toValue: 2.2,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
          Animated.timing(opacityAnim, {
            toValue: 0,
            duration: 1800,
            easing: Easing.out(Easing.ease),
            useNativeDriver: true,
          }),
        ]),
        Animated.parallel([
          Animated.timing(anim, { toValue: 1, duration: 0, useNativeDriver: true }),
          Animated.timing(opacityAnim, { toValue: delay === 0 ? 0.6 : delay === 300 ? 0.4 : 0.2, duration: 0, useNativeDriver: true }),
        ]),
      ])
    ).start();
  };

  const startDotBounce = (anim: Animated.Value, delay: number) => {
    Animated.loop(
      Animated.sequence([
        Animated.delay(delay),
        Animated.timing(anim, {
          toValue: -10,
          duration: 350,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.timing(anim, {
          toValue: 0,
          duration: 350,
          easing: Easing.in(Easing.quad),
          useNativeDriver: true,
        }),
        Animated.delay(600),
      ])
    ).start();
  };

  useEffect(() => {
    // Background glow pulse
    Animated.loop(
      Animated.sequence([
        Animated.timing(bgGlow, { toValue: 1, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
        Animated.timing(bgGlow, { toValue: 0, duration: 2500, easing: Easing.inOut(Easing.sin), useNativeDriver: true }),
      ])
    ).start();

    // Logo entrance
    Animated.parallel([
      Animated.timing(logoOpacity, {
        toValue: 1,
        duration: 700,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
      }),
      Animated.spring(logoScale, {
        toValue: 1,
        friction: 6,
        tension: 80,
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Shimmer effect
      Animated.loop(
        Animated.sequence([
          Animated.timing(shimmer, { toValue: 1, duration: 1200, useNativeDriver: true }),
          Animated.timing(shimmer, { toValue: 0, duration: 0, useNativeDriver: true }),
          Animated.delay(2000),
        ])
      ).start();

      // Divider expand
      Animated.timing(dividerWidth, {
        toValue: 1,
        duration: 500,
        easing: Easing.out(Easing.cubic),
        useNativeDriver: true,
        delay: 100,
      } as any).start();

      // Subtitle reveal
      Animated.parallel([
        Animated.timing(subtitleOpacity, {
          toValue: 1,
          duration: 600,
          delay: 300,
          useNativeDriver: true,
        }),
        Animated.timing(subtitleY, {
          toValue: 0,
          duration: 600,
          delay: 300,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();

      // Pulse rings
      startPulse(pulse1, pulseOpacity1, 0);
      startPulse(pulse2, pulseOpacity2, 300);
      startPulse(pulse3, pulseOpacity3, 600);

      // Dot bounce
      startDotBounce(dotAnim1, 0);
      startDotBounce(dotAnim2, 200);
      startDotBounce(dotAnim3, 400);

      // Navigate after splash
      setTimeout(() => setIsReady(true), 2800);
    });
  }, []);

  if (!isReady) {
    const glowOpacity = bgGlow.interpolate({ inputRange: [0, 1], outputRange: [0.05, 0.18] });

    return (
      <View style={[styles.container, { backgroundColor: colors.background }]}>
        {/* Ambient glow background */}
        <Animated.View
          style={[
            styles.bgGlow,
            { backgroundColor: colors.primary, opacity: glowOpacity },
          ]}
        />

        {/* Pulse rings */}
        <View style={styles.pulseContainer}>
          {[
            { scale: pulse3, opacity: pulseOpacity3 },
            { scale: pulse2, opacity: pulseOpacity2 },
            { scale: pulse1, opacity: pulseOpacity1 },
          ].map((ring, i) => (
            <Animated.View
              key={i}
              style={[
                styles.pulseRing,
                {
                  borderColor: colors.primary,
                  transform: [{ scale: ring.scale }],
                  opacity: ring.opacity,
                },
              ]}
            />
          ))}

          {/* Center logo block */}
          <Animated.View
            style={[
              styles.logoBlock,
              {
                opacity: logoOpacity,
                transform: [{ scale: logoScale }],
              },
            ]}
          >
            <Image 
              source={require('../assets/images/icon.png')} 
              style={{ width: 120, height: 120, resizeMode: 'contain' }} 
            />
          </Animated.View>
        </View>

        {/* Text section */}
        <Animated.View style={[styles.textSection, { opacity: logoOpacity }]}>
          <Text style={[styles.brandName, { color:  '#FFFFFF' }]}>
            Swapster
          </Text>

          {/* Animated divider */}
          <Animated.View
            style={[
              styles.divider,
              {
                backgroundColor: colors.primary,
                transform: [{ scaleX: dividerWidth }],
              },
            ]}
          />

          <Animated.View
            style={{
              opacity: subtitleOpacity,
              transform: [{ translateY: subtitleY }],
              alignItems: 'center',
            }}
          >
            <Text style={[styles.poweredByLabel, { color: colors.black2 || '#888' }]}>
              POWERED BY
            </Text>
            <Image
              source={require('../assets/images/pawapay.png')}
              style={{ width: 140, height: 40, resizeMode: 'contain', marginTop: 8 }}
            />
          </Animated.View>
        </Animated.View>

        {/* Dot loader */}
        <Animated.View style={[styles.dotsWrapper, { opacity: subtitleOpacity }]}>
          {[dotAnim1, dotAnim2, dotAnim3].map((anim, i) => (
            <Animated.View
              key={i}
              style={[
                styles.dot,
                {
                  backgroundColor: colors.primary,
                  transform: [{ translateY: anim }],
                },
              ]}
            />
          ))}
        </Animated.View>
      </View>
    );
  }

  if (isLoggedIn) {
    return <Redirect href="/(tabs)/home" />;
  } else {
    return <Redirect href="/(auth)/welcome" />;
  }
}

const RING_SIZE = 160;

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  bgGlow: {
    position: 'absolute',
    width: width * 1.5,
    height: width * 1.5,
    borderRadius: width,
    top: height * 0.1,
    alignSelf: 'center',
  },
  pulseContainer: {
    width: RING_SIZE,
    height: RING_SIZE,
    alignItems: 'center',
    justifyContent: 'center',
    marginBottom: 36,
  },
  pulseRing: {
    position: 'absolute',
    width: RING_SIZE,
    height: RING_SIZE,
    borderRadius: RING_SIZE / 2,
    borderWidth: 1.5,
  },
  logoBlock: {
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoCircle: {
    width: 80,
    height: 80,
    borderRadius: 40,
    borderWidth: 2,
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoLetter: {
    fontSize: 40,
    fontFamily: 'Rubik-Bold',
    lineHeight: 46,
  },
  textSection: {
    alignItems: 'center',
  },
  brandName: {
    fontSize: 52,
    fontFamily: 'Rubik-Bold',
    letterSpacing: 2,
    marginBottom: 12,
  },
  divider: {
    width: 60,
    height: 2.5,
    borderRadius: 2,
    marginBottom: 14,
  },
  poweredByLabel: {
    fontSize: 10,
    fontFamily: 'Rubik-Medium',
    letterSpacing: 4,
    marginBottom: 4,
  },
  poweredByBrand: {
    fontSize: 20,
    fontFamily: 'Rubik-Bold',
    letterSpacing: 1.5,
  },
  dotsWrapper: {
    flexDirection: 'row',
    gap: 10,
    marginTop: 52,
  },
  dot: {
    width: 8,
    height: 8,
    borderRadius: 4,
  },
});
