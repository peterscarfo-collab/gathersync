import { router } from "expo-router";
import { useState } from "react";
import { Alert, Pressable, ScrollView, StyleSheet, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import * as Haptics from "expo-haptics";

import { ThemedText } from "@/components/themed-text";
import { ThemedView } from "@/components/themed-view";
import { useAuth } from "@/hooks/use-auth";
import { getSubscriptionLimits, getTierDisplayName, formatPricing } from "@/lib/subscription";

export default function UpgradeScreen() {
  const insets = useSafeAreaInsets();
  const { user } = useAuth();
  const [selectedTier, setSelectedTier] = useState<"pro" | "enterprise">("pro");

  const currentTier = (user as any)?.subscriptionTier || 'free';
  const freeLimits = getSubscriptionLimits("free");
  const proLimits = getSubscriptionLimits("pro");

  const handleUpgrade = async () => {
    await Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
    
    if (selectedTier === "enterprise") {
      Alert.alert(
        "Contact Sales",
        "Enterprise plans are custom-tailored for organizations. Please email sales@gathersync.app for pricing and features.",
        [{ text: "OK" }]
      );
      return;
    }

    // TODO: Navigate to Stripe checkout
    Alert.alert(
      "Coming Soon",
      "Stripe payment integration will be added in the next phase. For now, this shows the upgrade UI.",
      [{ text: "OK" }]
    );
  };

  return (
    <ThemedView style={styles.container}>
      <ScrollView
        style={styles.scrollView}
        contentContainerStyle={[
          styles.scrollContent,
          {
            paddingTop: Math.max(insets.top, 20) + 16,
            paddingBottom: Math.max(insets.bottom, 20) + 16,
          },
        ]}
      >
        {/* Header */}
        <View style={styles.header}>
          <ThemedText type="title" style={styles.title}>
            Upgrade to Pro
          </ThemedText>
          <ThemedText style={styles.subtitle}>
            Unlock unlimited events and premium features
          </ThemedText>
        </View>

        {/* Current Plan */}
        <View style={styles.currentPlanCard}>
          <ThemedText type="subtitle" style={styles.cardTitle}>
            Current Plan: {getTierDisplayName(currentTier)}
          </ThemedText>
          <ThemedText style={styles.usageText}>
            {(user as any)?.eventsCreatedThisMonth || 0} of {freeLimits.eventsPerMonth} events used this month
          </ThemedText>
        </View>

        {/* Plan Selector */}
        <View style={styles.planSelector}>
          {/* Pro Plan */}
          <Pressable
            style={[styles.planCard, selectedTier === "pro" && styles.planCardSelected]}
            onPress={() => {
              setSelectedTier("pro");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={styles.planHeader}>
              <ThemedText type="subtitle">Pro</ThemedText>
              <ThemedText type="title" style={styles.price}>
                $3.99
              </ThemedText>
              <ThemedText style={styles.period}>per month</ThemedText>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureList}>
              <FeatureItem text="Unlimited events per month" />
              <FeatureItem text="Unlimited participants" />
              <FeatureItem text="Cloud sync across devices" />
              <FeatureItem text="Advanced analytics" />
              <FeatureItem text="Priority support" />
              <FeatureItem text="Export data" />
            </View>
          </Pressable>

          {/* Enterprise Plan */}
          <Pressable
            style={[styles.planCard, selectedTier === "enterprise" && styles.planCardSelected]}
            onPress={() => {
              setSelectedTier("enterprise");
              Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Light);
            }}
          >
            <View style={styles.planHeader}>
              <ThemedText type="subtitle">Enterprise</ThemedText>
              <ThemedText type="title" style={styles.price}>
                Custom
              </ThemedText>
              <ThemedText style={styles.period}>contact sales</ThemedText>
            </View>

            <View style={styles.divider} />

            <View style={styles.featureList}>
              <FeatureItem text="Everything in Pro" />
              <FeatureItem text="Custom branding" />
              <FeatureItem text="White-label option" />
              <FeatureItem text="Dedicated support" />
              <FeatureItem text="Custom integrations" />
              <FeatureItem text="Volume discounts" />
            </View>
          </Pressable>
        </View>

        {/* Upgrade Button */}
        <Pressable style={styles.upgradeButton} onPress={handleUpgrade}>
          <ThemedText style={styles.upgradeButtonText}>
            {selectedTier === "enterprise" ? "Contact Sales" : "Upgrade to Pro"}
          </ThemedText>
        </Pressable>

        {/* Cancel Button */}
        <Pressable style={styles.cancelButton} onPress={() => router.back()}>
          <ThemedText style={styles.cancelButtonText}>Maybe Later</ThemedText>
        </Pressable>
      </ScrollView>
    </ThemedView>
  );
}

function FeatureItem({ text }: { text: string }) {
  return (
    <View style={styles.featureItem}>
      <ThemedText style={styles.checkmark}>✓</ThemedText>
      <ThemedText style={styles.featureText}>{text}</ThemedText>
    </View>
  );
}

const styles = StyleSheet.create({
  container: {
    flex: 1,
  },
  scrollView: {
    flex: 1,
  },
  scrollContent: {
    paddingHorizontal: 20,
  },
  header: {
    marginBottom: 24,
    alignItems: "center",
  },
  title: {
    marginBottom: 8,
  },
  subtitle: {
    textAlign: "center",
    opacity: 0.7,
  },
  currentPlanCard: {
    backgroundColor: "rgba(0, 122, 255, 0.1)",
    padding: 16,
    borderRadius: 12,
    marginBottom: 24,
  },
  cardTitle: {
    marginBottom: 8,
  },
  usageText: {
    opacity: 0.7,
  },
  planSelector: {
    gap: 16,
    marginBottom: 24,
  },
  planCard: {
    borderWidth: 2,
    borderColor: "#E5E5EA",
    borderRadius: 16,
    padding: 20,
    backgroundColor: "#FFFFFF",
  },
  planCardSelected: {
    borderColor: "#007AFF",
    backgroundColor: "rgba(0, 122, 255, 0.05)",
  },
  planHeader: {
    alignItems: "center",
    marginBottom: 16,
  },
  price: {
    marginTop: 8,
    marginBottom: 4,
  },
  period: {
    opacity: 0.6,
    fontSize: 14,
  },
  divider: {
    height: 1,
    backgroundColor: "#E5E5EA",
    marginBottom: 16,
  },
  featureList: {
    gap: 12,
  },
  featureItem: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
  },
  checkmark: {
    fontSize: 18,
    color: "#34C759",
    fontWeight: "bold",
  },
  featureText: {
    flex: 1,
    fontSize: 15,
  },
  upgradeButton: {
    backgroundColor: "#007AFF",
    paddingVertical: 16,
    borderRadius: 12,
    alignItems: "center",
    marginBottom: 12,
  },
  upgradeButtonText: {
    color: "#FFFFFF",
    fontSize: 17,
    fontWeight: "600",
  },
  cancelButton: {
    paddingVertical: 12,
    alignItems: "center",
  },
  cancelButtonText: {
    color: "#007AFF",
    fontSize: 15,
  },
});
