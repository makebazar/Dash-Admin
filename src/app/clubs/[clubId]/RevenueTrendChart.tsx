"use client"

import { useMemo, useState } from "react"
import { useRouter, usePathname } from "next/navigation"
import Link from "next/link"
import { ArrowRight } from "lucide-react"
import { cn } from "@/lib/utils"

type RawRevenuePoint = {
    date: string
    revenue: number
    receiptsCount: number
    metrics?: Record<string, number>
}

type RevenuePoint = {
    date: string
    revenue: number
    isForecast?: boolean
}

type ChartPoint = RevenuePoint & {
    x: number
    y: number
}

interface RevenueTrendChartProps {
    currentData: RawRevenuePoint[]
    previousData: RawRevenuePoint[]
    days: number
    clubId: string
    metricMeta: Record<string, { category: string; label: string }>
}

const chartWidth = 920
const chartHeight = 280
const chartPaddingTop = 16
const chartPaddingRight = 72
const chartPaddingBottom = 36
const chartPaddingLeft = 8
const chartPlotWidth = chartWidth - chartPaddingLeft - chartPaddingRight
const chartPlotHeight = chartHeight - chartPaddingTop - chartPaddingBottom

const currencyFormatter = new Intl.NumberFormat("ru-RU", {
    maximumFractionDigits: 0,
})

const compactCurrencyFormatter = new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
})

function formatCurrency(value: number) {
    const safeValue = Number.isFinite(value) ? value : 0
    return `${currencyFormatter.format(Math.round(safeValue))} ₽`
}

function formatCompactCurrency(value: number) {
    const safeValue = Number.isFinite(value) ? value : 0
    return `${compactCurrencyFormatter.format(safeValue)} ₽`
}

function formatSignedPercent(value: number) {
    const safeValue = Number.isFinite(value) ? value : 0
    const sign = safeValue > 0 ? "+" : ""
    return `${sign}${safeValue.toFixed(1)}%`
}

function formatDate(value: string | Date) {
    if (!value) return ""
    if (value instanceof Date) {
        return value.toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "short",
        })
    }

    if (typeof value === "string" && value.includes("-")) {
        const [year, month, day] = value.split("-").map(Number)
        return new Date(year, (month || 1) - 1, day || 1).toLocaleDateString("ru-RU", {
            day: "2-digit",
            month: "short",
        })
    }

    return new Date(value).toLocaleDateString("ru-RU", {
        day: "2-digit",
        month: "short",
    })
}

function buildSmoothLinePath(points: ChartPoint[], baselineY?: number) {
    if (points.length === 0) return ""

    if (points.length === 1) {
        if (typeof baselineY === "number") {
            return [
                `M ${points[0].x} ${baselineY}`,
                `L ${points[0].x} ${points[0].y}`,
                `L ${points[0].x} ${baselineY}`,
                "Z",
            ].join(" ")
        }

        return `M ${points[0].x} ${points[0].y}`
    }

    const lineCommands = [`M ${points[0].x} ${points[0].y}`]

    for (let index = 0; index < points.length - 1; index += 1) {
        const previous = points[index - 1] || points[index]
        const current = points[index]
        const next = points[index + 1]
        const nextNext = points[index + 2] || next

        const controlPoint1X = current.x + (next.x - previous.x) / 6
        const controlPoint1Y = current.y + (next.y - previous.y) / 6
        const controlPoint2X = next.x - (nextNext.x - current.x) / 6
        const controlPoint2Y = next.y - (nextNext.y - current.y) / 6

        lineCommands.push(
            `C ${controlPoint1X} ${controlPoint1Y} ${controlPoint2X} ${controlPoint2Y} ${next.x} ${next.y}`
        )
    }

    if (typeof baselineY !== "number") {
        return lineCommands.join(" ")
    }

    return [
        `M ${points[0].x} ${baselineY}`,
        `L ${points[0].x} ${points[0].y}`,
        ...lineCommands.slice(1),
        `L ${points[points.length - 1].x} ${baselineY}`,
        "Z",
    ].join(" ")
}

function buildChartPoints(points: RevenuePoint[], maxRevenue: number, xAxisLength: number): ChartPoint[] {
    return points.map((point, index) => {
        const x = xAxisLength > 1
            ? chartPaddingLeft + (index / (xAxisLength - 1)) * chartPlotWidth
            : chartPaddingLeft
        const y = chartPaddingTop + chartPlotHeight - (point.revenue / maxRevenue) * chartPlotHeight

        return {
            ...point,
            x,
            y,
        }
    })
}

