import { useRedirectConnectFeedback } from "@/features/auth/hooks/use-connect-feedback";
import { SettingsRouteScreen } from "@/features/navigation/components/route-screens";

export default function Settings() {
  useRedirectConnectFeedback();
  return <SettingsRouteScreen />;
}
