import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/api/client"

type PromptTemplateKey = "session" | "review"

const promptTemplatesQueryKey = ["settings", "prompt-templates"]

export function usePromptTemplates() {
  return useQuery({
    queryKey: promptTemplatesQueryKey,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/settings/prompt-templates")
      if (error || !data) {
        throw new Error("Prompt templates could not be loaded")
      }
      return data
    },
  })
}

export function useSavePromptTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async ({
      templateKey,
      template,
    }: {
      templateKey: PromptTemplateKey
      template: string
    }) => {
      const { data, error } = await api.PUT(
        "/api/v1/settings/prompt-templates/{template_key}",
        {
          params: { path: { template_key: templateKey } },
          body: { template },
        }
      )
      if (error || !data) {
        throw new Error("Prompt template could not be saved")
      }
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(promptTemplatesQueryKey, data)
    },
  })
}

export function useResetPromptTemplate() {
  const queryClient = useQueryClient()

  return useMutation({
    mutationFn: async (templateKey: PromptTemplateKey) => {
      const { data, error } = await api.DELETE(
        "/api/v1/settings/prompt-templates/{template_key}",
        { params: { path: { template_key: templateKey } } }
      )
      if (error || !data) {
        throw new Error("Prompt template could not be reset")
      }
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(promptTemplatesQueryKey, data)
    },
  })
}

export { promptTemplatesQueryKey }
