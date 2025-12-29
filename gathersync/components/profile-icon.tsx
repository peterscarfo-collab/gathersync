import { Pressable, StyleSheet, View } from 'react-native';
import { useRouter } from 'expo-router';
import * as Haptics from 'expo-haptics';

import { ThemedText } from './themed-text';
import { useThemeColor } from '@/hooks/use-theme-color';
import { useAuth } from '@/hooks/use-auth';

export function ProfileIcon() {
  const router = useRouter();
  const { user, isAuthenticated } = useAuth();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const textColor = useThemeColor({}, 'text');

  const handlePress = () => {
    Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    router.push('/profile' as any);
  };

  // Get user initials or first letter of name
  const getInitials = () => {
    if (!user) return 'L';
    
    if (user.name) {
      const parts = user.name.trim().split(' ');
      if (parts.length >= 2) {
        return `${parts[0][0]}${parts[1][0]}`.toUpperCase();
      }
      return user.name[0].toUpperCase();
    }
    
    if (user.email) {
      return user.email[0].toUpperCase();
    }
    
    return 'U';
  };

  return (
    <Pressable onPress={handlePress} style={styles.container}>
      <View
        style={[
          styles.circle,
          {
            backgroundColor: isAuthenticated ? tintColor : backgroundColor,
            borderColor: isAuthenticated ? tintColor : textColor,
            borderWidth: isAuthenticated ? 0 : 1,
          },
        ]}
      >
        <ThemedText
          style={[
            styles.text,
            {
              color: isAuthenticated ? '#fff' : textColor,
              fontSize: isAuthenticated ? 14 : 12,
            },
          ]}
        >
          {isAuthenticated ? getInitials() : 'Login'}
        </ThemedText>
      </View>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  container: {
    padding: 8,
  },
  circle: {
    width: 36,
    height: 36,
    borderRadius: 18,
    justifyContent: 'center',
    alignItems: 'center',
  },
  text: {
    fontWeight: '600',
  },
});
