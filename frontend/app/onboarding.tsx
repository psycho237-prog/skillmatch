import React, { useRef, useState } from 'react';
import { View, StyleSheet, Dimensions, ScrollView, Animated, Image, TouchableOpacity } from 'react-native';
import { useRouter } from 'expo-router';
import { useApp } from '../src/contexts/AppContext';
import { Typography } from '../src/components/Typography';
import { Button } from '../src/components/Button';
import { icons, images } from '../src/constants';

const { width, height } = Dimensions.get('window');

const SLIDES = [
  {
    id: '1',
    title: 'Find The Best Talents',
    description: 'Connect with skilled professionals in your area for any job you need done.',
    icon: icons.search,
  },
  {
    id: '2',
    title: 'Pay with Cash or Skills',
    description: 'No money? No problem. Swap your own skills as payment, or just pay securely with cash.',
    icon: icons.wallet,
  },
  {
    id: '3',
    title: 'Secure & Reliable',
    description: 'Every transaction is protected by our PawaPay Escrow system. You only pay when satisfied.',
    icon: icons.shield,
  }
];

export default function OnboardingScreen() {
  const { colors, setHasSeenOnboarding, t } = useApp();
  const router = useRouter();
  const scrollX = useRef(new Animated.Value(0)).current;
  const scrollViewRef = useRef<ScrollView>(null);
  const [currentIndex, setCurrentIndex] = useState(0);

  const handleScroll = Animated.event(
    [{ nativeEvent: { contentOffset: { x: scrollX } } }],
    { 
      useNativeDriver: false,
      listener: (event: any) => {
        const x = event.nativeEvent.contentOffset.x;
        setCurrentIndex(Math.round(x / width));
      }
    }
  );

  const handleNext = () => {
    if (currentIndex < SLIDES.length - 1) {
      scrollViewRef.current?.scrollTo({ x: (currentIndex + 1) * width, animated: true });
    } else {
      handleFinish();
    }
  };

  const handleFinish = async () => {
    await setHasSeenOnboarding(true);
    router.replace('/(auth)/welcome');
  };

  return (
    <View style={[styles.container, { backgroundColor: colors.background }]}>
      <View style={styles.topBar}>
        <TouchableOpacity onPress={handleFinish}>
          <Typography variant="body2" color={colors.black3} weight="bold">Skip</Typography>
        </TouchableOpacity>
      </View>

      <ScrollView
        ref={scrollViewRef}
        horizontal
        pagingEnabled
        showsHorizontalScrollIndicator={false}
        onScroll={handleScroll}
        scrollEventThrottle={16}
      >
        {SLIDES.map((slide, index) => {
          return (
            <View style={[styles.slide, { width }]} key={slide.id}>
              <View style={[styles.iconContainer, { backgroundColor: colors.card, borderColor: colors.border }]}>
                <Image source={slide.icon} style={[styles.icon, { tintColor: colors.primary }]} />
              </View>
              <Typography variant="h3" color={colors.black1} style={styles.title} align="center">
                {slide.title}
              </Typography>
              <Typography variant="body1" color={colors.black2} style={styles.description} align="center">
                {slide.description}
              </Typography>
            </View>
          );
        })}
      </ScrollView>

      <View style={styles.footer}>
        <View style={styles.dotsContainer}>
          {SLIDES.map((_, i) => {
            const inputRange = [(i - 1) * width, i * width, (i + 1) * width];
            const dotWidth = scrollX.interpolate({
              inputRange,
              outputRange: [8, 24, 8],
              extrapolate: 'clamp',
            });
            const opacity = scrollX.interpolate({
              inputRange,
              outputRange: [0.3, 1, 0.3],
              extrapolate: 'clamp',
            });
            return (
              <Animated.View
                key={i}
                style={[
                  styles.dot,
                  { width: dotWidth, opacity, backgroundColor: colors.primary }
                ]}
              />
            );
          })}
        </View>

        <Button 
          title={currentIndex === SLIDES.length - 1 ? "Get Started" : "Next"} 
          onPress={handleNext} 
          style={styles.button}
        />
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  topBar: {
    paddingTop: 60,
    paddingHorizontal: 24,
    alignItems: 'flex-end',
  },
  slide: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
    paddingHorizontal: 32,
  },
  iconContainer: {
    width: 160,
    height: 160,
    borderRadius: 80,
    justifyContent: 'center',
    alignItems: 'center',
    marginBottom: 40,
    borderWidth: 1,
    shadowColor: '#000',
    shadowOffset: { width: 0, height: 10 },
    shadowOpacity: 0.05,
    shadowRadius: 20,
    elevation: 5,
  },
  icon: {
    width: 80,
    height: 80,
  },
  title: {
    marginBottom: 16,
  },
  description: {
    lineHeight: 24,
  },
  footer: {
    paddingHorizontal: 24,
    paddingBottom: 40,
    paddingTop: 20,
  },
  dotsContainer: {
    flexDirection: 'row',
    justifyContent: 'center',
    marginBottom: 32,
  },
  dot: {
    height: 8,
    borderRadius: 4,
    marginHorizontal: 4,
  },
  button: {
    width: '100%',
  },
});
