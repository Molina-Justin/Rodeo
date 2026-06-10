import { useMutation, useQueryClient } from "@tanstack/react-query"

import { api } from "@/api/client"

export function useExportWorkspace() {
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.GET("/api/v1/system/export")
      if (error || !data) {
        throw new Error("The export could not be prepared")
      }

      const blob = new Blob([JSON.stringify(data, null, 2)], {
        type: "application/json",
      })
      const url = URL.createObjectURL(blob)
      const link = document.createElement("a")
      link.href = url
      link.download = `rodeo-export-${data.generated_at.slice(0, 10)}.json`
      link.click()
      URL.revokeObjectURL(url)
    },
  })
}

export function useClearWorkspace() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/api/v1/system/clear")
      if (error || !data) {
        throw new Error("The workspace could not be cleared")
      }
      return data
    },
    onSuccess: () => queryClient.invalidateQueries(),
  })
}
