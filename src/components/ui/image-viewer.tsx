
"use client"

import * as React from "react"
import { createPortal } from "react-dom"
import { X, ZoomIn, ZoomOut, RotateCw, RotateCcw, ChevronLeft, ChevronRight } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ImageViewerProps {
    src: string
    alt?: string
    isOpen: boolean
    onClose: () => void
    images?: string[] // Optional array of images for navigation
    onNext?: () => void
    onPrev?: () => void
    hasNext?: boolean
    hasPrev?: boolean
}

export function ImageViewer({ src, alt, isOpen, onClose, images, onNext, onPrev, hasNext, hasPrev }: ImageViewerProps) {
    const [scale, setScale] = React.useState(1)
    const [rotation, setRotation] = React.useState(0)
    const [position, setPosition] = React.useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = React.useState(false)
    const [startPos, setStartPos] = React.useState({ x: 0, y: 0 })
    const [mounted, setMounted] = React.useState(false)
    const pinchStateRef = React.useRef<{
        distance: number
        scale: number
        centerX: number
        centerY: number
        positionX: number
        positionY: number
    } | null>(null)
    const swipeStateRef = React.useRef<{
        startX: number
        startY: number
        deltaX: number
        deltaY: number
    } | null>(null)
    const lastTapRef = React.useRef(0)
    const hasPinchedRef = React.useRef(false)

    // Determine navigation availability
    const showPrev = hasPrev || (images && images.indexOf(src) > 0)
    const showNext = hasNext || (images && images.indexOf(src) < images.length - 1)
    const currentImageIndex = images ? images.indexOf(src) : -1
    const showDots = Boolean(images && images.length > 1 && currentImageIndex >= 0)

    React.useEffect(() => {
        setMounted(true)
        return () => setMounted(false)
    }, [])

    React.useEffect(() => {
        if (isOpen) {
            document.body.style.overflow = "hidden"
        } else {
            document.body.style.overflow = "unset"
        }
        return () => {
            document.body.style.overflow = "unset"
        }
    }, [isOpen])

    // Reset state when opening new image
    React.useEffect(() => {
        if (isOpen) {
            setScale(1)
            setRotation(0)
            setPosition({ x: 0, y: 0 })
            pinchStateRef.current = null
            swipeStateRef.current = null
            hasPinchedRef.current = false
        }
    }, [src, isOpen])

    // Keyboard navigation
    React.useEffect(() => {
        if (!isOpen) return

        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' && showNext && onNext) onNext()
            if (e.key === 'ArrowLeft' && showPrev && onPrev) onPrev()
            if (e.key === 'Escape') onClose()
        }

        window.addEventListener('keydown', handleKeyDown)
        return () => window.removeEventListener('keydown', handleKeyDown)
    }, [isOpen, showNext, showPrev, onNext, onPrev, onClose])

    if (!isOpen || !mounted) return null

    const getTouchDistance = (touchA: React.Touch, touchB: React.Touch) => {
        const dx = touchA.clientX - touchB.clientX
        const dy = touchA.clientY - touchB.clientY
        return Math.hypot(dx, dy)
    }

    const getTouchCenter = (touchA: React.Touch, touchB: React.Touch) => ({
        x: (touchA.clientX + touchB.clientX) / 2,
        y: (touchA.clientY + touchB.clientY) / 2,
    })

    const isZoomed = scale > 1.01

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 5))
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 0.5))
    const handleRotateCw = () => setRotation(prev => prev + 90)
    const handleRotateCcw = () => setRotation(prev => prev - 90)
    const handleMouseDown = (e: React.MouseEvent) => {
        if (scale > 1) {
            setIsDragging(true)
            setStartPos({ x: e.clientX - position.x, y: e.clientY - position.y })
        }
    }

    const handleMouseMove = (e: React.MouseEvent) => {
        if (isDragging && scale > 1) {
            setPosition({
                x: e.clientX - startPos.x,
                y: e.clientY - startPos.y
            })
        }
    }

    const handleMouseUp = () => {
        setIsDragging(false)
    }

    const handleTouchStart = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length === 2) {
            const [touchA, touchB] = [e.touches[0], e.touches[1]]
            const center = getTouchCenter(touchA, touchB)
            pinchStateRef.current = {
                distance: getTouchDistance(touchA, touchB),
                scale,
                centerX: center.x,
                centerY: center.y,
                positionX: position.x,
                positionY: position.y,
            }
            swipeStateRef.current = null
            hasPinchedRef.current = true
            setIsDragging(false)
            return
        }

        if (e.touches.length === 1) {
            const touch = e.touches[0]
            swipeStateRef.current = {
                startX: touch.clientX,
                startY: touch.clientY,
                deltaX: 0,
                deltaY: 0,
            }

            if (isZoomed) {
                setIsDragging(true)
                setStartPos({ x: touch.clientX - position.x, y: touch.clientY - position.y })
            }
        }
    }

    const handleTouchMove = (e: React.TouchEvent<HTMLDivElement>) => {
        if (e.touches.length === 2 && pinchStateRef.current) {
            e.preventDefault()
            const [touchA, touchB] = [e.touches[0], e.touches[1]]
            const center = getTouchCenter(touchA, touchB)
            const nextScale = Math.min(
                Math.max((getTouchDistance(touchA, touchB) / pinchStateRef.current.distance) * pinchStateRef.current.scale, 1),
                5
            )

            setScale(nextScale)
            setPosition({
                x: pinchStateRef.current.positionX + (center.x - pinchStateRef.current.centerX),
                y: pinchStateRef.current.positionY + (center.y - pinchStateRef.current.centerY),
            })
            return
        }

        if (e.touches.length === 1 && swipeStateRef.current) {
            const touch = e.touches[0]
            const deltaX = touch.clientX - swipeStateRef.current.startX
            const deltaY = touch.clientY - swipeStateRef.current.startY

            swipeStateRef.current = {
                ...swipeStateRef.current,
                deltaX,
                deltaY,
            }

            if (isZoomed) {
                e.preventDefault()
                setPosition({
                    x: touch.clientX - startPos.x,
                    y: touch.clientY - startPos.y,
                })
            }
        }
    }

    const handleTouchEnd = () => {
        const swipe = swipeStateRef.current
        const now = Date.now()

        if (pinchStateRef.current) {
            pinchStateRef.current = null
            swipeStateRef.current = null
            setIsDragging(false)
            return
        }

        if (swipe) {
            const absX = Math.abs(swipe.deltaX)
            const absY = Math.abs(swipe.deltaY)
            const isHorizontalSwipe = absX > 50 && absX > absY * 1.25

            if (!isZoomed && isHorizontalSwipe) {
                if (swipe.deltaX < 0 && showNext && onNext) onNext()
                if (swipe.deltaX > 0 && showPrev && onPrev) onPrev()
            } else if (!hasPinchedRef.current && absX < 12 && absY < 12) {
                if (now - lastTapRef.current < 280) {
                    if (isZoomed) {
                        setScale(1)
                        setPosition({ x: 0, y: 0 })
                    } else {
                        setScale(2)
                    }
                    lastTapRef.current = 0
                } else {
                    lastTapRef.current = now
                }
            }
        }

        swipeStateRef.current = null
        hasPinchedRef.current = false
        setIsDragging(false)
    }

    return createPortal(
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            {/* Toolbar - Top Desktop */}
            <div className="absolute top-4 left-1/2 z-[151] hidden max-w-[90vw] -translate-x-1/2 items-center gap-2 overflow-x-auto rounded-full border border-white/10 bg-black/50 p-2 backdrop-blur-md no-scrollbar md:flex" onClick={e => e.stopPropagation()}>
                <Button type="button" variant="ghost" size="icon" onClick={handleZoomOut} className="text-white hover:bg-white/20 h-8 w-8 shrink-0">
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-white/70 w-12 text-center shrink-0">{Math.round(scale * 100)}%</span>
                <Button type="button" variant="ghost" size="icon" onClick={handleZoomIn} className="text-white hover:bg-white/20 h-8 w-8 shrink-0">
                    <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-white/20 mx-1 shrink-0" />
                <Button type="button" variant="ghost" size="icon" onClick={handleRotateCcw} className="text-white hover:bg-white/20 h-8 w-8 shrink-0">
                    <RotateCcw className="h-4 w-4" />
                </Button>
                <Button type="button" variant="ghost" size="icon" onClick={handleRotateCw} className="text-white hover:bg-white/20 h-8 w-8 shrink-0">
                    <RotateCw className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-white/20 mx-1 shrink-0" />
                <Button 
                    type="button"
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => {
                        e.stopPropagation()
                        onClose()
                    }} 
                    className="text-white hover:bg-white/20 h-8 w-8 shrink-0"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Mobile Close */}
            <div className="absolute right-4 top-4 z-[151] md:hidden" onClick={e => e.stopPropagation()}>
                <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={onClose}
                    className="h-10 w-10 rounded-full border border-white/10 bg-black/50 text-white backdrop-blur-md hover:bg-white/20"
                >
                    <X className="h-5 w-5" />
                </Button>
            </div>

            {/* Mobile Dots */}
            {showDots && (
                <div className="pointer-events-none absolute bottom-6 left-1/2 z-[151] flex -translate-x-1/2 items-center gap-2 rounded-full bg-black/35 px-3 py-2 backdrop-blur-sm md:hidden">
                    {images!.map((image, index) => (
                        <span
                            key={`${image}-${index}`}
                            className={cn(
                                "h-1.5 w-1.5 rounded-full transition-all",
                                index === currentImageIndex ? "bg-white" : "bg-white/35"
                            )}
                        />
                    ))}
                </div>
            )}

            {/* Desktop Navigation */}
            {showPrev && onPrev && (
                <Button 
                    type="button"
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { e.stopPropagation(); onPrev() }} 
                    className="hidden md:flex absolute left-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 rounded-full h-12 w-12 z-[151]"
                >
                    <ChevronLeft className="h-8 w-8" />
                </Button>
            )}
            
            {showNext && onNext && (
                <Button 
                    type="button"
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { e.stopPropagation(); onNext() }} 
                    className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 rounded-full h-12 w-12 z-[151]"
                >
                    <ChevronRight className="h-8 w-8" />
                </Button>
            )}

            {/* Close button (Desktop & Mobile) removed as it is now in toolbar */}

            {/* Image Container */}
            <div 
                className="relative w-full h-full flex items-center justify-center overflow-hidden p-4 touch-none"
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
                onTouchStart={handleTouchStart}
                onTouchMove={handleTouchMove}
                onTouchEnd={handleTouchEnd}
                onTouchCancel={handleTouchEnd}
                onClick={e => e.stopPropagation()}
            >
                <img 
                    src={src} 
                    alt={alt || "Просмотр изображения"} 
                    className={cn(
                        "max-w-full max-h-full object-contain select-none transition-transform",
                        isDragging ? "duration-0" : "duration-100"
                    )}
                    style={{ 
                        transform: `scale(${scale}) rotate(${rotation}deg) translate(${position.x}px, ${position.y}px)`,
                        cursor: scale > 1 ? (isDragging ? 'grabbing' : 'grab') : 'default',
                        touchAction: "none",
                    }}
                    draggable={false}
                />
            </div>
        </div>
        ,
        document.body
    )
}
