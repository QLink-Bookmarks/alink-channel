import { useLinksQuery } from "@/features/links/queries";

import { UNCATEGORIZED_FOLDER_ID } from "../lib/folder-pages";
import {
  UNCATEGORIZED_COUNT_LIMIT,
  formatUncategorizedCount,
} from "../lib/format-uncategorized-count";

function useUncategorizedCount() {
  const query = useLinksQuery({
    folderId: UNCATEGORIZED_FOLDER_ID,
    size: UNCATEGORIZED_COUNT_LIMIT,
  });
  return formatUncategorizedCount(query.data, query.isError);
}

export { useUncategorizedCount };
