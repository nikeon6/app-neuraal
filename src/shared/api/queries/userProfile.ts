/**
 * TanStack Query hook for user profile data (read-only).
 */

import { useQuery } from "@tanstack/react-query";
import { apiFetch } from "../apiClient";

export interface UserProfileData {
  id: string;
  email: string;
  phoneNumber: string | null;
}

interface MeResponse {
  user: UserProfileData;
}

export const userProfileQueryKey = ["user-profile"] as const;

const STALE_TIME_MS = 60_000;

/**
 * Fetches the authenticated user's profile.
 */
export function useUserProfileQuery(enabled = true) {
  return useQuery({
    queryKey: userProfileQueryKey,
    queryFn: async () => {
      const data = await apiFetch<MeResponse>("/api/auth/me");
      return data.user;
    },
    staleTime: STALE_TIME_MS,
    enabled,
  });
}
