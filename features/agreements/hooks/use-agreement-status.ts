import { getMyProfile } from "@/features/account/api";
import { accountQueryKeys } from "@/features/account/queries";
import { useAuthStore } from "@/stores/auth";
import { useQuery } from "@tanstack/react-query";

type AgreementStatus = {
  hasHydrated: boolean;
  isAuthenticated: boolean;
  needsAgreement: boolean;
  hasResolved: boolean;
  isError: boolean;
  retry: () => void;
};

// Drives the routing guard. Reads the required-consent flags from the profile
// query (shared cache key) and only gates when a flag is explicitly false, so an
// older payload that omits the flags never locks the user out.
function useAgreementStatus(): AgreementStatus {
  const accessToken = useAuthStore((state) => state.accessToken);
  const hasHydrated = useAuthStore((state) => state.hasHydrated);
  const isAuthenticated = hasHydrated && Boolean(accessToken);

  const query = useQuery({
    queryKey: accountQueryKeys.myProfile(),
    queryFn: async () => {
      const response = await getMyProfile();
      return response.data;
    },
    enabled: isAuthenticated,
  });

  const needsAgreement =
    isAuthenticated &&
    !!query.data &&
    (query.data.allowsPrivacy === false || query.data.allowsAiUsage === false);

  return {
    hasHydrated,
    isAuthenticated,
    needsAgreement,
    hasResolved: isAuthenticated && query.isSuccess && !!query.data,
    isError: isAuthenticated && query.isError && !query.isFetching,
    retry: query.refetch,
  };
}

export { useAgreementStatus };
export type { AgreementStatus };
