import { type ReactNode } from "react";

import { render, screen, userEvent } from "@testing-library/react-native";

import { useLinkSearchQuery, useWebSearchQuery } from "../queries";
import { SearchDialog } from "./search-dialog";

jest.mock("../queries", () => ({ useLinkSearchQuery: jest.fn(), useWebSearchQuery: jest.fn() }));

jest.mock("@/components/ui/input", () => ({ Input: jest.requireActual("react-native").TextInput }));

jest.mock("@/components/ui/dialog", () => ({
  Dialog: ({ children }: { children: ReactNode }) => children,
  DialogContent: ({ children }: { children: ReactNode }) => children,
  DialogTitle: () => null,
}));

const mockLinkSearch = jest.mocked(useLinkSearchQuery);
const mockWebSearch = jest.mocked(useWebSearchQuery);

function setLinkSearch(state: Partial<ReturnType<typeof useLinkSearchQuery>>) {
  mockLinkSearch.mockReturnValue({ links: [], refetch: jest.fn(), ...state } as ReturnType<
    typeof useLinkSearchQuery
  >);
}

function searchDialog() {
  return (
    <SearchDialog
      open
      mode="link"
      initialQuery="여행"
      onOpenChange={jest.fn()}
      onSelectLink={jest.fn()}
    />
  );
}

beforeEach(() => {
  mockWebSearch.mockReturnValue({} as ReturnType<typeof useWebSearchQuery>);
});

it("shows the count and the empty message only after a successful empty response", () => {
  setLinkSearch({ isPending: true });
  const { rerender } = render(searchDialog());

  expect(screen.getByLabelText("불러오는 중")).toBeOnTheScreen();
  expect(screen.queryByText("📌 링크 (0)")).toBeNull();
  expect(screen.queryByText("최신 검색어가 없어요")).toBeNull();

  setLinkSearch({
    data: {
      pages: [{ contents: [], isEmpty: true, hasNext: false, nextCursor: null }],
      pageParams: [undefined],
    },
    hasNextPage: false,
  });
  rerender(searchDialog());

  expect(screen.getByText("📌 링크 (0)")).toBeOnTheScreen();
  expect(screen.getByText("최신 검색어가 없어요")).toBeOnTheScreen();
  expect(screen.queryByLabelText("불러오는 중")).toBeNull();
});

it("retries the failed first page with the search term in place", async () => {
  const refetch = jest.fn();
  setLinkSearch({ isError: true, refetch });
  render(searchDialog());

  expect(screen.getByText("링크를 불러오지 못했어요")).toBeOnTheScreen();
  expect(screen.queryByText("최신 검색어가 없어요")).toBeNull();
  expect(screen.getByDisplayValue("여행")).toBeOnTheScreen();
  await userEvent.setup().press(screen.getByRole("button", { name: "다시 시도" }));
  expect(refetch).toHaveBeenCalledWith({ cancelRefetch: false });
});
