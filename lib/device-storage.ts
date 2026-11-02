import { SessionStorage } from "./session-storage";

import type { StateStorage } from "zustand/middleware";

const DeviceStorage: StateStorage = SessionStorage;

export { DeviceStorage };
