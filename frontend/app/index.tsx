import React, { useEffect, useState } from 'react';
import { View, Image,Text, StyleSheet, Animated } from 'react-native';
import { Redirect, useRouter } from 'expo-router';
import { useApp } from '../src/contexts/AppContext';
import { images } from '../src/constants';


export default function Index() {
  const { isLoggedIn, theme,colors } = useApp();
  const [isReady, setIsReady] = useState(false);
  const fadeAnim = new Animated.Value(0);
  const router = useRouter();

  useEffect(() => {
    Animated.timing(fadeAnim, {
      toValue: 1,
      duration: 1000,
      useNativeDriver: true,
    }).start(() => {
      setTimeout(() => {
        setIsReady(true);
      }, 1000);
    });
  }, []);

  if (!isReady) {
    return (
      <View style={[styles.container, { backgroundColor: theme === 'dark' ? '#0F0F23' : '#FFFFFF' }]}>
        <Animated.Image
          source={images.splash}
          style={[styles.image, { opacity: fadeAnim }]}
          resizeMode="cover"
        />
        <Text style={{color: colors.primary}}>SkillMatch</Text>
      </View>
    );
  }

  if (isLoggedIn) {
    return <Redirect href="/(tabs)/home" />;
  } else {
    return <Redirect href="/(auth)/welcome" />;
  }
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    alignItems: 'center',
    justifyContent: 'center',
  },
  image: {
    position: 'absolute',
    width: '100%',
    height: '100%',
  },
  icon: {
    width: 200,
    height: 200,
  },
});
