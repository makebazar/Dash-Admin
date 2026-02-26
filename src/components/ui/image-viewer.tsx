"use client"

import * as React from "react"
import { X, ZoomIn, ZoomOut, RotateCw, RotateCcw, Maximize2 } from "lucide-react"
import { Button } from "@/components/ui/button"
import { cn } from "@/lib/utils"

interface ImageViewerProps {
    src: string
    alt?: string
    isOpen: boolean
    onClose: () => void
}

export function ImageViewer({ src, alt, isOpen, onClose }: ImageViewerProps) {
    const [scale, setScale] = React.useState(1)
    const [rotation, setRotation] = React.useState(0)
    const [position, setPosition] = React.useState({ x: 0, y: 0 })
    const [isDragging, setIsDragging] = React.useState(false)
    const [startPos, setStartPos] = React.useState({ x: 0, y: 0 })

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
        <div className="fixed inset-0 z-[100] flex items-center justify-center bg-black/90 backdrop-blur-sm animate-in fade-in duration-200" onClick={onClose}>
            {/* Toolbar */}
            <div className="absolute top-4 left-1/2 -translate-x-1/2 flex items-center gap-2 p-2 bg-black/50 rounded-full backdrop-blur-md border border-white/10 z-[101]" onClick={e => e.stopPropagation()}>
                <Button variant="ghost" size="icon" onClick={handleZoomOut} className="text-white hover:bg-white/20 h-8 w-8">
                    <ZoomOut className="h-4 w-4" />
                </Button>
                <span className="text-xs text-white/70 w-12 text-center">{Math.round(scale * 100)}%</span>
                <Button variant="ghost" size="icon" onClick={handleZoomIn} className="text-white hover:bg-white/20 h-8 w-8">
                    <ZoomIn className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-white/20 mx-1" />
                <Button variant="ghost" size="icon" onClick={handleRotateCcw} className="text-white hover:bg-white/20 h-8 w-8">
                    <RotateCcw className="h-4 w-4" />
                </Button>
                <Button variant="ghost" size="icon" onClick={handleRotateCw} className="text-white hover:bg-white/20 h-8 w-8">
                    <RotateCw className="h-4 w-4" />
                </Button>
                <div className="w-px h-4 bg-white/20 mx-1" />
                <Button variant="ghost" size="icon" onClick={handleReset} className="text-white hover:bg-white/20 h-8 w-8" title="Сбросить">
                    <Maximize2 className="h-4 w-4" />
                </Button>
            </div>

            {/* Close button */}
            <Button 
                variant="ghost" 
                size="icon" 
                onClick={onClose} 
                className="absolute top-4 right-4 text-white hover:bg-white/20 rounded-full h-10 w-10 z-[101]"
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
