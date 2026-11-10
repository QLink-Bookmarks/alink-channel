import { connectAuthProvider } from "../api";
import type { AuthPlatform } from "../types";
import type { SocialProvider } from "./provider-brand";

import { isAxiosError } from "axios";

type ConnectErrorReason = "already-connected" | "linked-to-other-user" | "unknown";

type ConnectOutcome =
  | { kind: "connected"; provider: SocialProvider }
  | { kind: "error"; provider: SocialProvider; reason: ConnectErrorReason };

// What a provider SDK handed back for a connect attempt: a token to send, or
// the user backing out of the provider's own sign-in UI.
type ConnectToken = { kind: "token"; token: string } | { kind: "cancelled" };

function connectFailed(provider: SocialProvider): ConnectOutcome {
  return { kind: "error", provider, reason: "unknown" };
}

// AUTH_409_0001: this provider is already linked to the current account.
// AUTH_409_0002: this social account is already linked to a different user.
const ALREADY_CONNECTED_CODE = "AUTH_409_0001";
const LINKED_TO_OTHER_USER_CODE = "AUTH_409_0002";

function reasonForCode(code: string | undefined): ConnectErrorReason {
  if (code === ALREADY_CONNECTED_CODE) return "already-connected";
  if (code === LINKED_TO_OTHER_USER_CODE) return "linked-to-other-user";
  return "unknown";
}

// Send the social token to POST /api/auth/connection and map the result/error
// to a small outcome the UI can react to. Never throws.
async function connectWithToken(
  provider: SocialProvider,
  token: string,
  platform: AuthPlatform,
): Promise<ConnectOutcome> {
  try {
    const response = await connectAuthProvider({ provider, token, platform });
    if (response?.success) {
      return { kind: "connected", provider };
    }
    return { kind: "error", provider, reason: reasonForCode(response?.error?.code) };
  } catch (error) {
    const code = isAxiosError(error)
      ? (error.response?.data as { error?: { code?: string } } | undefined)?.error?.code
      : undefined;
    return { kind: "error", provider, reason: reasonForCode(code) };
  }
}

export { connectFailed, connectWithToken };
export type { ConnectErrorReason, ConnectOutcome, ConnectToken };
