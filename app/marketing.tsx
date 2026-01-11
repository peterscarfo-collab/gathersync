import { useEffect } from 'react';
import { Platform } from 'react-native';
import { useRouter } from 'expo-router';

/**
 * Marketing landing page route
 * On web: Redirects to static marketing site (index.html in public folder)
 * On mobile: Redirects to main app
 */
export default function MarketingPage() {
  const router = useRouter();

  useEffect(() => {
    if (Platform.OS === 'web') {
      // Redirect to static marketing site
      window.location.href = '/index.html';
    } else {
      // On mobile, go to main app
      router.replace('/(tabs)');
    }
  }, []);

  return null;
}
