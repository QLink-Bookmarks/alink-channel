import { useRedirectConnectFeedback } from "@/features/auth/hooks/use-redirect-connect-feedback.web";
import { SettingsRouteScreen } from "@/features/navigation/components/route-screens";

export default function Settings() {
  useRedirectConnectFeedback();
  return <SettingsRouteScreen />;
}
