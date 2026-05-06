import { useState, useEffect } from 'react';
import {
  StyleSheet,
  ScrollView,
  View,
  Pressable,
  TextInput,
  Platform,
  Alert,
  ActivityIndicator,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { AdminColors, AdminTypography, AdminSpacing, AdminBorderRadius, AdminShadows } from '@/constants/admin-theme';
import { trpc } from '@/lib/trpc';
import { useAuth } from '@/hooks/use-auth';
import { DesktopLayout } from '@/components/desktop-layout';

export default function AdminUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const params = useLocalSearchParams<{ search?: string }>();
  
  const [searchQuery, setSearchQuery] = useState(params.search || '');
  const [debouncedQuery, setDebouncedQuery] = useState('');

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => setDebouncedQuery(searchQuery), 300);
    return () => clearTimeout(timer);
  }, [searchQuery]);

  const { data: users, isLoading, refetch } = trpc.admin.searchUsers.useQuery(
    { query: debouncedQuery }
  );

  const grantLifetimePro = trpc.admin.grantLifetimePro.useMutation({
    onSuccess: () => {
      refetch();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    }
  });

  const revokeLifetimePro = trpc.admin.revokeLifetimePro.useMutation({
    onSuccess: () => {
      refetch();
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      }
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    }
  });

  const handleGrantPro = (userId: number, name: string) => {
    const message = `Grant Lifetime Pro access to ${name}?`;
    
    if (Platform.OS === 'web') {
      if (confirm(message)) {
        grantLifetimePro.mutate({ userId });
      }
    } else {
      Alert.alert(
        'Confirm Grant Pro',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Grant Pro', style: 'default', onPress: () => grantLifetimePro.mutate({ userId }) },
        ]
      );
    }
  };

  const handleRevokePro = (userId: number, name: string) => {
    const message = `Revoke Lifetime Pro access from ${name}?`;
    
    if (Platform.OS === 'web') {
      if (confirm(message)) {
        revokeLifetimePro.mutate({ userId });
      }
    } else {
      Alert.alert(
        'Confirm Revoke Pro',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Revoke Pro', style: 'destructive', onPress: () => revokeLifetimePro.mutate({ userId }) },
        ]
      );
    }
  };

  return (
    <DesktopLayout>
    <ThemedView style={styles.container}>
      {/* Header */}
      <View style={[styles.header, { paddingTop: Math.max(insets.top, 40) + AdminSpacing.xl }]}>
        <View style={styles.headerTop}>
          <Pressable
            onPress={() => router.back()}
            style={styles.backButton}
          >
            <IconSymbol name="chevron.left" size={20} color={AdminColors.gray600} />
            <ThemedText style={styles.backText}>Back</ThemedText>
          </Pressable>
        </View>
        <ThemedText style={styles.pageTitle}>User Management</ThemedText>
        <ThemedText style={styles.pageSubtitle}>
          {users?.length || 0} {users?.length === 1 ? 'user' : 'users'} found
        </ThemedText>
      </View>

      {/* Controls */}
      <View style={styles.controls}>
        <View style={styles.searchContainer}>
          <IconSymbol name="magnifyingglass" size={20} color={AdminColors.gray400} />
          <TextInput
            style={styles.searchInput}
            placeholder="Search users by name or email..."
            placeholderTextColor={AdminColors.gray400}
            value={searchQuery}
            onChangeText={setSearchQuery}
          />
        </View>
      </View>

      {/* User List */}
      <ScrollView style={styles.userList} contentContainerStyle={{ paddingBottom: insets.bottom + 40 }}>
        {isLoading ? (
          <View style={styles.loadingState}>
            <ActivityIndicator size="large" color={AdminColors.primary} />
          </View>
        ) : !users || users.length === 0 ? (
          <View style={styles.emptyState}>
            <IconSymbol name="person.3.fill" size={48} color={AdminColors.gray300} />
            <ThemedText style={styles.emptyText}>No users found</ThemedText>
            <ThemedText style={styles.emptySubtext}>
              {searchQuery ? 'Try adjusting your search' : 'No users match your criteria'}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.userGrid}>
            {users.map(user => {
              const isPro = user.subscriptionTier === 'pro' || user.isLifetimePro;
              const isEnterprise = user.subscriptionTier === 'enterprise';
              const isFree = !isPro && !isEnterprise;
              
              return (
                <View key={user.id} style={styles.userCard}>
                  <View style={styles.userCardContent}>
                    <View style={styles.userCardHeader}>
                      <View>
                        <ThemedText style={styles.userName}>{user.name}</ThemedText>
                        <ThemedText style={styles.userEmail}>{user.email}</ThemedText>
                      </View>
                      <View style={[
                        styles.roleBadge,
                        user.role === 'admin' ? styles.roleBadgeAdmin : styles.roleBadgeUser
                      ]}>
                        <ThemedText style={[
                          styles.roleBadgeText,
                          user.role === 'admin' ? styles.roleBadgeTextAdmin : styles.roleBadgeTextUser
                        ]}>
                          {user.role}
                        </ThemedText>
                      </View>
                    </View>
                    
                    <View style={styles.tierContainer}>
                      <View style={[
                        styles.tierBadge,
                        isFree ? styles.tierBadgeFree : 
                        isEnterprise ? styles.tierBadgeEnterprise : 
                        styles.tierBadgePro
                      ]}>
                        <IconSymbol 
                          name={isPro ? "star.fill" : "person.fill"} 
                          size={14} 
                          color={isFree ? AdminColors.gray600 : isEnterprise ? '#6366f1' : AdminColors.warning} 
                        />
                        <ThemedText style={[
                          styles.tierBadgeText,
                          isFree ? styles.tierBadgeTextFree : 
                          isEnterprise ? styles.tierBadgeTextEnterprise : 
                          styles.tierBadgeTextPro
                        ]}>
                          {user.isLifetimePro ? 'Lifetime Pro' : 
                           user.subscriptionTier === 'pro' ? 'Pro' : 
                           user.subscriptionTier === 'enterprise' ? 'Enterprise' : 'Free'}
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={styles.userActions}>
                    {user.id !== currentUser?.id && (
                      <>
                        {!user.isLifetimePro ? (
                          <Pressable
                            style={styles.actionButtonPrimary}
                            onPress={() => handleGrantPro(user.id, user.name || 'User')}
                            disabled={grantLifetimePro.isPending}
                          >
                            <IconSymbol name="star.fill" size={16} color="#fff" />
                            <ThemedText style={styles.actionButtonText}>Grant Lifetime Pro</ThemedText>
                          </Pressable>
                        ) : (
                          <Pressable
                            style={styles.actionButtonDanger}
                            onPress={() => handleRevokePro(user.id, user.name || 'User')}
                            disabled={revokeLifetimePro.isPending}
                          >
                            <IconSymbol name="xmark.circle.fill" size={16} color="#fff" />
                            <ThemedText style={styles.actionButtonText}>Revoke Pro</ThemedText>
                          </Pressable>
                        )}
                      </>
                    )}
                  </View>
                </View>
              );
            })}
          </View>
        )}
      </ScrollView>
    </ThemedView>
    </DesktopLayout>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AdminColors.gray50,
  },
  
  // Header
  header: {
    paddingHorizontal: AdminSpacing['4xl'],
    paddingBottom: AdminSpacing.xl,
    backgroundColor: AdminColors.surface,
    borderBottomWidth: 1,
    borderBottomColor: AdminColors.border,
  },
  headerTop: {
    marginBottom: AdminSpacing.base,
  },
  backButton: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.xs,
    alignSelf: 'flex-start',
    ...Platform.select({
      web: {
        cursor: 'pointer',
      },
    }),
  },
  backText: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray600,
    fontWeight: '500' as any,
  },
  pageTitle: {
    fontSize: AdminTypography['4xl'],
    fontWeight: '700' as any,
    color: AdminColors.gray900,
    marginBottom: AdminSpacing.xs,
  },
  pageSubtitle: {
    fontSize: AdminTypography.base,
    color: AdminColors.gray600,
  },
  
  // Controls
  controls: {
    paddingHorizontal: AdminSpacing['4xl'],
    paddingVertical: AdminSpacing.xl,
    gap: AdminSpacing.base,
    backgroundColor: AdminColors.surface,
  },
  searchContainer: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.sm,
    paddingHorizontal: AdminSpacing.base,
    paddingVertical: AdminSpacing.sm,
    backgroundColor: AdminColors.gray50,
    borderRadius: AdminBorderRadius.base,
    borderWidth: 1,
    borderColor: AdminColors.border,
  },
  searchInput: {
    flex: 1,
    fontSize: AdminTypography.base,
    color: AdminColors.gray900,
    ...Platform.select({
      web: {
        outlineStyle: 'none' as any,
      },
    }),
  },
  
  // List
  userList: {
    flex: 1,
    paddingHorizontal: AdminSpacing['4xl'],
    paddingTop: AdminSpacing.xl,
  },
  userGrid: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: AdminSpacing.xl,
  },
  userCard: {
    flex: 1,
    minWidth: 320,
    maxWidth: 400,
    backgroundColor: AdminColors.surface,
    borderRadius: AdminBorderRadius.lg,
    borderWidth: 1,
    borderColor: AdminColors.border,
    overflow: 'hidden',
    ...Platform.select({
      web: {
        boxShadow: AdminShadows.sm,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 1 },
        shadowOpacity: 0.05,
        shadowRadius: 2,
        elevation: 1,
      },
    }),
  },
  userCardContent: {
    padding: AdminSpacing.xl,
  },
  userCardHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: AdminSpacing.base,
  },
  userName: {
    fontSize: AdminTypography.lg,
    fontWeight: '600' as any,
    color: AdminColors.gray900,
    marginBottom: 4,
  },
  userEmail: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray500,
  },
  roleBadge: {
    paddingHorizontal: 8,
    paddingVertical: 4,
    borderRadius: AdminBorderRadius.full,
  },
  roleBadgeAdmin: {
    backgroundColor: '#fef3c7',
    borderWidth: 1,
    borderColor: '#fca5a5',
  },
  roleBadgeUser: {
    backgroundColor: AdminColors.gray100,
  },
  roleBadgeText: {
    fontSize: 12,
    fontWeight: '600' as any,
    textTransform: 'uppercase',
  },
  roleBadgeTextAdmin: {
    color: '#b91c1c',
  },
  roleBadgeTextUser: {
    color: AdminColors.gray600,
  },
  tierContainer: {
    flexDirection: 'row',
  },
  tierBadge: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: 6,
    paddingHorizontal: 10,
    paddingVertical: 4,
    borderRadius: AdminBorderRadius.full,
  },
  tierBadgeFree: {
    backgroundColor: AdminColors.gray100,
  },
  tierBadgePro: {
    backgroundColor: AdminColors.warningLight,
    borderWidth: 1,
    borderColor: AdminColors.warning,
  },
  tierBadgeEnterprise: {
    backgroundColor: '#e0e7ff',
    borderWidth: 1,
    borderColor: '#6366f1',
  },
  tierBadgeText: {
    fontSize: 13,
    fontWeight: '600' as any,
  },
  tierBadgeTextFree: {
    color: AdminColors.gray700,
  },
  tierBadgeTextPro: {
    color: AdminColors.warning,
  },
  tierBadgeTextEnterprise: {
    color: '#4f46e5',
  },
  userActions: {
    flexDirection: 'row',
    padding: AdminSpacing.base,
    backgroundColor: AdminColors.gray50,
    borderTopWidth: 1,
    borderTopColor: AdminColors.border,
    justifyContent: 'flex-end',
  },
  actionButtonPrimary: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.xs,
    paddingHorizontal: AdminSpacing.base,
    paddingVertical: AdminSpacing.sm,
    backgroundColor: AdminColors.primary,
    borderRadius: AdminBorderRadius.base,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  actionButtonDanger: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.xs,
    paddingHorizontal: AdminSpacing.base,
    paddingVertical: AdminSpacing.sm,
    backgroundColor: AdminColors.error,
    borderRadius: AdminBorderRadius.base,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  actionButtonText: {
    color: '#fff',
    fontSize: AdminTypography.sm,
    fontWeight: '500' as any,
  },
  
  // Empty/Loading State
  emptyState: {
    paddingVertical: AdminSpacing['6xl'],
    alignItems: 'center',
    gap: AdminSpacing.base,
  },
  emptyText: {
    fontSize: AdminTypography.xl,
    fontWeight: '600' as any,
    color: AdminColors.gray900,
  },
  emptySubtext: {
    fontSize: AdminTypography.base,
    color: AdminColors.gray600,
    textAlign: 'center',
  },
  loadingState: {
    paddingVertical: AdminSpacing['6xl'],
    alignItems: 'center',
    justifyContent: 'center',
  },
});