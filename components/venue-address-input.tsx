import React from 'react';
import { StyleSheet, View } from 'react-native';
import { GooglePlacesAutocomplete } from 'react-native-google-places-autocomplete';
import { GOOGLE_PLACES_API_KEY } from '@/constants/google-maps';
import { useThemeColor } from '@/hooks/use-theme-color';

interface VenueAddressInputProps {
  value: string;
  onPlaceSelect: (name: string, address: string) => void;
  placeholder?: string;
}

export function VenueAddressInput({ value, onPlaceSelect, placeholder = 'Search for venue address' }: VenueAddressInputProps) {
  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = '#e0e0e0'; // Light gray border

  return (
    <View style={styles.container}>
      <GooglePlacesAutocomplete
        placeholder={placeholder}
        onPress={(data, details = null) => {
          // Extract venue name and formatted address from Google Places
          const name = data.structured_formatting?.main_text || data.description?.split(',')[0] || '';
          const address = details?.formatted_address || data.description || '';
          console.log('[VenueAddressInput] Selected place:', { name, address, details });
          onPlaceSelect(name.trim(), address.trim());
        }}
        query={{
          key: GOOGLE_PLACES_API_KEY,
          language: 'en',
          components: 'country:au', // Restrict to Australia
          types: 'establishment', // Only show businesses/places, not addresses
        }}
        nearbyPlacesAPI="GooglePlacesSearch"
        GooglePlacesSearchQuery={{
          rankby: 'distance',
        }}
        textInputProps={{
          placeholderTextColor: '#999',
        }}
        styles={{
          container: {
            flex: 0,
          },
          textInput: {
            backgroundColor: backgroundColor,
            borderWidth: 1,
            borderColor: borderColor,
            borderRadius: 8,
            paddingHorizontal: 16,
            paddingVertical: 12,
            fontSize: 16,
            color: textColor,
            height: 48,
          },
          listView: {
            backgroundColor: backgroundColor,
            borderWidth: 1,
            borderColor: borderColor,
            borderRadius: 8,
            marginTop: 4,
          },
          row: {
            backgroundColor: backgroundColor,
            padding: 13,
            height: 44,
            flexDirection: 'row',
          },
          separator: {
            height: 0.5,
            backgroundColor: borderColor,
          },
          description: {
            color: textColor,
          },
        }}
        enablePoweredByContainer={false}
        fetchDetails={true}
        debounce={800}
        minLength={3}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1,
  },
});
