import React, { useState, useEffect } from 'react';
import { View } from 'react-native';
import { Typography } from './Typography';

export const AnimatedSearchPlaceholder = ({ phrases, show, colors }: { phrases: string[], show: boolean, colors: any }) => {
  const [animatedText, setAnimatedText] = useState('');
  const [showCursor, setShowCursor] = useState(true);

  useEffect(() => {
    if (!show) return;
    const cursorInterval = setInterval(() => setShowCursor(prev => !prev), 500);
    return () => clearInterval(cursorInterval);
  }, [show]);

  useEffect(() => {
    if (!show) return;
    let currentPhraseIndex = 0;
    let currentCharIndex = 0;
    let isDeleting = false;
    let timer: NodeJS.Timeout;

    const type = () => {
      const currentPhrase = phrases[currentPhraseIndex] || '';

      if (isDeleting) {
        setAnimatedText(currentPhrase.substring(0, currentCharIndex - 1));
        currentCharIndex--;
      } else {
        setAnimatedText(currentPhrase.substring(0, currentCharIndex + 1));
        currentCharIndex++;
      }

      let typingSpeed = isDeleting ? 5 : 15; // Ultra fast speeds

      if (!isDeleting && currentCharIndex === currentPhrase.length) {
        typingSpeed = 800; // Pause at end
        isDeleting = true;
      } else if (isDeleting && currentCharIndex === 0) {
        isDeleting = false;
        currentPhraseIndex = (currentPhraseIndex + 1) % phrases.length;
        typingSpeed = 150; // Pause before next word
      }

      timer = setTimeout(type, typingSpeed);
    };

    timer = setTimeout(type, 150);
    return () => clearTimeout(timer);
  }, [phrases, show]);

  if (!show) return null;

  return (
    <View style={{ position: 'absolute', left: 48, right: 16, height: '100%', justifyContent: 'center' }} pointerEvents="none">
      <Typography variant="body2" color={colors.black3}>
        {animatedText}{showCursor ? '|' : ''}
      </Typography>
    </View>
  );
};
