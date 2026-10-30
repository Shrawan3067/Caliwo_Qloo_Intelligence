import { QueryClient } from '@tanstack/react-query';
import { createAsyncStoragePersister } from '@tanstack/query-async-storage-persister';
import AsyncStorage from '@react-native-async-storage/async-storage';

// H7 fix: Increased staleTime from 60s to 5 minutes for stable data.
// With 10K concurrent users, each navigating triggers refetches —
// the previous 60s staleTime generated excessive API calls.
// Specific query keys can override this with shorter staleTime where needed
// (e.g. steps/today can use staleTime: 30_000 at the hook level).
export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      // Data remains considered fresh for 5 minutes (was 1 minute)
      staleTime: 1000 * 60 * 5,
      // Keep offline data in cache for 24 hours
      gcTime: 1000 * 60 * 60 * 24,
      // Only retry failed queries once before showing error
      retry: 1,
      // Don't refetch on window focus in React Native
      refetchOnWindowFocus: false,
      // Don't refetch on reconnect automatically — let pull-to-refresh handle it
      refetchOnReconnect: false,
    },
  },
});

// Setup the offline persistence layer
export const asyncStoragePersister = createAsyncStoragePersister({
  storage: AsyncStorage,
  key: 'CALIWO_OFFLINE_QUERY_CACHE',
});
