import { AppEntryScreen } from "@/features/auth/components/auth-splash-screen";

import { useAgreementStatus } from "../hooks/use-agreement-status";
import { AgreementsScreen } from "./agreements-screen";

function AgreementsRouteScreen() {
  const { hasResolved, needsAgreement } = useAgreementStatus();
  return hasResolved && needsAgreement ? <AgreementsScreen /> : <AppEntryScreen />;
}

export { AgreementsRouteScreen };
