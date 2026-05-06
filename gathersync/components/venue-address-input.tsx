import React, { useState, useEffect } from 'react';
import { StyleSheet, View, TextInput, FlatList, Pressable, ActivityIndicator } from 'react-native';
import { ThemedText } from '@/components/themed-text';
import { GOOGLE_PLACES_API_KEY } from '@/constants/google-maps';
import { useThemeColor } from '@/hooks/use-theme-color';

interface VenueAddressInputProps {
  value: string;
  onPlaceSelect: (name: string, address: string) => void;
  placeholder?: string;
}

export function VenueAddressInput({ value, onPlaceSelect, placeholder = 'Search for venue address' }: VenueAddressInputProps) {
  const [query, setQuery] = useState(value || '');
  const [results, setResults] = useState<any[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);

  const textColor = useThemeColor({}, 'text');
  const backgroundColor = useThemeColor({}, 'background');
  const borderColor = '#e0e0e0';

  useEffect(() => {
    setQuery(value || '');
  }, [value]);

  useEffect(() => {
    if (query.length < 3 || !showResults) {
      setResults([]);
      return;
    }

    const fetchPlaces = async () => {
      setLoading(true);
      try {
        const response = await fetch(
          `https://maps.googleapis.com/maps/api/place/autocomplete/json?input=${encodeURIComponent(
            query
          )}&key=${GOOGLE_PLACES_API_KEY}&components=country:au&types=establishment`
        );
        const data = await response.json();
        if (data.status === 'OK') {
          setResults(data.predictions);
        } else {
          setResults([]);
        }
      } catch (error) {
        console.error('Error fetching places:', error);
      } finally {
        setLoading(false);
      }
    };

    const timeoutId = setTimeout(fetchPlaces, 800);
    return () => clearTimeout(timeoutId);
  }, [query, showResults]);

  const handleSelect = async (placeId: string, description: string, mainText: string) => {
    setShowResults(false);
    setQuery(mainText);
    
    // Fetch details to get formatted address
    try {
      const response = await fetch(
        `https://maps.googleapis.com/maps/api/place/details/json?place_id=${placeId}&key=${GOOGLE_PLACES_API_KEY}&fields=formatted_address`
      );
      const data = await response.json();
      
      const address = data.result?.formatted_address || description;
      onPlaceSelect(mainText.trim(), address.trim());
    } catch (error) {
      console.error('Error fetching place details:', error);
      onPlaceSelect(mainText.trim(), description.trim());
    }
  };

  return (
    <View style={styles.container}>
      <TextInput
        style={[
          styles.textInput,
          { backgroundColor, borderColor, color: textColor }
        ]}
        value={query}
        onChangeText={(text) => {
          setQuery(text);
          setShowResults(true);
        }}
        placeholder={placeholder}
        placeholderTextColor="#999"
      />
      
      {showResults && (loading || results.length > 0) && (
        <View style={[styles.listView, { backgroundColor, borderColor }]}>
          {loading && results.length === 0 ? (
            <View style={styles.loadingContainer}>
              <ActivityIndicator size="small" />
            </View>
          ) : (
            <FlatList
              data={results}
              keyExtractor={(item) => item.place_id}
              keyboardShouldPersistTaps="handled"
              renderItem={({ item }) => (
                <Pressable
                  style={styles.row}
                  onPress={() => handleSelect(
                    item.place_id, 
                    item.description, 
                    item.structured_formatting?.main_text || item.description.split(',')[0] || ''
                  )}
                >
                  <ThemedText style={styles.description}>{item.description}</ThemedText>
                </Pressable>
              )}
              ItemSeparatorComponent={() => <View style={[styles.separator, { backgroundColor: borderColor }]} />}
            />
          )}
        </View>
      )}
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    zIndex: 1,
  },
  textInput: {
    borderWidth: 1,
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 12,
    fontSize: 16,
    height: 50,
  },
  listView: {
    borderWidth: 1,
    borderRadius: 8,
    marginTop: 4,
    maxHeight: 200,
    position: 'absolute',
    top: 50,
    left: 0,
    right: 0,
    zIndex: 10,
    elevation: 10,
  },
  row: {
    padding: 13,
    justifyContent: 'center',
  },
  separator: {
    height: 0.5,
  },
  description: {
    fontSize: 14,
  },
  loadingContainer: {
    padding: 16,
    alignItems: 'center',
  },
});
