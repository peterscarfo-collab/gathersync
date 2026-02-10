import { useState } from 'react';
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
import { useRouter } from 'expo-router';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import * as Haptics from 'expo-haptics';

import { ThemedText } from '@/components/themed-text';
import { ThemedView } from '@/components/themed-view';
import { IconSymbol } from '@/components/ui/icon-symbol';
import { useAuth } from '@/hooks/auth-context';
import { trpc } from '@/lib/trpc';
import { AdminColors, AdminTypography, AdminSpacing, AdminBorderRadius } from '@/constants/admin-theme';

type UserResult = {
  id: string;
  email?: string | null;
  name?: string | null;
  subscriptionTier?: string | null;
  subscriptionStatus?: string | null;
  isLifetimePro?: boolean | null;
  subscriptionEndDate?: Date | string | null;
  trialEndDate?: Date | string | null;
  grantedBy?: string | null;
};

type PromotionId = 'lifetime' | 'revoke' | 30 | 180 | 365;

const PROMOTIONS: { id: PromotionId; label: string; description: string; days?: number }[] = [
  { id: 'lifetime', label: 'Lifetime Pro', description: 'Foundation members, web testers' },
  { id: 30, label: '1 month', description: 'Pro access for 30 days', days: 30 },
  { id: 180, label: '6 months', description: 'Pro access for 6 months', days: 180 },
  { id: 365, label: '12 months', description: 'Pro access for 1 year', days: 365 },
  { id: 'revoke', label: 'Revoke lifetime', description: 'Remove lifetime Pro access' },
];

function formatDate(d: Date | string | null | undefined): string {
  if (!d) return '—';
  const date = typeof d === 'string' ? new Date(d) : d;
  return date.toLocaleDateString(undefined, { dateStyle: 'medium' });
}

function formatTier(user: UserResult): string {
  const tier = user.subscriptionTier || 'free';
  if (user.isLifetimePro) return 'Pro (lifetime)';
  if (user.subscriptionStatus === 'trialing' && user.trialEndDate) {
    return `Pro (trial until ${formatDate(user.trialEndDate)})`;
  }
  if (user.subscriptionEndDate) {
    return `${tier} until ${formatDate(user.subscriptionEndDate)}`;
  }
  return tier;
}

function getPromotionLabel(id: PromotionId): string {
  const p = PROMOTIONS.find((x) => x.id === id);
  return p?.label ?? String(id);
}

