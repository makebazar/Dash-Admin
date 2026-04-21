"use client"

import React, { useCallback, useContext, useEffect, useMemo, useState } from "react"

export interface DirectoryUser {
  id: string
  full_name: string
  phone_number: string
  is_super_admin: boolean
}

export interface ClubEmployee {
  id: string
  full_name: string
  phone_number: string
  role: string
  hired_at: string
  is_primary?: boolean
}

export interface ClubOwner {
  id: string
  full_name: string
  phone_number: string
  is_primary: boolean
}

export interface ClubItem {
  id: number
  public_id: string | null
  name: string
  address: string | null
  created_at: string
  owners: ClubOwner[]
  employees: ClubEmployee[]
}

type ClubsDirectoryState = {
  clubs: ClubItem[]
  users: DirectoryUser[]
  isLoading: boolean
  error: string | null
  refetch: () => Promise<void>
}

const ClubsDirectoryContext = React.createContext<ClubsDirectoryState | null>(null)

export function useClubsDirectory() {
  const ctx = useContext(ClubsDirectoryContext)
  if (!ctx) throw new Error("useClubsDirectory must be used within ClubsDirectoryProvider")
  return ctx
}

export function ClubsDirectoryProvider({ children }: { children: React.ReactNode }) {
  const [clubs, setClubs] = useState<ClubItem[]>([])
  const [users, setUsers] = useState<DirectoryUser[]>([])
  const [isLoading, setIsLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)

  const refetch = useCallback(async () => {
    setIsLoading(true)
    setError(null)
    try {
      const res = await fetch("/api/super-admin/clubs")
      const data = await res.json().catch(() => ({}))
      if (!res.ok) {
        setError(data?.error || "Не удалось загрузить клубы")
        setClubs([])
        setUsers([])
        return
      }
      setClubs(Array.isArray(data?.clubs) ? data.clubs : [])
      setUsers(Array.isArray(data?.users) ? data.users : [])
    } catch {
      setError("Не удалось загрузить клубы")
      setClubs([])
      setUsers([])
    } finally {
      setIsLoading(false)
    }
  }, [])

  useEffect(() => {
    refetch()
  }, [refetch])

  const value = useMemo(
    () => ({ clubs, users, isLoading, error, refetch }),
    [clubs, users, isLoading, error, refetch]
  )

  return <ClubsDirectoryContext.Provider value={value}>{children}</ClubsDirectoryContext.Provider>
}

