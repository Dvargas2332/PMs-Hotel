import { AsyncLocalStorage } from "node:async_hooks";

export type TenantContext = {
  hotelId?: string;
  bypass?: boolean;
};

export const tenantStorage = new AsyncLocalStorage<TenantContext>();

export function getTenantHotelId() {
  return tenantStorage.getStore()?.hotelId;
}

export function runAsSystem<T>(fn: () => T): T {
  return tenantStorage.run({ bypass: true }, fn);
}

