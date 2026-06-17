import React, { useState } from 'react';
import { View, StyleSheet, TouchableOpacity, Modal, FlatList, TextInput, Pressable } from 'react-native';
import { Typography } from './Typography';
import { useApp } from '../contexts/AppContext';

export const COUNTRIES = [
  { code: '237', name: 'Cameroon', flag: '🇨🇲' },
  { code: '33', name: 'France', flag: '🇫🇷' },
  { code: '225', name: 'Ivory Coast', flag: '🇨🇮' },
  { code: '221', name: 'Senegal', flag: '🇸🇳' },
  { code: '234', name: 'Nigeria', flag: '🇳🇬' },
  { code: '254', name: 'Kenya', flag: '🇰🇪' },
  { code: '233', name: 'Ghana', flag: '🇬🇭' },
  { code: '256', name: 'Uganda', flag: '🇺🇬' },
  { code: '250', name: 'Rwanda', flag: '🇷🇼' },
  { code: '243', name: 'DRC', flag: '🇨🇩' },
  { code: '260', name: 'Zambia', flag: '🇿🇲' },
  { code: '255', name: 'Tanzania', flag: '🇹🇿' },
];

interface CountryPickerProps {
  selectedCode: string;
  onSelectCode: (code: string) => void;
}

export function CountryPicker({ selectedCode, onSelectCode }: CountryPickerProps) {
  const [modalVisible, setModalVisible] = useState(false);
  const { colors } = useApp();

  const selectedCountry = COUNTRIES.find(c => c.code === selectedCode) || COUNTRIES[0];

  return (
    <>
      <TouchableOpacity 
        style={[styles.selector, { borderColor: colors.border, backgroundColor: colors.card }]} 
        onPress={() => setModalVisible(true)}
      >
        <Typography variant="body1" color={colors.black1}>
          {selectedCountry.flag} +{selectedCountry.code}
        </Typography>
      </TouchableOpacity>

      <Modal visible={modalVisible} transparent animationType="slide" onRequestClose={() => setModalVisible(false)}>
        <Pressable style={styles.modalOverlay} onPress={() => setModalVisible(false)}>
          <View style={[styles.modalContent, { backgroundColor: colors.background }]}>
            <Typography variant="h5" style={styles.modalTitle}>Select Country Code</Typography>
            <FlatList
              data={COUNTRIES}
              keyExtractor={item => item.code}
              renderItem={({ item }) => (
                <TouchableOpacity 
                  style={[styles.countryItem, { borderBottomColor: colors.border }]} 
                  onPress={() => {
                    onSelectCode(item.code);
                    setModalVisible(false);
                  }}
                >
                  <Typography variant="h6" color={colors.black1}>{item.flag} {item.name}</Typography>
                  <Typography variant="body1" color={colors.primary}>+{item.code}</Typography>
                </TouchableOpacity>
              )}
            />
          </View>
        </Pressable>
      </Modal>
    </>
  );
}

const styles = StyleSheet.create({
  selector: {
    height: 45,
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 10,
    justifyContent: 'center',
    alignItems: 'center',
    marginRight: 8,
  },
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0,0,0,0.5)',
    justifyContent: 'flex-end',
  },
  modalContent: {
    borderTopLeftRadius: 24,
    borderTopRightRadius: 24,
    padding: 24,
    maxHeight: '60%',
  },
  modalTitle: {
    marginBottom: 16,
    textAlign: 'center',
  },
  countryItem: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    paddingVertical: 16,
    borderBottomWidth: 1,
  }
});
