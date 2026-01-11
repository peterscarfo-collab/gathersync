import { View, StyleSheet, Pressable, Platform, Image } from 'react-native';
import { useRouter, usePathname } from 'expo-router';
import { ThemedText } from './themed-text';
import { ThemedView } from './themed-view';
import { IconSymbol } from './ui/icon-symbol';
import { useThemeColor } from '@/hooks/use-theme-color';
import * as Haptics from 'expo-haptics';

interface DesktopLayoutProps {
  children: React.ReactNode;
}

export function DesktopLayout({ children }: DesktopLayoutProps) {
  const router = useRouter();
  const pathname = usePathname();
  const tintColor = useThemeColor({}, 'tint');
  const backgroundColor = useThemeColor({}, 'background');
  const surfaceColor = useThemeColor({}, 'surface');
  const textColor = useThemeColor({}, 'text');
  const textSecondaryColor = useThemeColor({}, 'textSecondary');

  // Only show sidebar on web
  if (Platform.OS !== 'web') {
    return <>{children}</>;
  }

  const menuItems = [
    { id: 'events', label: 'Events', icon: 'calendar' as const, path: '/' },
    { id: 'admin', label: 'Admin', icon: 'gearshape.fill' as const, path: '/admin' },
    { id: 'saves', label: 'Saves', icon: 'bookmark.fill' as const, path: '/saves' },
    { id: 'profile', label: 'Profile', icon: 'person.fill' as const, path: '/profile' },
  ];

  const handleNavigation = (path: string) => {
    if (Platform.OS !== 'web') {
      Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
    }
    router.push(path as any);
  };

  return (
    <View style={styles.container}>
      {/* Left Sidebar */}
      <View style={[styles.sidebar, { backgroundColor: surfaceColor }]}>
        {/* Logo/Branding */}
        <View style={styles.logoContainer}>
          <Image
            source={require('@/assets/images/icon.png')}
            style={styles.logoIcon}
          />
          <ThemedText type="subtitle" style={styles.logoText}>
            GatherSync
          </ThemedText>
        </View>

        {/* Navigation Menu */}
        <View style={styles.menu}>
          {menuItems.map((item) => {
            const isActive = pathname === item.path || (item.path === '/' && pathname === '/');
            return (
              <Pressable
                key={item.id}
                style={[
                  styles.menuItem,
                  isActive && { backgroundColor: tintColor + '15' },
                ]}
                onPress={() => handleNavigation(item.path)}
              >
                <IconSymbol
                  name={item.icon}
                  size={20}
                  color={isActive ? tintColor : textSecondaryColor}
                />
                <ThemedText
                  style={[
                    styles.menuItemText,
                    { color: isActive ? tintColor : textColor },
                  ]}
                >
                  {item.label}
                </ThemedText>
              </Pressable>
            );
          })}
        </View>

        {/* Copyright Footer */}
        <View style={styles.sidebarFooter}>
          <ThemedText style={[styles.copyrightText, { color: textSecondaryColor }]}>
            © 2025 Peter Scarfo
          </ThemedText>
        </View>
      </View>

      {/* Main Content */}
      <View style={styles.content}>{children}</View>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    flexDirection: 'row',
  },
  sidebar: {
    width: 240,
    borderRightWidth: 1,
    borderRightColor: '#E5E5E5',
    paddingTop: 20,
    paddingBottom: 20,
  },
  logoContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingHorizontal: 20,
    marginBottom: 32,
  },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 8,
    marginRight: 12,
  },
  logoText: {
    fontSize: 18,
  },
  menu: {
    flex: 1,
    paddingHorizontal: 12,
  },
  menuItem: {
    flexDirection: 'row',
    alignItems: 'center',
    paddingVertical: 12,
    paddingHorizontal: 16,
    borderRadius: 8,
    marginBottom: 4,
  },
  menuItemText: {
    fontSize: 15,
    fontWeight: '500',
    marginLeft: 12,
  },
  sidebarFooter: {
    paddingHorizontal: 20,
    paddingTop: 20,
    borderTopWidth: 1,
    borderTopColor: '#E5E5E5',
  },
  copyrightText: {
    fontSize: 11,
    lineHeight: 16,
  },
  content: {
    flex: 1,
  },
});
