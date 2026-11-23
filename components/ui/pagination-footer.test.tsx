import { fireEvent, render, screen } from "@testing-library/react-native";

import { PaginationFooter } from "./pagination-footer";

const errorTitle = "링크를 불러오지 못했어요";

it("shows loading, an actionable error and then clears the footer", () => {
  const onRetry = jest.fn();
  const { rerender, toJSON } = render(
    <PaginationFooter
      isLoading
      isError={false}
      errorTitle={errorTitle}
      onRetry={onRetry}
    />,
  );
  expect(screen.getByLabelText("불러오는 중")).toBeTruthy();
  expect(screen.queryByRole("button")).toBeNull();

  rerender(
    <PaginationFooter
      isLoading={false}
      isError
      errorTitle={errorTitle}
      onRetry={onRetry}
    />,
  );
  expect(screen.getByText(errorTitle)).toBeTruthy();
  fireEvent.press(screen.getByRole("button", { name: "다시 시도" }));
  expect(onRetry).toHaveBeenCalledTimes(1);

  rerender(
    <PaginationFooter
      isLoading={false}
      isError={false}
      errorTitle={errorTitle}
      onRetry={onRetry}
    />,
  );
  expect(toJSON()).toBeNull();
});
