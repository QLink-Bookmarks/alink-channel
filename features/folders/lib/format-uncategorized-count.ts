const UNCATEGORIZED_COUNT_LIMIT = 100;

type UncategorizedPage = {
  contents: readonly unknown[];
  hasNext: boolean;
};

function formatUncategorizedCount(page: UncategorizedPage | undefined, isError: boolean) {
  if (isError || !page) {
    return undefined;
  }
  return page.hasNext ? `${UNCATEGORIZED_COUNT_LIMIT}+` : String(page.contents.length);
}

export { UNCATEGORIZED_COUNT_LIMIT, formatUncategorizedCount };
