/**
 * TanStack Query hooks for stickies.
 */

import { useQuery } from "@tanstack/react-query";
import * as sdk from "../sdk/stickies";

export const stickiesQueryKey = ["stickies"] as const;

const STALE_TIME_MS = 30 * 1000; // 30s — stickies change less frequently than entries

/**
 * All stickies for the authenticated user.
 */
export function useStickiesQuery() {
  return useQuery({
    queryKey: stickiesQueryKey,
    queryFn: () => sdk.listStickies(),
    staleTime: STALE_TIME_MS,
  });
}
