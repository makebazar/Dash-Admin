
"use client"

import * as React from "react"
import { X, ZoomIn, ZoomOut, RotateCw, RotateCcw, Maximize2, ChevronLeft, ChevronRight } from "lucide-react"
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

    // Determine navigation availability
    const showPrev = hasPrev || (images && images.indexOf(src) > 0)
    const showNext = hasNext || (images && images.indexOf(src) < images.length - 1)

    // Internal handlers for array-based navigation
    const handleNext = () => {
        if (onNext) {
            onNext()
        } else if (images) {
            const currentIndex = images.indexOf(src)
            if (currentIndex < images.length - 1) {
                // We rely on the parent updating the 'src' prop, but we can't trigger it directly without a callback that accepts the new src
                // So we assume the parent handles logic via onNext, OR we need a way to notify parent.
                // Since the current interface is controlled, we really need the parent to handle the state change.
                // If onNext is provided, we use it. If not, this internal logic won't work unless we change the component to be uncontrolled or accept onIndexChange.
                // For now, let's assume onNext/onPrev are passed if navigation is desired.
            }
        }
    }

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

    if (!isOpen) return null

    const handleZoomIn = () => setScale(prev => Math.min(prev + 0.5, 5))
    const handleZoomOut = () => setScale(prev => Math.max(prev - 0.5, 0.5))
    const handleRotateCw = () => setRotation(prev => prev + 90)
    const handleRotateCcw = () => setRotation(prev => prev - 90)
    const handleReset = () => {
        setScale(1)
        setRotation(0)
        setPosition({ x: 0, y: 0 })
    }

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

    return (
        <div className="fixed inset-0 z-[150] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            {/* Toolbar - Top */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-black/50 rounded-full backdrop-blur-md border border-white/10 z-[151] max-w-[90vw] overflow-x-auto no-scrollbar" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" onClick={handleZoomOut} className="text-white hover:bg-white/20 h-8 w-8 shrink-0">
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-white/70 w-12 text-center shrink-0">{Math.round(scale * 100)}%</span>
                <Button variant="ghost" size="icon" onClick={handleZoomIn} className="text-white hover:bg-white/20 h-8 w-8 shrink-0">
                    <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-white/20 mx-1 shrink-0" />
                <Button variant="ghost" size="icon" onClick={handleRotateCcw} className="text-white hover:bg-white/20 h-8 w-8 shrink-0">
                    <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleRotateCw} className="text-white hover:bg-white/20 h-8 w-8 shrink-0">
                    <RotateCw className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-white/20 mx-1 shrink-0" />
                <Button variant="ghost" size="icon" onClick={handleReset} className="text-white hover:bg-white/20 h-8 w-8 shrink-0" title="Сбросить">
                    <Maximize2 className="h-4 w-4" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    onClick={onClose} 
                    className="text-white hover:bg-white/20 h-8 w-8 ml-1 shrink-0 md:hidden"
                >
                    <X className="h-4 w-4" />
                </Button>
            </div>

            {/* Navigation Buttons - Mobile Bottom / Desktop Sides */}
            <div className="absolute bottom-8 left-0 right-0 flex justify-center gap-8 z-[151] md:hidden pointer-events-none">
                <Button 
                    variant="ghost" 
                    size="icon" 
                    disabled={!showPrev}
                    onClick={(e) => { e.stopPropagation(); onPrev?.() }} 
                    className={cn(
                        "text-white bg-black/50 backdrop-blur-md border border-white/10 rounded-full h-12 w-12 pointer-events-auto",
                        !showPrev && "opacity-30"
                    )}
                >
                    <ChevronLeft className="h-6 w-6" />
                </Button>
                <Button 
                    variant="ghost" 
                    size="icon" 
                    disabled={!showNext}
                    onClick={(e) => { e.stopPropagation(); onNext?.() }} 
                    className={cn(
                        "text-white bg-black/50 backdrop-blur-md border border-white/10 rounded-full h-12 w-12 pointer-events-auto",
                        !showNext && "opacity-30"
                    )}
                >
                    <ChevronRight className="h-6 w-6" />
                </Button>
            </div>

            {/* Desktop Navigation */}
            {showPrev && onPrev && (
                <Button 
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
                    variant="ghost" 
                    size="icon" 
                    onClick={(e) => { e.stopPropagation(); onNext() }} 
                    className="hidden md:flex absolute right-4 top-1/2 -translate-y-1/2 text-white hover:bg-white/20 rounded-full h-12 w-12 z-[151]"
                >
                    <ChevronRight className="h-8 w-8" />
                </Button>
            )}

            {/* Desktop Close button */}
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose} 
                className="hidden md:flex absolute top-4 right-4 text-white hover:bg-white/20 rounded-full h-10 w-10 z-[151]"
            >
                <X className="h-6 w-6" />
            </Button>

            {/* Image Container */}
            <div 
                className="w-full h-full flex items-center justify-center overflow-hidden cursor-grab active:cursor-grabbing"
                onClick={e => e.stopPropagation()}
                onMouseDown={handleMouseDown}
                onMouseMove={handleMouseMove}
                onMouseUp={handleMouseUp}
                onMouseLeave={handleMouseUp}
            >
                <img
                    src={src}
                    alt={alt || "Просмотр изображения"}
                    className="max-h-screen max-w-screen object-contain transition-transform duration-200 ease-out"
                    style={{
                        transform: `translate(${position.x}px, ${position.y}px) scale(${scale}) rotate(${rotation}deg)`,
                    }}
                    draggable={false}
                />
            </div>
        </div>
    )
}
