import { Redirect } from 'expo-router';

/** /admin has no index — send users to the Dashboard tab */
export default function AdminIndexRedirect() {
  return <Redirect href="/(tabs)/admin" />;
}
