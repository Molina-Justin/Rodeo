import { useQuery } from "@tanstack/react-query"

import { api } from "@/api/client"

export const reviewQueueQueryKey = ["review-queue"]

export function useReviewQueue() {
  return useQuery({
    queryKey: reviewQueueQueryKey,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/review-queue")
      if (error || !data) {
        throw new Error("Review queue could not be loaded")
      }
      return data
    },
  })
}
