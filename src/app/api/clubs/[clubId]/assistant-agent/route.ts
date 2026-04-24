import { NextRequest, NextResponse } from "next/server"
import { requireClubApiAccess } from "@/lib/club-api-access"
import { runAssistantAgent } from "@/lib/assistant/agent"

type AccessError = Error & { status?: number }

export async function POST(request: NextRequest, { params }: { params: Promise<{ clubId: string }> }) {
    try {
        const { clubId } = await params
        await requireClubApiAccess(clubId)

        const body = await request.json().catch(() => null)
        const text = String(body?.text || "").trim()
        if (!text) return NextResponse.json({ error: "Пустой запрос" }, { status: 400 })

        const result = await runAssistantAgent(clubId, text, new Date())
        if (!result.ok) return NextResponse.json({ error: result.error, question: result.question }, { status: 400 })
        return NextResponse.json(result)
    } catch (error) {
        const status = (error as AccessError)?.status
        if (status) {
            return NextResponse.json({ error: status === 401 ? "Unauthorized" : "Forbidden" }, { status })
        }
        console.error("Assistant agent error:", error)
        return NextResponse.json({ error: "Internal Server Error" }, { status: 500 })
    }
}

