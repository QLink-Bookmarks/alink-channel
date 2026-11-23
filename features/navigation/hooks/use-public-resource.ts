import * as React from "react";

import type { PublicFolder } from "@/features/folders/types";
import type { PublicLinkDetail } from "@/features/links/types";

type PublicResource =
  | { mode: "folder"; data: PublicFolder }
  | { mode: "link"; data: PublicLinkDetail };

type PublicResourceVisit = {
  resource: PublicResource;
  visit: string;
  headerAction?: React.ReactNode;
  isGuest: boolean;
  linkReadToken: string | null;
  revoke: () => void;
};

const PublicResourceContext = React.createContext<PublicResourceVisit | null>(null);
const MemberResourceContext = React.createContext<{
  kind: "folders" | "links";
  id: number;
} | null>(null);

function usePublicResource() {
  return React.use(PublicResourceContext);
}

function useMemberResourceAccess(kind: "folders" | "links", id: number) {
  const member = React.use(MemberResourceContext);
  if (!Number.isSafeInteger(id) || id <= 0) return true;
  return member?.kind === kind && member.id === id;
}

export { MemberResourceContext, PublicResourceContext, useMemberResourceAccess, usePublicResource };
export type { PublicResource, PublicResourceVisit };
