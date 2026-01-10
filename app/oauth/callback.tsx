import { useEffect } from "react";
import { useLocalSearchParams, useRouter } from "expo-router";
import { View, Text, ActivityIndicator } from "react-native";

export default function OAuthCallback() {
  const params = useLocalSearchParams();
  const router = useRouter();

  useEffect(() => {
    // If backend sent an error, stop here
    if (params.error) {
      console.error("OAuth error:", params.error);
      return;
    }

    // Backend success path: sessionToken in URL
    const sessionToken = params.sessionToken;

    if (typeof sessionToken === "string") {
      // Store token for API calls (mobile-safe)
      localStorage.setItem("sessionToken", sessionToken);

      // Go to main app screen
      router.replace("/");
    }
  }, [params, router]);

  if (params.error) {
    return (
      <View style={{ padding: 20 }}>
        <Text style={{ fontSize: 16, color: "red" }}>
          Sign-in failed: {String(params.error)}
        </Text>
      </View>
    );
  }

  return (
    <View style={{ flex: 1, alignItems: "center", justifyContent: "center" }}>
      <ActivityIndicator size="large" />
      <Text style={{ marginTop: 12 }}>Signing you in…</Text>
    </View>
  );
}
