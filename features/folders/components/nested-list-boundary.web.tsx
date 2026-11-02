import * as React from "react";

function NestedListBoundary({ children }: { children: React.ReactNode }) {
  return <>{children}</>;
}

export { NestedListBoundary };
