export type RecruitmentQuestionType = "text" | "phone" | "email" | "choice" | "multi_choice" | "scale" | "boolean" | "repeatable_list"

export type RecruitmentChoiceOption = {
    id: string
    label: string
    points?: number
}

export type RecruitmentRepeatableFieldType = "text" | "phone" | "email"

export type RecruitmentRepeatableField = {
    id: string
    label: string
    type: RecruitmentRepeatableFieldType
    required?: boolean
}

export type RecruitmentScoreBand = {
    id: string
    min_score: number
    max_score: number
    label: string
    decision?: string
    description?: string
}

export type RecruitmentQuestionBase = {
    id: string
    type: RecruitmentQuestionType
    label: string
    section?: string
    description?: string
    image_url?: string
    required?: boolean
    points?: number
}

export type RecruitmentQuestion =
    | (RecruitmentQuestionBase & { type: "text" | "phone" | "email" })
    | (RecruitmentQuestionBase & { type: "choice"; options: RecruitmentChoiceOption[] })
    | (RecruitmentQuestionBase & { type: "multi_choice"; options: RecruitmentChoiceOption[] })
    | (RecruitmentQuestionBase & { type: "scale"; min?: number; max?: number })
    | (RecruitmentQuestionBase & { type: "boolean"; truePoints?: number; falsePoints?: number })
    | (RecruitmentQuestionBase & { type: "repeatable_list"; item_label?: string; fields: RecruitmentRepeatableField[] })

export type RecruitmentFormSection = {
    id: string
    title: string
    description?: string
    kind?: "default" | "repeatable"
    item_label?: string
    questions: RecruitmentQuestion[]
}

export type RecruitmentTemplateSchemaV1 = {
    version: 1
    candidate_photo_mode?: "off" | "optional" | "required"
    questions?: RecruitmentQuestion[]
    sections?: RecruitmentFormSection[]
    score_bands?: RecruitmentScoreBand[]
}

type ScoreResult = {
    score: number
    maxScore: number
}

function normalizeNumber(value: unknown) {
    if (typeof value === "number" && Number.isFinite(value)) return value
    if (typeof value === "string") {
        const n = Number(value)
        if (Number.isFinite(n)) return n
    }
    return null
}

export function getRecruitmentSchemaQuestions(schemaRaw: unknown): RecruitmentQuestion[] {
    const schema = schemaRaw as Partial<RecruitmentTemplateSchemaV1> | null
    if (Array.isArray(schema?.sections)) {
        return schema.sections.flatMap((section) => Array.isArray(section?.questions) ? section.questions : [])
    }
    return Array.isArray(schema?.questions) ? schema.questions : []
}

export function scoreRecruitmentAnswers(schemaRaw: unknown, answersRaw: unknown): ScoreResult {
    const questions = getRecruitmentSchemaQuestions(schemaRaw)
    const answers = (answersRaw && typeof answersRaw === "object") ? (answersRaw as Record<string, unknown>) : {}

    let score = 0
    let maxScore = 0

    for (const q of questions) {
        if (!q || typeof q !== "object") continue
        const id = (q as any).id as string | undefined
        const type = (q as any).type as RecruitmentQuestionType | undefined
        if (!id || !type) continue

        const ans = answers[id]

        if (type === "choice") {
            const options = Array.isArray((q as any).options) ? ((q as any).options as RecruitmentChoiceOption[]) : []
            const chosen = typeof ans === "string" ? ans : null
            const opt = chosen ? options.find(o => o?.id === chosen) : undefined
            const pts = typeof opt?.points === "number" ? opt.points : 0
            score += pts
            maxScore += Math.max(0, ...options.map(o => (typeof o?.points === "number" ? o.points : 0)))
            continue
        }

        if (type === "multi_choice") {
            const options = Array.isArray((q as any).options) ? ((q as any).options as RecruitmentChoiceOption[]) : []
            const chosen = Array.isArray(ans) ? ans.filter(v => typeof v === "string") as string[] : []
            const points = chosen
                .map(id => options.find(o => o?.id === id))
                .reduce((acc, opt) => acc + (typeof opt?.points === "number" ? opt.points : 0), 0)
            score += points
            const positive = options
                .map(o => (typeof o?.points === "number" ? o.points : 0))
                .filter(p => p > 0)
            maxScore += positive.reduce((a, b) => a + b, 0)
            continue
        }

        if (type === "scale") {
            const n = normalizeNumber(ans)
            const min = normalizeNumber((q as any).min) ?? 1
            const max = normalizeNumber((q as any).max) ?? 5
            const clamped = n === null ? null : Math.min(max, Math.max(min, n))
            const pts = clamped === null ? 0 : clamped
            score += pts
            maxScore += max
            continue
        }

        if (type === "boolean") {
            const val = typeof ans === "boolean" ? ans : (typeof ans === "string" ? (ans === "true") : null)
            const truePoints = normalizeNumber((q as any).truePoints) ?? normalizeNumber((q as any).points) ?? 0
            const falsePoints = normalizeNumber((q as any).falsePoints) ?? 0
            if (val === true) score += truePoints
            if (val === false) score += falsePoints
            maxScore += Math.max(truePoints, falsePoints)
            continue
        }

        if (type === "repeatable_list") continue

        const pts = normalizeNumber((q as any).points) ?? 0
        if (pts > 0 && (ans !== null && ans !== undefined && ans !== "")) {
            score += pts
        }
        maxScore += Math.max(0, pts)
    }

    return { score, maxScore }
}

