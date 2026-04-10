"use client"

import { useMemo, useState } from "react"

type RevenuePoint = {
    date: string
    revenue: number
}

type ChartPoint = RevenuePoint & {
    x: number
    y: number
}

interface RevenueTrendChartProps {
    currentData: RevenuePoint[]
    previousData: RevenuePoint[]
}

const chartWidth = 920
const chartHeight = 280
const chartPaddingTop = 16
const chartPaddingRight = 72
const chartPaddingBottom = 36
const chartPaddingLeft = 8
const chartPlotWidth = chartWidth - chartPaddingLeft - chartPaddingRight
const chartPlotHeight = chartHeight - chartPaddingTop - chartPaddingBottom

const compactCurrencyFormatter = new Intl.NumberFormat("ru-RU", {
    notation: "compact",
    maximumFractionDigits: 1,
})

function formatCompactCurrency(value: number) {
    const safeValue = Number.isFinite(value) ? value : 0
    return `${compactCurrencyFormatter.format(safeValue)} ₽`
}

function formatDate(value: string | Date) {
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

function buildChartPoints(points: RevenuePoint[], maxRevenue: number): ChartPoint[] {
    return points.map((point, index) => {
        const x = points.length > 1
            ? chartPaddingLeft + (index / (points.length - 1)) * chartPlotWidth
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
}: RevenueTrendChartProps) {
    const [hoveredIndex, setHoveredIndex] = useState<number | null>(null)
    const [pinnedIndex, setPinnedIndex] = useState<number | null>(null)

    const maxRevenue = useMemo(() => {
        return Math.max(
            ...currentData.map(item => item.revenue),
            ...previousData.map(item => item.revenue),
            1
        )
    }, [currentData, previousData])

    const revenueScaleTicks = useMemo(() => {
        return [1, 0.75, 0.5, 0.25, 0].map(multiplier => Math.round(maxRevenue * multiplier))
    }, [maxRevenue])

    const currentRevenueChartPoints = useMemo(() => buildChartPoints(currentData, maxRevenue), [currentData, maxRevenue])
    const previousRevenueChartPoints = useMemo(() => buildChartPoints(previousData, maxRevenue), [previousData, maxRevenue])
    const revenueLinePath = useMemo(() => buildSmoothLinePath(currentRevenueChartPoints), [currentRevenueChartPoints])
    const previousRevenueLinePath = useMemo(() => buildSmoothLinePath(previousRevenueChartPoints), [previousRevenueChartPoints])
    const revenueAreaPath = useMemo(
        () => buildSmoothLinePath(currentRevenueChartPoints, chartPaddingTop + chartPlotHeight),
        [currentRevenueChartPoints]
    )

    const activeIndex = hoveredIndex ?? pinnedIndex
    const activeCurrentPoint = activeIndex !== null ? currentRevenueChartPoints[activeIndex] : null
    const activePreviousPoint = activeIndex !== null ? previousRevenueChartPoints[activeIndex] : null

    const tooltip = useMemo(() => {
        if (!activeCurrentPoint) return null

        const tooltipWidth = 148
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

    return (
        <div className="min-w-0 overflow-hidden rounded-none border-0 bg-transparent p-0 sm:rounded-3xl sm:border sm:border-border sm:bg-gradient-to-b sm:from-slate-50 sm:to-white sm:p-4">
            <div className="min-w-0 overflow-x-auto overscroll-x-contain pb-2 [-ms-overflow-style:none] [-webkit-overflow-scrolling:touch] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden">
                <svg
                    viewBox={`0 0 ${chartWidth} ${chartHeight}`}
                    className="block h-[280px] w-[920px] min-w-[920px] max-w-none sm:h-[260px] sm:min-w-0 sm:w-full lg:h-[300px]"
                    role="img"
                    aria-label="График текущей и прошлой выручки за 30 дней"
                >
                    {revenueScaleTicks.map((tick, index) => {
                        const y = chartPaddingTop + chartPlotHeight - (tick / maxRevenue) * chartPlotHeight

                        return (
                            <g key={`${tick}-${index}`}>
                                <line
                                    x1={chartPaddingLeft}
                                    x2={chartPaddingLeft + chartPlotWidth}
                                    y1={y}
                                    y2={y}
                                    className="stroke-border"
                                    strokeDasharray="4 4"
                                />
                                <text
                                    x={chartWidth - 4}
                                    y={y + 4}
                                    textAnchor="end"
                                    fontSize="11"
                                    className="fill-muted-foreground"
                                >
                                    {formatCompactCurrency(tick)}
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
                            className="stroke-border/70"
                            strokeDasharray="4 4"
                        />
                    ) : null}

                    {previousRevenueLinePath ? (
                        <path
                            d={previousRevenueLinePath}
                            fill="none"
                            className="stroke-muted-foreground/50"
                            strokeWidth="2.5"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                            strokeDasharray="7 7"
                            opacity="0.95"
                        />
                    ) : null}

                    {revenueAreaPath ? (
                        <path
                            d={revenueAreaPath}
                            fill="url(#revenueAreaGradient)"
                            opacity="0.9"
                        />
                    ) : null}

                    {revenueLinePath ? (
                        <path
                            d={revenueLinePath}
                            fill="none"
                            className="stroke-primary"
                            strokeWidth="3"
                            strokeLinecap="round"
                            strokeLinejoin="round"
                        />
                    ) : null}

                    {previousRevenueChartPoints.map((point, index) => (
                        <circle
                            key={`prev-${point.date}-${index}`}
                            cx={point.x}
                            cy={point.y}
                            r={activeIndex === index ? 4 : 2.5}
                            className="fill-background stroke-muted-foreground/50"
                            strokeWidth="2"
                        />
                    ))}

                    {currentRevenueChartPoints.map((point, index) => {
                        const showLabel = index === currentRevenueChartPoints.length - 1 || index % 5 === 0

                        return (
                            <g key={point.date}>
                                <circle
                                    cx={point.x}
                                    cy={point.y}
                                    r={activeIndex === index ? 5 : index === currentRevenueChartPoints.length - 1 ? 4.5 : 3}
                                    className={`${point.revenue === 0 ? "fill-muted-foreground" : "fill-primary"} stroke-background`}
                                    strokeWidth="2"
                                />
                                {showLabel ? (
                                    <text
                                        x={point.x}
                                        y={chartHeight - 10}
                                        textAnchor="middle"
                                        fontSize="11"
                                        className="fill-muted-foreground"
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
                                rx="14"
                                className="fill-background stroke-primary/30"
                            />
                            <text
                                x={tooltip.x + 12}
                                y={tooltip.y + 16}
                                fontSize="11"
                                fontWeight="600"
                                className="fill-muted-foreground"
                            >
                                {formatDate(activeCurrentPoint.date)}
                            </text>
                            <text
                                x={tooltip.x + 12}
                                y={tooltip.y + 34}
                                fontSize="11"
                                fontWeight="600"
                                fill="#1E40AF"
                            >
                                Текущий: {formatCompactCurrency(activeCurrentPoint.revenue)}
                            </text>
                            <text
                                x={tooltip.x + 12}
                                y={tooltip.y + 49}
                                fontSize="11"
                                fontWeight="600"
                                className="fill-muted-foreground"
                            >
                                Прошлый: {formatCompactCurrency(activePreviousPoint?.revenue ?? 0)}
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
                            <stop offset="0%" stopColor="#60A5FA" stopOpacity="0.35" />
                            <stop offset="100%" stopColor="#60A5FA" stopOpacity="0.04" />
                        </linearGradient>
                    </defs>
                </svg>
            </div>
            <p className="mt-2 text-xs text-muted-foreground sm:hidden">Нажми на точку, чтобы увидеть выручку за день</p>
        </div>
    )
}
