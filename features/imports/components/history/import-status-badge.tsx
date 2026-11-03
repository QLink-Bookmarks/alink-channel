import { Badge } from "@/components/ui/badge";
import { Text } from "@/components/ui/text";

import { getImportStatusLabel, getImportStatusTone } from "../../lib/import-status-copy";
import type { ImportStatus } from "../../types";

const TONE_VARIANTS = {
  success: "success",
  warning: "warning",
  danger: "overdue",
  muted: "private",
} as const;

function ImportStatusBadge({ status, className }: { status: ImportStatus; className?: string }) {
  return (
    <Badge
      variant={TONE_VARIANTS[getImportStatusTone(status)]}
      className={className}
    >
      <Text>{getImportStatusLabel(status)}</Text>
    </Badge>
  );
}

export { ImportStatusBadge };
