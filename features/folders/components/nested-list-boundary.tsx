import * as React from "react";
import { ScrollView } from "react-native";

const ScrollViewContext = (ScrollView as unknown as { Context: React.Context<unknown> }).Context;

// 시트 본문(ScrollView) 안의 폴더 목록은 listMaxHeight로 높이가 정해진 독립 스크롤이라, RN Modal처럼 ScrollView.Context를 null로 끊어 중첩 경고를 없앤다. listMaxHeight 없이 쓰면 목록이 전부 그려져 가상화가 꺼진다.
function NestedListBoundary({ children }: { children: React.ReactNode }) {
  return <ScrollViewContext.Provider value={null}>{children}</ScrollViewContext.Provider>;
}

export { NestedListBoundary };
