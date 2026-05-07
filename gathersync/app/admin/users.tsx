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
  Modal,
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

type FilterTier = 'all' | 'free' | 'lite' | 'pro' | 'enterprise';

export default function AdminUsersScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { user: currentUser } = useAuth();
  const params = useLocalSearchParams<{ search?: string }>();
  
  const [searchQuery, setSearchQuery] = useState(params.search || '');
  const [debouncedQuery, setDebouncedQuery] = useState('');
  
  const [eventSearchQuery, setEventSearchQuery] = useState('');
  const [debouncedEventQuery, setDebouncedEventQuery] = useState('');
  
  const [filterTier, setFilterTier] = useState<FilterTier>('all');
  
  // Grant Pro Modal State
  const [showGrantModal, setShowGrantModal] = useState(false);
  const [selectedUser, setSelectedUser] = useState<{id: number, name: string} | null>(null);

  // Debounce search query
  useEffect(() => {
    const timer = setTimeout(() => {
      setDebouncedQuery(searchQuery);
      setDebouncedEventQuery(eventSearchQuery);
    }, 300);
    return () => clearTimeout(timer);
  }, [searchQuery, eventSearchQuery]);

  const { data: users, isLoading, refetch } = trpc.admin.searchUsers.useQuery(
    { query: debouncedQuery, tier: filterTier, eventSearch: debouncedEventQuery }
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

  const grantTemporaryPro = trpc.admin.grantTemporaryPro.useMutation({
    onSuccess: () => {
      refetch();
      setShowGrantModal(false);
      setSelectedUser(null);
      if (Platform.OS !== 'web') {
        Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      } else {
        alert('Subscription granted successfully!');
      }
    },
    onError: (error) => {
      Alert.alert('Error', error.message);
    }
  });

  const handleGrantLifetimeProClick = () => {
    if (!selectedUser) return;
    const message = `Grant Lifetime Pro access to ${selectedUser.name}?`;
    
    if (Platform.OS === 'web') {
      if (confirm(message)) {
        grantLifetimePro.mutate({ userId: selectedUser.id });
        setShowGrantModal(false);
      }
    } else {
      Alert.alert(
        'Confirm Grant Pro',
        message,
        [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Grant Pro', style: 'default', onPress: () => {
            grantLifetimePro.mutate({ userId: selectedUser.id });
            setShowGrantModal(false);
          }},
        ]
      );
    }
  };

  const handleGrantTemporaryPro = (durationDays: number) => {
    if (!selectedUser) return;
    grantTemporaryPro.mutate({ userId: selectedUser.id, durationDays, reason: "Gifted by Admin" });
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
        <View style={styles.searchRow}>
          <View style={[styles.searchContainer, { flex: 1 }]}>
            <IconSymbol name="magnifyingglass" size={20} color={AdminColors.gray400} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search users by name or email..."
              placeholderTextColor={AdminColors.gray400}
              value={searchQuery}
              onChangeText={setSearchQuery}
            />
          </View>
          <View style={[styles.searchContainer, { flex: 1 }]}>
            <IconSymbol name="calendar" size={20} color={AdminColors.gray400} />
            <TextInput
              style={styles.searchInput}
              placeholder="Search by event name they created..."
              placeholderTextColor={AdminColors.gray400}
              value={eventSearchQuery}
              onChangeText={setEventSearchQuery}
            />
          </View>
        </View>

        <View style={styles.filterTabsContainer}>
          <ScrollView horizontal showsHorizontalScrollIndicator={false} contentContainerStyle={styles.filterTabs}>
            {(['all', 'free', 'lite', 'pro', 'enterprise'] as FilterTier[]).map((tier) => (
              <Pressable
                key={tier}
                style={[
                  styles.filterTab,
                  filterTier === tier && styles.filterTabActive
                ]}
                onPress={() => setFilterTier(tier)}
              >
                <ThemedText style={[
                  styles.filterTabText,
                  filterTier === tier && styles.filterTabTextActive
                ]}>
                  {tier.charAt(0).toUpperCase() + tier.slice(1)}
                </ThemedText>
              </Pressable>
            ))}
          </ScrollView>
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
              {searchQuery || eventSearchQuery ? 'Try adjusting your search filters' : 'No users match your criteria'}
            </ThemedText>
          </View>
        ) : (
          <View style={styles.userGrid}>
            {users.map(user => {
              const isPro = user.subscriptionTier === 'pro' || user.isLifetimePro;
              const isEnterprise = user.subscriptionTier === 'enterprise';
              const isLite = user.subscriptionTier === 'lite';
              const isFree = !isPro && !isEnterprise && !isLite;
              
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
                        isLite ? styles.tierBadgeLite :
                        isEnterprise ? styles.tierBadgeEnterprise : 
                        styles.tierBadgePro
                      ]}>
                        <IconSymbol 
                          name={isPro ? "star.fill" : "person.fill"} 
                          size={14} 
                          color={isFree ? AdminColors.gray600 : isLite ? '#3b82f6' : isEnterprise ? '#6366f1' : AdminColors.warning} 
                        />
                        <ThemedText style={[
                          styles.tierBadgeText,
                          isFree ? styles.tierBadgeTextFree : 
                          isLite ? styles.tierBadgeTextLite :
                          isEnterprise ? styles.tierBadgeTextEnterprise : 
                          styles.tierBadgeTextPro
                        ]}>
                          {user.isLifetimePro ? 'Lifetime Pro' : 
                           user.subscriptionTier === 'pro' ? 'Pro' : 
                           user.subscriptionTier === 'lite' ? 'Lite' :
                           user.subscriptionTier === 'enterprise' ? 'Enterprise' : 'Free'}
                        </ThemedText>
                      </View>
                    </View>
                  </View>

                  <View style={styles.userActions}>
                    {user.id !== currentUser?.id && (
                      <>
                        {user.subscriptionTier !== 'pro' && !user.isLifetimePro ? (
                          <View style={{ flexDirection: 'row', gap: 8 }}>
                            <Pressable
                              style={styles.actionButtonPrimary}
                              onPress={() => {
                                setSelectedUser({ id: user.id, name: user.name || 'User' });
                                setShowGrantModal(true);
                              }}
                            >
                              <IconSymbol name="star.fill" size={16} color="#fff" />
                              <ThemedText style={styles.actionButtonText}>Grant Pro Options</ThemedText>
                            </Pressable>
                          </View>
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

      {/* Grant Pro Modal */}
      <Modal
        visible={showGrantModal}
        transparent={true}
        animationType="fade"
        onRequestClose={() => setShowGrantModal(false)}
      >
        <View style={styles.modalOverlay}>
          <View style={styles.modalContent}>
            <View style={styles.modalHeader}>
              <ThemedText style={styles.modalTitle}>Grant Pro Access</ThemedText>
              <Pressable onPress={() => setShowGrantModal(false)} style={styles.modalCloseButton}>
                <IconSymbol name="xmark" size={24} color={AdminColors.gray500} />
              </Pressable>
            </View>
            <ThemedText style={styles.modalSubtitle}>
              Select a duration to gift Pro access to {selectedUser?.name}.
            </ThemedText>
            
            <View style={styles.modalOptions}>
              <Pressable 
                style={styles.modalOptionBtn}
                onPress={() => handleGrantTemporaryPro(30)}
              >
                <ThemedText style={styles.modalOptionText}>30 Days Free</ThemedText>
              </Pressable>
              
              <Pressable 
                style={styles.modalOptionBtn}
                onPress={() => handleGrantTemporaryPro(60)}
              >
                <ThemedText style={styles.modalOptionText}>60 Days Free</ThemedText>
              </Pressable>

              <Pressable 
                style={styles.modalOptionBtn}
                onPress={() => handleGrantTemporaryPro(180)}
              >
                <ThemedText style={styles.modalOptionText}>6 Months Free</ThemedText>
              </Pressable>

              <Pressable 
                style={styles.modalOptionBtn}
                onPress={() => handleGrantTemporaryPro(365)}
              >
                <ThemedText style={styles.modalOptionText}>1 Year Free</ThemedText>
              </Pressable>

              <View style={styles.modalDivider} />

              <Pressable 
                style={[styles.modalOptionBtn, { backgroundColor: AdminColors.gray800 }]}
                onPress={handleGrantLifetimeProClick}
              >
                <ThemedText style={[styles.modalOptionText, { color: '#fff' }]}>Lifetime Pro</ThemedText>
              </Pressable>
            </View>
          </View>
        </View>
      </Modal>

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
  searchRow: {
    flexDirection: 'row',
    gap: AdminSpacing.base,
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
  filterTabsContainer: {
    marginTop: AdminSpacing.sm,
  },
  filterTabs: {
    flexDirection: 'row',
    gap: AdminSpacing.sm,
  },
  filterTab: {
    paddingHorizontal: AdminSpacing.lg,
    paddingVertical: AdminSpacing.xs,
    borderRadius: AdminBorderRadius.full,
    backgroundColor: AdminColors.gray100,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  filterTabActive: {
    backgroundColor: AdminColors.primary,
  },
  filterTabText: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray600,
    fontWeight: '500' as any,
  },
  filterTabTextActive: {
    color: '#ffffff',
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
  tierBadgeLite: {
    backgroundColor: '#eff6ff',
    borderWidth: 1,
    borderColor: '#3b82f6',
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
  tierBadgeTextLite: {
    color: '#2563eb',
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

  // Modal Styles
  modalOverlay: {
    flex: 1,
    backgroundColor: 'rgba(0, 0, 0, 0.5)',
    justifyContent: 'center',
    alignItems: 'center',
  },
  modalContent: {
    backgroundColor: AdminColors.surface,
    borderRadius: AdminBorderRadius.lg,
    padding: AdminSpacing.xl,
    width: '90%',
    maxWidth: 400,
    ...Platform.select({
      web: {
        boxShadow: AdminShadows.lg,
      },
      default: {
        shadowColor: '#000',
        shadowOffset: { width: 0, height: 4 },
        shadowOpacity: 0.1,
        shadowRadius: 8,
        elevation: 5,
      },
    }),
  },
  modalHeader: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    marginBottom: AdminSpacing.sm,
  },
  modalTitle: {
    fontSize: AdminTypography.xl,
    fontWeight: '700' as any,
    color: AdminColors.gray900,
  },
  modalSubtitle: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray500,
    marginBottom: AdminSpacing.xl,
  },
  modalCloseButton: {
    padding: AdminSpacing.xs,
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  modalOptions: {
    gap: AdminSpacing.sm,
  },
  modalOptionBtn: {
    paddingVertical: AdminSpacing.md,
    paddingHorizontal: AdminSpacing.lg,
    backgroundColor: AdminColors.gray100,
    borderRadius: AdminBorderRadius.md,
    alignItems: 'center',
    ...Platform.select({ web: { cursor: 'pointer' } }),
  },
  modalOptionText: {
    fontSize: AdminTypography.base,
    fontWeight: '600' as any,
    color: AdminColors.gray800,
  },
  modalDivider: {
    height: 1,
    backgroundColor: AdminColors.border,
    marginVertical: AdminSpacing.sm,
  }
});