"use client"

import { useEffect } from "react"
import { useRouter } from "next/navigation"
import { useClubsDirectory } from "./directory-context"

export default function SuperAdminClubsIndexPage() {
  const router = useRouter()
  const { clubs, isLoading } = useClubsDirectory()

  useEffect(() => {
    if (isLoading) return
    if (clubs.length > 0) router.replace(`/super-admin/clubs/${clubs[0].id}`)
  }, [clubs, isLoading, router])

  return (
    <div className="p-6">
      <div className="rounded-lg border border-zinc-800 bg-zinc-950 px-4 py-10 text-center text-sm text-zinc-500">
        Выберите клуб слева
      </div>
    </div>
  )
}

