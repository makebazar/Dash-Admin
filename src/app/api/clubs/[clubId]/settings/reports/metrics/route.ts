import { NextResponse } from 'next/server'
import { cookies } from 'next/headers'
import { query } from '@/db'
import { ensureOwnerSubscriptionActive } from '@/lib/club-subscription-guard'

const ALLOWED_TYPES = new Set(['MONEY', 'NUMBER', 'TEXT', 'BOOLEAN'])
const ALLOWED_CATEGORIES = new Set(['FINANCE', 'OPERATIONS', 'MARKETING'])

function slugifyMetricKey(value: string) {
    return value
        .toLowerCase()
        .trim()
        .replace(/[^a-z0-9а-яё]+/gi, '_')
        .replace(/^_+|_+$/g, '')
        .replace(/_+/g, '_')
}

export async function POST(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value
        const { clubId } = await params

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        const { label, type, category, description } = await request.json()

        const safeLabel = String(label || '').trim()
        const safeType = String(type || '').trim().toUpperCase()
        const safeCategory = String(category || '').trim().toUpperCase()
        const safeDescription = String(description || '').trim()

        if (!safeLabel) {
            return NextResponse.json({ error: 'Название метрики обязательно' }, { status: 400 })
        }

        if (!ALLOWED_TYPES.has(safeType)) {
            return NextResponse.json({ error: 'Некорректный тип метрики' }, { status: 400 })
        }

        if (!ALLOWED_CATEGORIES.has(safeCategory)) {
            return NextResponse.json({ error: 'Некорректная категория метрики' }, { status: 400 })
        }

        const baseKey = slugifyMetricKey(safeLabel)
        if (!baseKey) {
            return NextResponse.json({ error: 'Не удалось сгенерировать ключ метрики' }, { status: 400 })
        }

        let metricKey = baseKey
        let suffix = 2

        while (true) {
            const existing = await query(
                `SELECT 1
                 FROM system_metrics
                 WHERE key = $1
                 UNION
                 SELECT 1
                 FROM club_custom_metrics
                 WHERE club_id = $2 AND key = $1
                 LIMIT 1`,
                [metricKey, clubId]
            )

            if ((existing.rowCount || 0) === 0) break
            metricKey = `${baseKey}_${suffix}`
            suffix += 1
        }

        const result = await query(
            `INSERT INTO club_custom_metrics (club_id, key, label, description, type, category, created_by)
             VALUES ($1, $2, $3, $4, $5, $6, $7)
             RETURNING id, key, label, description, type, category, is_required, TRUE as is_custom`,
            [clubId, metricKey, safeLabel, safeDescription || null, safeType, safeCategory, userId]
        )

        return NextResponse.json({ metric: result.rows[0] })
    } catch (error) {
        console.error('Create Club Metric Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}

export async function DELETE(
    request: Request,
    { params }: { params: Promise<{ clubId: string }> }
) {
    try {
        const userId = (await cookies()).get('session_user_id')?.value
        const { clubId } = await params

        if (!userId) {
            return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
        }

        const guard = await ensureOwnerSubscriptionActive(clubId, userId)
        if (!guard.ok) return guard.response

        const { metricId } = await request.json()
        const safeMetricId = String(metricId || '').trim()
        if (!safeMetricId) {
            return NextResponse.json({ error: 'Не передан ID метрики' }, { status: 400 })
        }

        const metricResult = await query(
            `SELECT id, key, label
             FROM club_custom_metrics
             WHERE id::text = $1 AND club_id = $2 AND is_active = TRUE
             LIMIT 1`,
            [safeMetricId, clubId]
        )

        if ((metricResult.rowCount || 0) === 0) {
            return NextResponse.json({ error: 'Метрика не найдена' }, { status: 404 })
        }

        const metric = metricResult.rows[0]

        const usedInActiveTemplate = await query(
            `SELECT 1
             FROM club_report_templates crt
             WHERE crt.club_id = $1
               AND crt.is_active = TRUE
               AND EXISTS (
                 SELECT 1
                 FROM jsonb_array_elements(crt.schema) AS item
                 WHERE item->>'metric_key' = $2
               )
             LIMIT 1`,
            [clubId, metric.key]
        )

        if ((usedInActiveTemplate.rowCount || 0) > 0) {
            return NextResponse.json(
                { error: 'Сначала уберите эту метрику из структуры отчета, потом сможете ее удалить' },
                { status: 409 }
            )
        }

        await query(
            `UPDATE club_custom_metrics
             SET is_active = FALSE, updated_at = NOW()
             WHERE id = $1`,
            [metric.id]
        )

        return NextResponse.json({ success: true, metricId: metric.id, metricKey: metric.key })
    } catch (error) {
        console.error('Delete Club Metric Error:', error)
        return NextResponse.json({ error: 'Internal Server Error' }, { status: 500 })
    }
}
