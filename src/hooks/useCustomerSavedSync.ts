import { useSyncExternalStore } from 'react';
import { customerSavedSync } from '@/lib/customerSavedSync';
export function useCustomerSavedSync() {
  return useSyncExternalStore(customerSavedSync.subscribe, customerSavedSync.getState, customerSavedSync.getServerState);
}