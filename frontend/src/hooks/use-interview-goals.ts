import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/api/client"
import type { InterviewGoalsResponse } from "@/api/models"
import type { CandidateGoals } from "@/lib/session-prompt"

export interface InterviewGoalsInput {
  targetRole: string
  targetDate: string
  yearsExperience: number | null
}

const interviewGoalsQueryKey = ["settings", "interview-goals"]

export function useInterviewGoals() {
  return useQuery({
    queryKey: interviewGoalsQueryKey,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/settings/interview-goals")
      if (error || !data) {
        throw new Error("Interview goals could not be loaded")
      }
      return data
    },
  })
}

export function useSaveInterviewGoals() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (goals: InterviewGoalsInput) => {
      const { data, error } = await api.PUT(
        "/api/v1/settings/interview-goals",
        {
          body: {
            target_role: goals.targetRole,
            target_date: goals.targetDate,
            years_experience: goals.yearsExperience,
          },
        }
      )
      if (error || !data) {
        throw new Error("Interview goals could not be saved")
      }
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(interviewGoalsQueryKey, data)
    },
  })
}

/** Adapts the API shape to the prompt builders' `CandidateGoals`. */
export function toCandidateGoals(
  data: InterviewGoalsResponse | undefined
): CandidateGoals | null {
  if (!data) {
    return null
  }
  return {
    targetRole: data.target_role,
    targetDate: data.target_date,
    yearsExperience: data.years_experience,
  }
}

export { interviewGoalsQueryKey }