export function calculateRecruitmentMaxScore(schemaRaw: unknown) {
    return scoreRecruitmentAnswers(schemaRaw, {}).maxScore
}

export function scorePercent(score: number, maxScore: number) {
    if (!Number.isFinite(score) || !Number.isFinite(maxScore) || maxScore <= 0) return 0
    const pct = Math.round((score / maxScore) * 100)
    return Math.min(100, Math.max(0, pct))
}

export function resolveScoreBand(schemaRaw: unknown, score: number): RecruitmentScoreBand | null {
    const schema = schemaRaw as Partial<RecruitmentTemplateSchemaV1> | null
    const bands = Array.isArray(schema?.score_bands) ? (schema!.score_bands as RecruitmentScoreBand[]) : []
    const scr = Number.isFinite(score) ? score : 0

    for (const b of bands) {
        if (!b) continue
        const min = normalizeNumber((b as any).min_score) ?? null
        const max = normalizeNumber((b as any).max_score) ?? null
        if (min === null || max === null) continue
        if (scr >= min && scr <= max) return b
    }

    return null
}

export function validateRecruitmentTestSchema(schemaRaw: unknown): string | null {
    const schema = schemaRaw as Partial<RecruitmentTemplateSchemaV1> | null
    const questions = getRecruitmentSchemaQuestions(schemaRaw)
    const maxScore = calculateRecruitmentMaxScore(schemaRaw)
    const bands = Array.isArray(schema?.score_bands) ? (schema!.score_bands as RecruitmentScoreBand[]) : []

    for (const q of questions) {
        if (!q || typeof q !== "object") continue
        const type = (q as any).type as RecruitmentQuestionType | undefined
        const label = String((q as any).label || "").trim()
        if (!label) return "У каждого вопроса должен быть текст"

        if (type === "choice" || type === "multi_choice") {
            const options = Array.isArray((q as any).options) ? ((q as any).options as RecruitmentChoiceOption[]) : []
            if (options.length < 2) return `У вопроса "${label}" должно быть минимум 2 варианта`
            for (const opt of options) {
                if (!String(opt?.label || "").trim()) return `У вопроса "${label}" есть пустой вариант ответа`
            }
        }

        if (type === "repeatable_list") {
            const fields = Array.isArray((q as any).fields) ? ((q as any).fields as RecruitmentRepeatableField[]) : []
            if (fields.length === 0) return `У вопроса "${label}" должен быть минимум 1 подпункт`
            for (const field of fields) {
                if (!String(field?.label || "").trim()) return `У вопроса "${label}" есть подпункт без названия`
            }
        }
    }

    if (bands.length === 0) return null
    if (maxScore <= 0) return "Нельзя задать диапазоны, пока в тесте нет балльных вопросов"

    const normalized = bands
        .map((b) => ({
            id: String((b as any).id || ""),
            min_score: normalizeNumber((b as any).min_score),
            max_score: normalizeNumber((b as any).max_score),
            label: String((b as any).label || "").trim()
        }))
        .sort((a, b) => (a.min_score ?? 0) - (b.min_score ?? 0))

    for (const band of normalized) {
        if (band.min_score === null || band.max_score === null) return "У диапазонов должны быть числовые границы"
        if (band.min_score < 0 || band.max_score < 0) return "Границы диапазонов не могут быть отрицательными"
        if (band.min_score > band.max_score) return "Минимальный балл диапазона не может быть больше максимального"
        if (band.max_score > maxScore) return `Максимальная граница диапазона не может быть больше максимума теста (${maxScore})`
        if (!band.label) return "У каждого диапазона должен быть результат"
    }

    if ((normalized[0]?.min_score ?? 0) !== 0) return "Диапазоны должны начинаться с 0"

    for (let i = 1; i < normalized.length; i++) {
        const prev = normalized[i - 1]
        const cur = normalized[i]
        if ((prev.max_score ?? 0) >= (cur.min_score ?? 0)) return "Диапазоны не должны пересекаться"
        if ((prev.max_score ?? 0) + 1 !== (cur.min_score ?? 0)) return "Между диапазонами не должно быть пропусков"
    }

    if ((normalized[normalized.length - 1]?.max_score ?? 0) !== maxScore) {
        return `Последний диапазон должен заканчиваться на максимуме теста (${maxScore})`
    }

    return null
}
