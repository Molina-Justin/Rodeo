import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"

import { api } from "@/api/client"

const backupStatusKey = ["system", "backups"] as const

export function useBackupStatus() {
  return useQuery({
    queryKey: backupStatusKey,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/system/backups")
      if (error || !data) {
        throw new Error("Backup status could not be loaded")
      }
      return data
    },
  })
}

export function useBackupNow() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async () => {
      const { data, error } = await api.POST("/api/v1/system/backups")
      if (error || !data) {
        throw new Error("The backup could not be created")
      }
      return data
    },
    onSuccess: (data) => queryClient.setQueryData(backupStatusKey, data),
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey: backupStatusKey })
      queryClient.invalidateQueries({
        queryKey: ["system", "backups", "files"],
      })
    },
  })
}

export function useBackupFiles(enabled: boolean) {
  return useQuery({
    queryKey: ["system", "backups", "files"] as const,
    enabled,
    queryFn: async () => {
      const { data, error } = await api.GET("/api/v1/system/backups/files")
      if (error || !data) {
        throw new Error("The backup list could not be loaded")
      }
      return data
    },
  })
}

export function useDeleteBackup() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (filename: string) => {
      const { data, error } = await api.DELETE(
        "/api/v1/system/backups/files/{filename}",
        { params: { path: { filename } } }
      )
      if (error || !data) {
        throw new Error("The backup could not be deleted")
      }
      return data
    },
    onSuccess: (data) => {
      queryClient.setQueryData(["system", "backups", "files"], data)
      queryClient.invalidateQueries({ queryKey: backupStatusKey })
    },
  })
}

export function useRestoreBackup() {
  return useMutation({
    mutationFn: async (filename: string) => {
      const { data, error } = await api.POST("/api/v1/system/backups/restore", {
        body: { filename },
      })
      if (error || !data) {
        throw new Error("The backup could not be restored")
      }
      return data
    },
  })
}

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
