import * as React from "react";

type ShellActions = {
  openNewLink: () => void;
};

const ShellActionsContext = React.createContext<ShellActions | null>(null);

function useShellActions() {
  return React.use(ShellActionsContext);
}

export { ShellActionsContext, useShellActions };
export type { ShellActions };