export default function RevenueTrendChart({
    currentData,
    previousData,
    days,
    clubId,
    metricMeta,
}: RevenueTrendChartProps) {
    const router = useRouter()
    const pathname = usePathname()

    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [pinnedIndex, setPinnedIndex] = useState<number | null>(null)
    const [activeMetric, setActiveMetric] = useState<'revenue' | 'averageCheck' | 'receiptsCount'>('revenue')
    const [chartMode, setChartMode] = useState<'daily' | 'cumulative'>('daily')
    const [activeRevenueSubMetric, setActiveRevenueSubMetric] = useState<string>('total')

    // Whether average check makes sense for the current selection
    const showAverageCheck = activeRevenueSubMetric === 'total'

    // Mouse Drag-to-Scroll & Horizontal Wheel Scroll Handlers (No React state changes for 60fps)
    const handleDragStart = (e: React.MouseEvent<HTMLDivElement>) => {
        const container = e.currentTarget
        container.setAttribute('data-down', 'true')
        container.setAttribute('data-startx', String(e.pageX - container.offsetLeft))
        container.setAttribute('data-scrollleft', String(container.scrollLeft))
    }

    const handleDragEnd = (e: React.MouseEvent<HTMLDivElement>) => {
        e.currentTarget.removeAttribute('data-down')
    }

    const handleDragMove = (e: React.MouseEvent<HTMLDivElement>) => {
        const container = e.currentTarget
        if (container.getAttribute('data-down') !== 'true') return
        e.preventDefault()
        const startX = Number(container.getAttribute('data-startx') || '0')
        const scrollLeft = Number(container.getAttribute('data-scrollleft') || '0')
        const x = e.pageX - container.offsetLeft
        const walk = (x - startX) * 1.5
        container.scrollLeft = scrollLeft - walk
    }

    const handleWheelScroll = (e: React.WheelEvent<HTMLDivElement>) => {
        if (e.deltaY !== 0) {
            e.currentTarget.scrollLeft += e.deltaY
        }
    }

    // Find available sub-metrics present in the data dictionary
    const availableSubMetrics = useMemo(() => {
        const keys = new Set<string>()
        currentData.forEach(item => {
            if (item.metrics) {
                Object.keys(item.metrics).forEach(k => keys.add(k))
            }
        })
        previousData.forEach(item => {
            if (item.metrics) {
                Object.keys(item.metrics).forEach(k => keys.add(k))
            }
        })

        const EXCLUDED_KEYS = new Set([
            'actual_cash',
            'cash_diff',
            'expenses',
            'expenses_cash',
            'bonuses',
            'receipts_count',
            'shift_comment',
            'comment',
            'non_revenue'
        ])

        return Array.from(keys).map(key => {
            const meta = metricMeta[key]
            const label = meta?.label || key
            const category = meta?.category || 'OTHER'
            let suffix = ''
            if (category === 'EXPENSE') suffix = ' (расход)'
            return { key, label: label + suffix, rawLabel: label, category }
        })
        .filter(item => {
            if (item.category === 'EXPENSE') return false
            if (EXCLUDED_KEYS.has(item.key.toLowerCase())) return false
            const keyLower = item.key.toLowerCase()
            if (keyLower.includes('comment')) return false
            if (keyLower.includes('diff')) return false
            if (keyLower.includes('actual')) return false
            if (keyLower.includes('expense')) return false
            return true
        })
        .sort((a, b) => a.rawLabel.localeCompare(b.rawLabel))
    }, [currentData, previousData, metricMeta])

    // Helper to extract active revenue depending on metric variable selection
    const getActiveRevenue = (item: RawRevenuePoint) => {
        if (activeMetric === 'revenue' && activeRevenueSubMetric !== 'total') {
            return item.metrics?.[activeRevenueSubMetric] || 0
        }
        return item.revenue
    }

    // 1. KPI Calculations (using like-for-like MTD slice for previous month to make comparison fair)
    const currentRevenueTotal = useMemo(() => {
        return currentData.reduce((sum, item) => sum + getActiveRevenue(item), 0)
    }, [currentData, activeMetric, activeRevenueSubMetric])
    
    // Slice previousData to match MTD length of current month
    const previousDataMTD = useMemo(() => previousData.slice(0, currentData.length), [previousData, currentData])
    const previousRevenueTotalMTD = useMemo(() => {
        return previousDataMTD.reduce((sum, item) => sum + getActiveRevenue(item), 0)
    }, [previousDataMTD, activeMetric, activeRevenueSubMetric])
    const previousRevenueTotal = useMemo(() => {
        return previousData.reduce((sum, item) => sum + getActiveRevenue(item), 0)
    }, [previousData, activeMetric, activeRevenueSubMetric]) // Full previous month total

    const revenueChange = useMemo(() => {
        return previousRevenueTotalMTD > 0
            ? ((currentRevenueTotal - previousRevenueTotalMTD) / previousRevenueTotalMTD) * 100
            : 0
    }, [currentRevenueTotal, previousRevenueTotalMTD])

    const currentReceiptsTotal = useMemo(() => currentData.reduce((sum, item) => sum + item.receiptsCount, 0), [currentData])
    const previousReceiptsTotalMTD = useMemo(() => previousDataMTD.reduce((sum, item) => sum + item.receiptsCount, 0), [previousDataMTD])
    const previousReceiptsTotal = useMemo(() => previousData.reduce((sum, item) => sum + item.receiptsCount, 0), [previousData]) // Full previous month total

    const receiptsChange = useMemo(() => {
        return previousReceiptsTotalMTD > 0
            ? ((currentReceiptsTotal - previousReceiptsTotalMTD) / previousReceiptsTotalMTD) * 100
            : 0
    }, [currentReceiptsTotal, previousReceiptsTotalMTD])

    const currentAverageCheck = useMemo(() => {
        return currentReceiptsTotal > 0 ? currentRevenueTotal / currentReceiptsTotal : 0
    }, [currentRevenueTotal, currentReceiptsTotal])
    const previousAverageCheckMTD = useMemo(() => {
        return previousReceiptsTotalMTD > 0 ? previousRevenueTotalMTD / previousReceiptsTotalMTD : 0
    }, [previousRevenueTotalMTD, previousReceiptsTotalMTD])
    const previousAverageCheck = useMemo(() => {
        return previousReceiptsTotal > 0 ? previousRevenueTotal / previousReceiptsTotal : 0
    }, [previousRevenueTotal, previousReceiptsTotal]) // Full previous month avg check

    const averageCheckChange = useMemo(() => {
        return previousAverageCheckMTD > 0
            ? ((currentAverageCheck - previousAverageCheckMTD) / previousAverageCheckMTD) * 100
            : 0
    }, [currentAverageCheck, previousAverageCheckMTD])

    // 2. Days in month and X-axis scale length
    const totalDaysInCurrentMonth = useMemo(() => {
        if (currentData.length === 0) return 30
        const firstPointDate = new Date(currentData[0].date)
        const year = firstPointDate.getFullYear()
        const month = firstPointDate.getMonth()
        return new Date(year, month + 1, 0).getDate()
    }, [currentData])

    const xAxisLength = days === 7 ? currentData.length : totalDaysInCurrentMonth

    // 3. Weekday-weighted forecast logic
    const forecastStats = useMemo(() => {
        if (days === 7 || currentData.length === 0) {
            return {
                forecastedRevenue: 0,
                forecastedAverageCheck: 0,
                forecastedReceiptsCount: 0,
                forecastRevDaily: [],
                forecastRecDaily: [],
                forecastCheckDaily: []
            }
        }

        // Group MTD by weekday
        const weekdayRevenues: Record<number, number[]> = {}
        const weekdayReceipts: Record<number, number[]> = {}
        for (let i = 0; i < 7; i++) {
            weekdayRevenues[i] = []
            weekdayReceipts[i] = []
        }
        currentData.forEach(item => {
            const date = new Date(item.date)
            const w = date.getDay()
            weekdayRevenues[w].push(getActiveRevenue(item))
            weekdayReceipts[w].push(item.receiptsCount)
        })

        // Group previous full month by weekday for fallbacks
        const prevWeekdayRevenues: Record<number, number[]> = {}
        const prevWeekdayReceipts: Record<number, number[]> = {}
        for (let i = 0; i < 7; i++) {
            prevWeekdayRevenues[i] = []
            prevWeekdayReceipts[i] = []
        }
        previousData.forEach(item => {
            const date = new Date(item.date)
            const w = date.getDay()
            prevWeekdayRevenues[w].push(getActiveRevenue(item))
            prevWeekdayReceipts[w].push(item.receiptsCount)
        })

        // Compute averages per weekday
        const avgRevenues: Record<number, number> = {}
        const avgReceipts: Record<number, number> = {}
        for (let i = 0; i < 7; i++) {
            if (weekdayRevenues[i].length > 0) {
                avgRevenues[i] = weekdayRevenues[i].reduce((sum, v) => sum + v, 0) / weekdayRevenues[i].length
            } else if (prevWeekdayRevenues[i].length > 0) {
                avgRevenues[i] = prevWeekdayRevenues[i].reduce((sum, v) => sum + v, 0) / prevWeekdayRevenues[i].length
            } else {
                avgRevenues[i] = 0
            }

            if (weekdayReceipts[i].length > 0) {
                avgReceipts[i] = weekdayReceipts[i].reduce((sum, v) => sum + v, 0) / weekdayReceipts[i].length
            } else if (prevWeekdayReceipts[i].length > 0) {
                avgReceipts[i] = prevWeekdayReceipts[i].reduce((sum, v) => sum + v, 0) / prevWeekdayReceipts[i].length
            } else {
                avgReceipts[i] = 0
            }
        }

        // Project remaining days
        const lastPointDate = new Date(currentData[currentData.length - 1].date)
        const year = lastPointDate.getFullYear()
        const month = lastPointDate.getMonth()

        let forecastedRevenueSum = currentRevenueTotal
        let forecastedReceiptsSum = currentReceiptsTotal

        const forecastRevDaily: number[] = []
        const forecastCheckDaily: number[] = []
        const forecastRecDaily: number[] = []

        for (let index = currentData.length; index < totalDaysInCurrentMonth; index++) {
            const date = new Date(year, month, index + 1)
            const w = date.getDay()
            const rev = avgRevenues[w]
            const rec = avgReceipts[w]

            forecastedRevenueSum += rev
            forecastedReceiptsSum += rec

            forecastRevDaily.push(rev)
            forecastRecDaily.push(rec)
            forecastCheckDaily.push(rec > 0 ? rev / rec : 0)
        }

        const forecastedAverageCheck = forecastedReceiptsSum > 0 ? forecastedRevenueSum / forecastedReceiptsSum : 0

        return {
            forecastedRevenue: forecastedRevenueSum,
            forecastedAverageCheck,
            forecastedReceiptsCount: forecastedReceiptsSum,
            forecastRevDaily,
            forecastRecDaily,
            forecastCheckDaily
        }
    }, [days, currentData, previousData, currentRevenueTotal, currentReceiptsTotal, activeMetric, activeRevenueSubMetric])

    // 4. Calculate active current trend data (daily or cumulative)
    const activeCurrentData = useMemo(() => {
        let accumulatedRevenue = 0
        let accumulatedReceipts = 0

        return Array.from({ length: xAxisLength }, (_, index) => {
            let dailyRev = 0
            let dailyRec = 0
            let isForecast = false
            let dateString = ""

            if (index < currentData.length) {
                // Actual day
                const item = currentData[index]
                dailyRev = getActiveRevenue(item)
                dailyRec = item.receiptsCount
                dateString = item.date
            } else {
                // Forecast day
                isForecast = true
                const fIndex = index - currentData.length
                dailyRev = forecastStats.forecastRevDaily[fIndex] || 0
                dailyRec = forecastStats.forecastRecDaily[fIndex] || 0

                const lastPointDate = new Date(currentData[currentData.length - 1].date)
                const date = new Date(lastPointDate.getFullYear(), lastPointDate.getMonth(), index + 1)
                dateString = date.toISOString().split('T')[0]
            }

            accumulatedRevenue += dailyRev
            accumulatedReceipts += dailyRec

            let val = 0
            if (chartMode === 'daily') {
                if (activeMetric === 'revenue') {
                    val = dailyRev
                } else if (activeMetric === 'averageCheck') {
                    val = dailyRec > 0 ? dailyRev / dailyRec : 0
                } else if (activeMetric === 'receiptsCount') {
                    val = dailyRec
                }
            } else {
                // cumulative
                if (activeMetric === 'revenue') {
                    val = accumulatedRevenue
                } else if (activeMetric === 'averageCheck') {
                    val = accumulatedReceipts > 0 ? accumulatedRevenue / accumulatedReceipts : 0
                } else if (activeMetric === 'receiptsCount') {
                    val = accumulatedReceipts
                }
            }

            return { date: dateString, revenue: val, isForecast }
        })
    }, [currentData, activeMetric, chartMode, forecastStats, xAxisLength, activeRevenueSubMetric])

    // 5. Calculate active previous trend data (daily or cumulative)
    const activePreviousData = useMemo(() => {
        let accumulatedRevenue = 0
        let accumulatedReceipts = 0

        return previousData.map((item) => {
            const dailyRev = getActiveRevenue(item)
            accumulatedRevenue += dailyRev
            accumulatedReceipts += item.receiptsCount

            let val = 0
            if (chartMode === 'daily') {
                if (activeMetric === 'revenue') {
                    val = dailyRev
                } else if (activeMetric === 'averageCheck') {
                    val = item.receiptsCount > 0 ? dailyRev / item.receiptsCount : 0
                } else if (activeMetric === 'receiptsCount') {
                    val = item.receiptsCount
                }
            } else {
                // cumulative
                if (activeMetric === 'revenue') {
                    val = accumulatedRevenue
                } else if (activeMetric === 'averageCheck') {
                    val = accumulatedReceipts > 0 ? accumulatedRevenue / accumulatedReceipts : 0
                } else if (activeMetric === 'receiptsCount') {
                    val = accumulatedReceipts
                }
            }

            return { date: item.date, revenue: val }
        })
    }, [previousData, activeMetric, chartMode, activeRevenueSubMetric])

    // 7. Scale max bounds and axis ticks
    const maxRevenue = useMemo(() => {
        return Math.max(
            ...activeCurrentData.map(item => item.revenue),
            ...activePreviousData.map(item => item.revenue),
            1
        )
    }, [activeCurrentData, activePreviousData])

    const revenueScaleTicks = useMemo(() => {
        return [1, 0.75, 0.5, 0.25, 0].map(multiplier => Math.round(maxRevenue * multiplier))
    }, [maxRevenue])

    // 8. Generate exact chart coordinates
    const currentRevenueChartPoints = useMemo(() => buildChartPoints(activeCurrentData, maxRevenue, xAxisLength), [activeCurrentData, maxRevenue, xAxisLength])
    const previousRevenueChartPoints = useMemo(() => buildChartPoints(activePreviousData, maxRevenue, xAxisLength), [activePreviousData, maxRevenue, xAxisLength])

    // Split current curve into solid (actual) and dashed (forecast) segments
    const actualPoints = useMemo(() => currentRevenueChartPoints.slice(0, currentData.length), [currentRevenueChartPoints, currentData])
    const forecastPoints = useMemo(() => currentRevenueChartPoints.slice(Math.max(0, currentData.length - 1)), [currentRevenueChartPoints, currentData])

    const revenueLinePath = useMemo(() => buildSmoothLinePath(actualPoints), [actualPoints])
    const forecastLinePath = useMemo(() => days === 30 ? buildSmoothLinePath(forecastPoints) : "", [forecastPoints, days])
    
    const previousRevenueLinePath = useMemo(() => buildSmoothLinePath(previousRevenueChartPoints), [previousRevenueChartPoints])
    const revenueAreaPath = useMemo(
        () => buildSmoothLinePath(actualPoints, chartPaddingTop + chartPlotHeight),
        [actualPoints]
    )

    const activeIndex = hoveredIndex ?? pinnedIndex
    const activeCurrentPoint = activeIndex !== null ? currentRevenueChartPoints[activeIndex] : null
    const activePreviousPoint = activeIndex !== null ? previousRevenueChartPoints[activeIndex] : null
    const isForecastPoint = activeIndex !== null && activeIndex >= currentData.length

    const tooltip = useMemo(() => {
        if (!activeCurrentPoint) return null

        const tooltipWidth = 180
        const tooltipHeight = 58
        const anchorY = Math.min(activeCurrentPoint.y, activePreviousPoint?.y ?? activeCurrentPoint.y)
        const x = Math.min(
            Math.max(activeCurrentPoint.x - tooltipWidth / 2, chartPaddingLeft + 4),
            chartWidth - chartPaddingRight - tooltipWidth + 20
        )
        const y = Math.max(chartPaddingTop + 4, anchorY - tooltipHeight - 12)

        return {
            x,
            y,
            width: tooltipWidth,
            height: tooltipHeight,
        }
    }, [activeCurrentPoint, activePreviousPoint])

    const interactionBands = useMemo(() => {
        return currentRevenueChartPoints.map((point, index) => {
            const previousPoint = currentRevenueChartPoints[index - 1]
            const nextPoint = currentRevenueChartPoints[index + 1]
            const leftBoundary = previousPoint ? (previousPoint.x + point.x) / 2 : chartPaddingLeft
            const rightBoundary = nextPoint ? (nextPoint.x + point.x) / 2 : chartPaddingLeft + chartPlotWidth

            return {
                index,
                x: leftBoundary,
                width: rightBoundary - leftBoundary,
            }
        })
    }, [currentRevenueChartPoints, chartPlotWidth])

    const handleDaysChange = (newDays: number) => {
        router.push(`${pathname}?days=${newDays}`)
    }

    function formatMetricValue(val: number) {
        if (activeMetric === 'receiptsCount') {
            return `${Math.round(val)} шт.`
        }
        return formatCurrency(val)
    }

    function formatCompactMetricValue(val: number) {
        if (activeMetric === 'receiptsCount') {
            return `${Math.round(val)} шт.`
        }
        return formatCompactCurrency(val)
    }

    return (
        <section className="flex flex-col gap-6">
            {/* Header: Title + Period Selector */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between mb-2">
                <h2 className="text-2xl font-bold tracking-tight text-slate-900">Финансы за период</h2>
                <div className="flex items-center justify-between sm:justify-end gap-4 w-full sm:w-auto">
                    <div className="flex bg-slate-100 p-0.5 rounded-lg text-xs font-semibold">
                        <button
                            onClick={() => handleDaysChange(7)}
                            className={cn(
                                "px-3 py-1.5 rounded-md transition-all cursor-pointer",
                                days === 7
                                    ? "bg-white text-slate-900 shadow-xs"
                                    : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            7 дней
                        </button>
                        <button
                            onClick={() => handleDaysChange(30)}
                            className={cn(
                                "px-3 py-1.5 rounded-md transition-all cursor-pointer",
                                days === 30
                                    ? "bg-white text-slate-900 shadow-xs"
                                    : "text-slate-500 hover:text-slate-900"
                            )}
                        >
                            30 дней
                        </button>
                    </div>
                    <Link
                        href={`/clubs/${clubId}/shifts`}
                        className="group flex items-center justify-center sm:justify-start text-sm font-medium text-slate-500 hover:text-black transition-colors"
                    >
                        Все смены{" "}
                        <ArrowRight className="ml-1 h-4 w-4 transition-transform group-hover:translate-x-1" />
                    </Link>
                </div>
            </div>

            <div className="flex flex-col gap-6">
                {/* Top Row: Horizontal KPI Cards Grid */}
                <div className={cn(
                    "grid gap-4 w-full",
                    days === 30 && showAverageCheck 
                        ? "grid-cols-1 sm:grid-cols-2 lg:grid-cols-4" 
                        : (days === 30 || showAverageCheck)
                            ? "grid-cols-1 sm:grid-cols-3"
                            : "grid-cols-1 sm:grid-cols-2"
                )}>
                    {/* Card 1: Revenue */}
                    <button
                        onClick={() => setActiveMetric('revenue')}
                        className={cn(
                            "w-full text-left border-l-2 pl-6 py-2.5 transition-all cursor-pointer focus:outline-hidden rounded-r-xl",
                            activeMetric === 'revenue' 
                                ? "border-black bg-slate-50/70 shadow-xs" 
                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/30"
                        )}
                    >
                        <p className="text-xs uppercase font-semibold tracking-wider text-slate-400 mb-1">Выручка</p>
                        <p className="text-[2.2rem] leading-none font-bold tracking-tighter text-slate-900 mb-1.5">
                            {formatCurrency(currentRevenueTotal)}
                        </p>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span
                                className={cn(
                                    "text-sm font-semibold",
                                    revenueChange >= 0 ? "text-emerald-600" : "text-rose-600"
                                )}
                            >
                                {formatSignedPercent(revenueChange)}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                                к прошлому периоду (было {formatCurrency(previousRevenueTotalMTD)})
                            </span>
                        </div>
                    </button>

                    {/* Card 2: Average Check (hidden when sub-metric selected) */}
                    {showAverageCheck && (
                    <button
                        onClick={() => setActiveMetric('averageCheck')}
                        className={cn(
                            "w-full text-left border-l-2 pl-6 py-2.5 transition-all cursor-pointer focus:outline-hidden rounded-r-xl",
                            activeMetric === 'averageCheck' 
                                ? "border-black bg-slate-50/70 shadow-xs" 
                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/30"
                        )}
                    >
                        <p className="text-xs uppercase font-semibold tracking-wider text-slate-400 mb-1">Средний чек</p>
                        <p className="text-[2.2rem] leading-none font-bold tracking-tighter text-slate-900 mb-1.5">
                            {formatCurrency(currentAverageCheck)}
                        </p>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span
                                className={cn(
                                    "text-sm font-semibold",
                                    averageCheckChange >= 0 ? "text-emerald-600" : "text-rose-600"
                                )}
                            >
                                {formatSignedPercent(averageCheckChange)}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                                к прошлому периоду (было {formatCurrency(previousAverageCheckMTD)})
                            </span>
                        </div>
                    </button>
                    )}

                    {/* Card 3: Receipts Count */}
                    <button
                        onClick={() => setActiveMetric('receiptsCount')}
                        className={cn(
                            "w-full text-left border-l-2 pl-6 py-2.5 transition-all cursor-pointer focus:outline-hidden rounded-r-xl",
                            activeMetric === 'receiptsCount' 
                                ? "border-black bg-slate-50/70 shadow-xs" 
                                : "border-slate-200 hover:border-slate-300 hover:bg-slate-50/30"
                        )}
                    >
                        <p className="text-xs uppercase font-semibold tracking-wider text-slate-400 mb-1">Чеки</p>
                        <p className="text-[2.2rem] leading-none font-bold tracking-tighter text-slate-900 mb-1.5">
                            {Math.round(currentReceiptsTotal)} шт.
                        </p>
                        <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                            <span
                                className={cn(
                                    "text-sm font-semibold",
                                    receiptsChange >= 0 ? "text-emerald-600" : "text-rose-600"
                                )}
                            >
                                {formatSignedPercent(receiptsChange)}
                            </span>
                            <span className="text-xs text-slate-400 font-medium">
                                к прошлому периоду (было {Math.round(previousReceiptsTotalMTD)} шт.)
                            </span>
                        </div>
                    </button>

                    {/* Card 4: Forecast (only visible in Month view) */}
                    {days === 30 && (
                        <div
                            className="w-full text-left border-l-2 pl-6 py-2.5 rounded-r-xl border-dashed border-blue-300 bg-blue-50/15"
                        >
                            <p className="text-xs uppercase font-semibold tracking-wider text-blue-500 mb-1">
                                {activeMetric === 'revenue' && activeRevenueSubMetric !== 'total'
                                    ? `Прогноз: ${availableSubMetrics.find(s => s.key === activeRevenueSubMetric)?.label || 'выручка'}`
                                    : 'Прогноз на конец месяца'
                                }
                            </p>
                            <p className="text-[2.2rem] leading-none font-bold tracking-tighter text-blue-600 mb-1.5">
                                {activeMetric === 'revenue' 
                                    ? formatCurrency(forecastStats.forecastedRevenue)
                                    : activeMetric === 'averageCheck'
                                        ? formatCurrency(forecastStats.forecastedAverageCheck)
                                        : `${Math.round(forecastStats.forecastedReceiptsCount)} шт.`
                                }
                            </p>
                            <div className="flex flex-wrap items-baseline gap-x-2 gap-y-0.5">
                                <span className="text-xs text-slate-400 font-medium">
                                    итог прошлого месяца: {activeMetric === 'revenue'
                                        ? formatCurrency(previousRevenueTotal)
                                        : activeMetric === 'averageCheck'
                                            ? formatCurrency(previousAverageCheck)
                                            : `${Math.round(previousReceiptsTotal)} шт.`
                                    }
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                {/* Bottom Row: Full-Width Chart */}
                <div className="w-full min-w-0 bg-transparent md:bg-white md:rounded-2xl md:border md:border-slate-200 p-0 md:p-5">
                    {/* Chart Header (Mode toggles) */}
                    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 mb-4 px-0 md:px-2">
                        <div className="flex flex-col gap-2 min-w-0 w-full sm:w-auto">
                            <span className="text-xs font-semibold text-slate-500 uppercase tracking-wider truncate">
                                {activeMetric === 'revenue' 
                                    ? (chartMode === 'cumulative' ? 'Накопительная выручка' : 'Тренд выручки') 
                                    : activeMetric === 'averageCheck' 
                                        ? (chartMode === 'cumulative' ? 'Накопительный средний чек' : 'Тренд среднего чека') 
                                        : (chartMode === 'cumulative' ? 'Накопительно чеков' : 'Динамика количества чеков')}
                            </span>
                            {activeMetric === 'revenue' && availableSubMetrics.length > 0 && (
                                <div 
                                    onMouseDown={handleDragStart}
                                    onMouseLeave={handleDragEnd}
                                    onMouseUp={handleDragEnd}
                                    onMouseMove={handleDragMove}
                                    onWheel={handleWheelScroll}
                                    className="flex items-center gap-1.5 overflow-x-auto [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden py-0.5 max-w-full select-none cursor-grab active:cursor-grabbing"
                                >
                                    <button
                                        onClick={() => {
                                            setActiveRevenueSubMetric('total')
                                        }}
                                        className={cn(
                                            "px-2.5 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap cursor-pointer transition-all",
                                            activeRevenueSubMetric === 'total'
                                                ? "bg-slate-900 text-white shadow-xs"
                                                : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                        )}
                                    >
                                        Общая выручка
                                    </button>
                                    {availableSubMetrics.map(sub => (
                                        <button
                                            key={sub.key}
                                            onClick={() => {
                                                setActiveRevenueSubMetric(sub.key)
                                                if (activeMetric === 'averageCheck') {
                                                    setActiveMetric('revenue')
                                                }
                                            }}
                                            className={cn(
                                                "px-2.5 py-1 text-[11px] font-bold rounded-lg whitespace-nowrap cursor-pointer transition-all",
                                                activeRevenueSubMetric === sub.key
                                                    ? "bg-slate-900 text-white shadow-xs"
                                                    : "bg-slate-100 text-slate-600 hover:bg-slate-200"
                                            )}
                                        >
                                            {sub.label}
                                        </button>
                                    ))}
                                </div>
                            )}
                        </div>
                        <div className="flex bg-slate-100 p-0.5 rounded-lg text-[10px] font-bold uppercase tracking-wider shrink-0 self-start sm:self-auto">
                            <button
                                onClick={() => setChartMode('daily')}
                                className={cn(
                                    "px-3 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap",
                                    chartMode === 'daily'
                                        ? "bg-white text-slate-900 shadow-xs"
                                        : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                По дням
                            </button>
                            <button
                                onClick={() => setChartMode('cumulative')}
                                className={cn(
                                    "px-3 py-1 rounded-md transition-all cursor-pointer whitespace-nowrap",
                                    chartMode === 'cumulative'
                                        ? "bg-white text-slate-900 shadow-xs"
                                        : "text-slate-500 hover:text-slate-900"
                                )}
                            >
                                Накопительно
                            </button>
                        </div>
                    </div>

                    <div 
                        onMouseDown={handleDragStart}
                        onMouseLeave={handleDragEnd}
                        onMouseUp={handleDragEnd}
                        onMouseMove={handleDragMove}
                        onWheel={handleWheelScroll}
                        className="min-w-0 overflow-x-auto overscroll-x-contain pb-2 [-webkit-overflow-scrolling:touch] select-none cursor-grab active:cursor-grabbing"
                    >
                        <svg
                            viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                            className="block h-[280px] w-[920px] min-w-[920px] max-w-none sm:h-[260px] sm:min-w-0 sm:w-full lg:h-[300px]"
                            role="img"
                            aria-label="График финансовой аналитики за выбранный период"
                        >
                            {/* Weekend Highlights */}
                            {currentRevenueChartPoints.map((point, index) => {
                                if (!point.date) return null
                                const date = new Date(point.date)
                                const isWeekend = date.getDay() === 0 || date.getDay() === 6
                                if (!isWeekend) return null

                                const dayWidth = xAxisLength > 1 ? chartPlotWidth / (xAxisLength - 1) : chartPlotWidth
                                const x1 = Math.max(chartPaddingLeft, point.x - dayWidth / 2)
                                const x2 = Math.min(chartPaddingLeft + chartPlotWidth, point.x + dayWidth / 2)
                                const width = Math.max(0, x2 - x1)

                                return (
                                    <rect
                                        key={`weekend-${point.date}-${index}`}
                                        x={x1}
                                        y={chartPaddingTop}
                                        width={width}
                                        height={chartPlotHeight}
                                        fill="#F1F5F9"
                                        opacity="0.6"
                                    />
                                )
                            })}

                            {revenueScaleTicks.map((tick, index) => {
                                const y = chartPaddingTop + chartPlotHeight - (tick / maxRevenue) * chartPlotHeight

                                return (
                                    <g key={`${tick}-${index}`}>
                                        <line
                                            x1={chartPaddingLeft}
                                            x2={chartPaddingLeft + chartPlotWidth}
                                            y1={y}
                                            y2={y}
                                            className="stroke-slate-100"
                                            strokeWidth="1"
                                            strokeDasharray="4 4"
                                        />
                                        <text
                                            x={chartWidth - 4}
                                            y={y + 4}
                                            textAnchor="end"
                                            fontSize="11"
                                            className="fill-slate-400 font-medium"
                                        >
                                            {formatCompactMetricValue(tick)}
                                        </text>
                                    </g>
                                )
                            })}

                            {activeCurrentPoint ? (
                                <line
                                    x1={activeCurrentPoint.x}
                                    x2={activeCurrentPoint.x}
                                    y1={chartPaddingTop}
                                    y2={chartPaddingTop + chartPlotHeight}
                                    className="stroke-slate-200"
                                    strokeDasharray="4 4"
                                />
                            ) : null}

                            {previousRevenueLinePath ? (
                                <path
                                    d={previousRevenueLinePath}
                                    fill="none"
                                    className="stroke-slate-300"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeDasharray="6 6"
                                    opacity="0.85"
                                />
                            ) : null}

                            {revenueAreaPath ? (
                                <path
                                    d={revenueAreaPath}
                                    fill="url(#revenueAreaGradient)"
                                    opacity="0.85"
                                />
                            ) : null}

                            {revenueLinePath ? (
                                <path
                                    d={revenueLinePath}
                                    fill="none"
                                    className="stroke-blue-600"
                                    strokeWidth="3.5"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                />
                            ) : null}

                            {forecastLinePath ? (
                                <path
                                    d={forecastLinePath}
                                    fill="none"
                                    className="stroke-blue-500"
                                    strokeWidth="3"
                                    strokeLinecap="round"
                                    strokeLinejoin="round"
                                    strokeDasharray="4 4"
                                    opacity="0.65"
                                />
                            ) : null}

                            {previousRevenueChartPoints.map((point, index) => (
                                <circle
                                    key={`prev-${point.date}-${index}`}
                                    cx={point.x}
                                    cy={point.y}
                                    r={activeIndex === index ? 4 : 2}
                                    className="fill-white stroke-slate-400"
                                    strokeWidth="1.5"
                                    opacity="0.7"
                                />
                            ))}

                            {currentRevenueChartPoints.map((point, index) => {
                                const showLabel = index === currentRevenueChartPoints.length - 1 || index % 5 === 0
                                const isForecast = point.isForecast

                                return (
                                    <g key={`${point.date}-${index}`}>
                                        <circle
                                            cx={point.x}
                                            cy={point.y}
                                            r={activeIndex === index ? 5.5 : index === currentData.length - 1 ? 4.5 : 2.5}
                                            className={cn(
                                                isForecast 
                                                    ? "fill-white stroke-blue-500" 
                                                    : point.revenue === 0 ? "fill-slate-400" : "fill-blue-600",
                                                "stroke-white"
                                            )}
                                            strokeWidth="2"
                                        />
                                        {showLabel && point.date ? (
                                            <text
                                                x={point.x}
                                                y={chartHeight - 10}
                                                textAnchor="middle"
                                                fontSize="11"
                                                className="fill-slate-400 font-medium"
                                            >
                                                {formatDate(point.date)}
                                            </text>
                                        ) : null}
                                    </g>
                                )
                            })}

                            {tooltip && activeCurrentPoint ? (
                                <g>
                                    <rect
                                        x={tooltip.x}
                                        y={tooltip.y}
                                        width={tooltip.width}
                                        height={tooltip.height}
                                        rx="10"
                                        className="fill-white stroke-slate-200/80 shadow-xs"
                                        strokeWidth="1"
                                    />
                                    <text
                                        x={tooltip.x + 12}
                                        y={tooltip.y + 16}
                                        fontSize="11"
                                        fontWeight="600"
                                        className="fill-slate-400"
                                    >
                                        {formatDate(activeCurrentPoint.date)} {isForecastPoint && "(Прогноз)"}
                                    </text>
                                    <text
                                        x={tooltip.x + 12}
                                        y={tooltip.y + 34}
                                        fontSize="11"
                                        fontWeight="700"
                                        fill="#2563EB"
                                    >
                                        Текущий: {formatMetricValue(activeCurrentPoint.revenue)}
                                    </text>
                                    <text
                                        x={tooltip.x + 12}
                                        y={tooltip.y + 49}
                                        fontSize="11"
                                        fontWeight="600"
                                        className="fill-slate-500"
                                    >
                                        Прошлый: {formatMetricValue(activePreviousPoint?.revenue ?? 0)}
                                    </text>
                                </g>
                            ) : null}

                            {interactionBands.map(band => (
                                <rect
                                    key={`band-${band.index}`}
                                    x={band.x}
                                    y={0}
                                    width={band.width}
                                    height={chartHeight}
                                    fill="transparent"
                                    onMouseEnter={() => setHoveredIndex(band.index)}
                                    onMouseMove={() => setHoveredIndex(band.index)}
                                    onMouseLeave={() => setHoveredIndex(null)}
                                    onClick={() => setPinnedIndex(current => current === band.index ? null : band.index)}
                                    style={{ cursor: "pointer" }}
                                />
                            ))}

                            <defs>
                                <linearGradient id="revenueAreaGradient" x1="0" x2="0" y1="0" y2="1">
                                    <stop offset="0%" stopColor="#3B82F6" stopOpacity="0.25" />
                                    <stop offset="100%" stopColor="#3B82F6" stopOpacity="0.01" />
                                </linearGradient>
                            </defs>
                        </svg>
                    </div>
                    <p className="mt-2 text-xs text-slate-400 sm:hidden">Нажми на точку, чтобы увидеть подробную информацию</p>
                </div>
            </div>
        </section>
    )
}