export default function AdminPromotionsScreen() {
  const router = useRouter();
  const insets = useSafeAreaInsets();
  const { isAuthenticated } = useAuth();
  const { data: sessionUser, isLoading: meLoading } = trpc.auth.me.useQuery(undefined, { enabled: isAuthenticated });
  const isAdmin = (sessionUser as { role?: string } | null)?.role === 'admin';

  const [selectedPromotion, setSelectedPromotion] = useState<PromotionId | null>(null);
  const [query, setQuery] = useState('');
  const [selectedUser, setSelectedUser] = useState<UserResult | null>(null);

  const utils = trpc.useUtils();

  const { data: searchResults, isLoading: searchLoading } = trpc.admin.searchUsers.useQuery(
    { query: query.trim() },
    { enabled: isAdmin && query.trim().length >= 2, refetchOnWindowFocus: false }
  );

  const grantLifetime = trpc.admin.grantLifetimePro.useMutation({
    onSuccess: () => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedUser((prev) => (prev ? { ...prev, isLifetimePro: true, subscriptionTier: 'pro', subscriptionStatus: 'active' } : null));
      void utils.auth.me.invalidate();
    },
    onError: (e) => {
      if (Platform.OS === 'web') alert(e.message);
      else Alert.alert('Error', e.message);
    },
  });
  const revokeLifetime = trpc.admin.revokeLifetimePro.useMutation({
    onSuccess: () => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      setSelectedUser((prev) => (prev ? { ...prev, isLifetimePro: false, subscriptionTier: 'free', subscriptionStatus: 'active' } : null));
      void utils.auth.me.invalidate();
    },
    onError: (e) => {
      if (Platform.OS === 'web') alert(e.message);
      else Alert.alert('Error', e.message);
    },
  });
  const grantTemporary = trpc.admin.grantTemporaryPro.useMutation({
    onSuccess: (_, vars) => {
      if (Platform.OS !== 'web') Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
      const endDate = new Date();
      endDate.setDate(endDate.getDate() + vars.durationDays);
      setSelectedUser((prev) =>
        prev ? { ...prev, subscriptionTier: 'pro', subscriptionStatus: 'active', subscriptionEndDate: endDate } : null
      );
      void utils.auth.me.invalidate();
    },
    onError: (e) => {
      if (Platform.OS === 'web') alert(e.message);
      else Alert.alert('Error', e.message);
    },
  });

  const users = (searchResults ?? []) as UserResult[];
  const loading = meLoading;
  const noAccess = isAuthenticated && !meLoading && !isAdmin;
  const anyPending = grantLifetime.isPending || revokeLifetime.isPending || grantTemporary.isPending;

  const handleApply = () => {
    if (!selectedUser || selectedPromotion === null) return;
    const display = selectedUser.email || selectedUser.name || selectedUser.id;

    const confirm = (title: string, message: string, onConfirm: () => void) => {
      if (Platform.OS === 'web') {
        if (!window.confirm(`${message}\n\nContinue?`)) return;
        onConfirm();
      } else {
        Alert.alert(title, message, [
          { text: 'Cancel', style: 'cancel' },
          { text: 'Apply', onPress: onConfirm },
        ]);
      }
    };

    if (selectedPromotion === 'lifetime') {
      confirm('Grant lifetime Pro', `Grant lifetime Pro access to ${display}?`, () => grantLifetime.mutate({ userId: selectedUser.id }));
    } else if (selectedPromotion === 'revoke') {
      confirm('Revoke lifetime Pro', `Revoke lifetime Pro from ${display}?`, () => revokeLifetime.mutate({ userId: selectedUser.id }));
    } else if (typeof selectedPromotion === 'number') {
      const label = getPromotionLabel(selectedPromotion);
      confirm(`Gift ${label}`, `Grant ${label} Pro access to ${display}?`, () =>
        grantTemporary.mutate({ userId: selectedUser.id, durationDays: selectedPromotion })
      );
    }
  };

  if (!isAuthenticated) {
    return (
      <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
        <ThemedText style={styles.centered}>Please log in to access this page.</ThemedText>
      </ThemedView>
    );
  }

  if (loading) {
    return (
      <ThemedView style={[styles.container, styles.centeredContainer, { paddingTop: insets.top }]}>
        <ActivityIndicator size="large" color={AdminColors.primary} />
      </ThemedView>
    );
  }

  if (noAccess) {
    return (
      <ThemedView style={[styles.container, styles.centeredContainer, { paddingTop: insets.top }]}>
        <IconSymbol name="lock.fill" size={48} color={AdminColors.gray400} />
        <ThemedText style={styles.centeredTitle}>Admin access required</ThemedText>
        <ThemedText style={styles.centeredSub}>This page is only available to administrators.</ThemedText>
        <Pressable style={styles.backButton} onPress={() => router.back()}>
          <ThemedText style={styles.backButtonText}>Go back</ThemedText>
        </Pressable>
      </ThemedView>
    );
  }

  return (
    <ThemedView style={[styles.container, { paddingTop: insets.top }]}>
      <ScrollView
        style={styles.scroll}
        contentContainerStyle={[styles.scrollContent, { paddingBottom: insets.bottom + 24 }]}
        keyboardShouldPersistTaps="handled"
      >
        <View style={styles.header}>
          <Pressable onPress={() => router.back()} style={styles.backRow}>
            <IconSymbol name="chevron.left" size={24} color={AdminColors.gray700} />
            <ThemedText style={styles.backText}>Back</ThemedText>
          </Pressable>
          <ThemedText style={styles.title}>Promotions & access</ThemedText>
          <ThemedText style={styles.subtitle}>
            Choose a promotion, then search and select the person to apply it to.
          </ThemedText>
        </View>

        {/* Step 1: Choose promotion */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>1. Choose a promotion</ThemedText>
          <View style={styles.promotionGrid}>
            {PROMOTIONS.map((promo) => {
              const isSelected = selectedPromotion === promo.id;
              const isRevoke = promo.id === 'revoke';
              return (
                <Pressable
                  key={String(promo.id)}
                  style={[
                    styles.promotionCard,
                    isSelected && styles.promotionCardSelected,
                    isRevoke && isSelected && styles.promotionCardRevokeSelected,
                  ]}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedPromotion(promo.id);
                  }}
                >
                  <ThemedText style={[styles.promotionLabel, isRevoke && styles.promotionLabelRevoke]}>
                    {promo.label}
                  </ThemedText>
                  <ThemedText style={styles.promotionDescription}>{promo.description}</ThemedText>
                </Pressable>
              );
            })}
          </View>
        </View>

        {/* Step 2: Search and select person */}
        <View style={styles.section}>
          <ThemedText style={styles.sectionLabel}>2. Who should receive it?</ThemedText>
          <TextInput
            style={styles.input}
            value={query}
            onChangeText={setQuery}
            placeholder="Search by email or name…"
            placeholderTextColor={AdminColors.gray400}
            autoCapitalize="none"
            autoCorrect={false}
          />
          {searchLoading && (
            <View style={styles.loadingRow}>
              <ActivityIndicator size="small" color={AdminColors.primary} />
              <ThemedText style={styles.loadingText}>Searching…</ThemedText>
            </View>
          )}
        </View>

        {query.trim().length >= 2 && (
          <View style={styles.resultsSection}>
            {users.length === 0 && !searchLoading && (
              <ThemedText style={styles.hint}>No users found. Try a different search.</ThemedText>
            )}
            {users.map((u) => {
              const isSelected = selectedUser?.id === u.id;
              return (
                <Pressable
                  key={u.id}
                  style={[styles.userCard, isSelected && styles.userCardSelected]}
                  onPress={() => {
                    if (Platform.OS !== 'web') Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
                    setSelectedUser(u);
                  }}
                >
                  <View style={styles.userCardMain}>
                    <ThemedText style={styles.userEmail}>{u.email || u.name || u.id}</ThemedText>
                    {u.name && u.email && u.name !== u.email && (
                      <ThemedText style={styles.userName}>{u.name}</ThemedText>
                    )}
                    <ThemedText style={styles.userTier}>{formatTier(u)}</ThemedText>
                  </View>
                  <IconSymbol name="chevron.right" size={20} color={AdminColors.gray400} />
                </Pressable>
              );
            })}
          </View>
        )}

        {/* Apply */}
        {selectedPromotion !== null && selectedUser && (
          <View style={styles.applySection}>
            <View style={styles.applyCard}>
              <ThemedText style={styles.applySummary}>
                {selectedPromotion === 'revoke'
                  ? `Revoke lifetime Pro for ${selectedUser.email || selectedUser.name || selectedUser.id}`
                  : `Grant ${getPromotionLabel(selectedPromotion)} to ${selectedUser.email || selectedUser.name || selectedUser.id}`}
              </ThemedText>
              <ThemedText style={styles.currentStatus}>Current: {formatTier(selectedUser)}</ThemedText>
              <Pressable
                style={[
                  styles.applyButton,
                  selectedPromotion === 'revoke' && styles.applyButtonRevoke,
                  anyPending && styles.applyButtonDisabled,
                ]}
                onPress={handleApply}
                disabled={anyPending}
              >
                {anyPending ? (
                  <ActivityIndicator size="small" color="#fff" />
                ) : (
                  <ThemedText style={styles.applyButtonText}>
                    {selectedPromotion === 'revoke' ? 'Revoke lifetime' : 'Apply promotion'}
                  </ThemedText>
                )}
              </Pressable>
            </View>
          </View>
        )}
      </ScrollView>
    </ThemedView>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    backgroundColor: AdminColors.gray50,
  },
  scroll: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: AdminSpacing['4xl'],
    paddingTop: AdminSpacing.lg,
  },
  centeredContainer: {
    justifyContent: 'center',
    alignItems: 'center',
    padding: AdminSpacing['4xl'],
  },
  centered: {
    fontSize: AdminTypography.lg,
    color: AdminColors.gray600,
    textAlign: 'center',
    marginTop: AdminSpacing.xl,
  },
  centeredTitle: {
    fontSize: AdminTypography.xl,
    fontWeight: '700' as any,
    color: AdminColors.gray800,
    marginTop: AdminSpacing.lg,
    textAlign: 'center',
  },
  centeredSub: {
    fontSize: AdminTypography.base,
    color: AdminColors.gray600,
    textAlign: 'center',
    marginTop: AdminSpacing.sm,
  },
  backButton: {
    marginTop: AdminSpacing.xl,
    paddingVertical: AdminSpacing.md,
    paddingHorizontal: AdminSpacing.xl,
    backgroundColor: AdminColors.primary,
    borderRadius: AdminBorderRadius.md,
  },
  backButtonText: {
    color: '#fff',
    fontWeight: '600' as any,
  },
  header: {
    marginBottom: AdminSpacing['2xl'],
  },
  backRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.xs,
    marginBottom: AdminSpacing.lg,
  },
  backText: {
    fontSize: AdminTypography.base,
    color: AdminColors.gray700,
  },
  title: {
    fontSize: AdminTypography['2xl'],
    fontWeight: '700' as any,
    color: AdminColors.gray900,
    marginBottom: AdminSpacing.xs,
  },
  subtitle: {
    fontSize: AdminTypography.base,
    color: AdminColors.gray600,
    lineHeight: AdminTypography.relaxed * AdminTypography.base,
  },
  section: {
    marginBottom: AdminSpacing['2xl'],
  },
  sectionLabel: {
    fontSize: AdminTypography.sm,
    fontWeight: '600' as any,
    color: AdminColors.gray700,
    marginBottom: AdminSpacing.sm,
  },
  promotionGrid: {
    gap: AdminSpacing.sm,
  },
  promotionCard: {
    backgroundColor: AdminColors.surface,
    borderRadius: AdminBorderRadius.lg,
    padding: AdminSpacing.lg,
    borderWidth: 2,
    borderColor: AdminColors.border,
  },
  promotionCardSelected: {
    borderColor: AdminColors.primary,
    backgroundColor: AdminColors.primaryLight,
  },
  promotionCardRevokeSelected: {
    borderColor: AdminColors.error,
    backgroundColor: AdminColors.errorLight,
  },
  promotionLabel: {
    fontSize: AdminTypography.lg,
    fontWeight: '600' as any,
    color: AdminColors.gray900,
  },
  promotionLabelRevoke: {
    color: AdminColors.error,
  },
  promotionDescription: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray600,
    marginTop: 4,
  },
  input: {
    backgroundColor: AdminColors.surface,
    borderWidth: 1,
    borderColor: AdminColors.border,
    borderRadius: AdminBorderRadius.md,
    paddingVertical: AdminSpacing.md,
    paddingHorizontal: AdminSpacing.lg,
    fontSize: AdminTypography.base,
    color: AdminColors.gray900,
  },
  loadingRow: {
    flexDirection: 'row',
    alignItems: 'center',
    gap: AdminSpacing.sm,
    marginTop: AdminSpacing.sm,
  },
  loadingText: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray600,
  },
  resultsSection: {
    marginBottom: AdminSpacing['2xl'],
  },
  hint: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray500,
    fontStyle: 'italic',
    marginTop: AdminSpacing.sm,
  },
  userCard: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    backgroundColor: AdminColors.surface,
    borderRadius: AdminBorderRadius.md,
    padding: AdminSpacing.lg,
    marginBottom: AdminSpacing.sm,
    borderWidth: 1,
    borderColor: AdminColors.border,
  },
  userCardSelected: {
    borderColor: AdminColors.primary,
    borderWidth: 2,
  },
  userCardMain: {
    flex: 1,
  },
  userEmail: {
    fontSize: AdminTypography.base,
    fontWeight: '600' as any,
    color: AdminColors.gray900,
  },
  userName: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray600,
    marginTop: 2,
  },
  userTier: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray500,
    marginTop: 4,
  },
  applySection: {
    marginTop: AdminSpacing.lg,
  },
  applyCard: {
    backgroundColor: AdminColors.surface,
    borderRadius: AdminBorderRadius.lg,
    padding: AdminSpacing.xl,
    borderWidth: 1,
    borderColor: AdminColors.border,
  },
  applySummary: {
    fontSize: AdminTypography.base,
    fontWeight: '600' as any,
    color: AdminColors.gray900,
    marginBottom: AdminSpacing.xs,
  },
  currentStatus: {
    fontSize: AdminTypography.sm,
    color: AdminColors.gray600,
    marginBottom: AdminSpacing.lg,
  },
  applyButton: {
    backgroundColor: AdminColors.primary,
    paddingVertical: AdminSpacing.md,
    paddingHorizontal: AdminSpacing.xl,
    borderRadius: AdminBorderRadius.md,
    alignItems: 'center',
    justifyContent: 'center',
    minHeight: 44,
  },
  applyButtonRevoke: {
    backgroundColor: AdminColors.error,
  },
  applyButtonDisabled: {
    opacity: 0.7,
  },
  applyButtonText: {
    color: '#fff',
    fontWeight: '600' as any,
    fontSize: AdminTypography.base,
  },
});
