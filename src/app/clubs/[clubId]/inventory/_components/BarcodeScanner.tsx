"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode, Html5QrcodeScanType } from "html5-qrcode"
import { X, Camera, RefreshCcw, Zap, ZapOff, Barcode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface BarcodeScannerProps {
    onScan: (barcode: string) => Promise<boolean>
    onClose: () => void
    isOpen: boolean
}

export function BarcodeScanner({ onScan, onClose, isOpen }: BarcodeScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const lastScannedRef = useRef<{ code: string, time: number } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [scanStatus, setScanStatus] = useState<{ type: 'success' | 'error' | 'idle', message?: string }>({ type: 'idle' })
    const [isInitializing, setIsInitializing] = useState(false)
    const [isTorchOn, setIsTorchOn] = useState(false)
    const [hasTorch, setHasTorch] = useState(false)

    // Clear scan status after some time
    useEffect(() => {
        if (scanStatus.type !== 'idle') {
            const timer = setTimeout(() => {
                setScanStatus({ type: 'idle' })
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [scanStatus])

    useEffect(() => {
        let isMounted = true
        let startPromise: Promise<any> | null = null
        
        const startScanner = async () => {
            if (!isOpen) return
            
            // Проверка на HTTPS (обязательно для мобильных камер)
            if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                setError("Доступ к камере заблокирован браузером (требуется HTTPS).")
                setIsInitializing(false)
                return
            }
            
            if (scannerRef.current?.isScanning || isInitializing) return
            
            setIsInitializing(true)
            setError(null)
            setIsTorchOn(false)
            console.log("Starting scanner engine...")

            // Wait for Dialog to animate and element to be in DOM
            await new Promise(resolve => setTimeout(resolve, 600))
            
            if (!isMounted || !isOpen) {
                setIsInitializing(false)
                return
            }

            const element = document.getElementById("barcode-reader")
            if (!element) {
                console.error("barcode-reader element not found")
                setIsInitializing(false)
                return
            }

            try {
                if (!scannerRef.current) {
                    scannerRef.current = new Html5Qrcode("barcode-reader")
                }

                // Optimal configuration for speed and accuracy
                const config = {
                    fps: 30, // Increase FPS for smoother focus
                    qrbox: (viewfinderWidth: number, viewFinderHeight: number) => {
                        const minEdge = Math.min(viewfinderWidth, viewFinderHeight);
                        const qrboxSize = Math.floor(minEdge * 0.8);
                        return { width: qrboxSize, height: Math.floor(qrboxSize * 0.5) };
                    },
                    aspectRatio: 1.0,
                    videoConstraints: {
                        facingMode: "environment",
                        focusMode: "continuous",
                        width: { min: 640, ideal: 1280, max: 1920 },
                        height: { min: 480, ideal: 720, max: 1080 }
                    }
                }

                // Explicitly check for cameras first
                const devices = await Html5Qrcode.getCameras();
                if (!devices || devices.length === 0) {
                    throw new Error("No cameras found");
                }

                const backCamera = devices.find(device => 
                    device.label.toLowerCase().includes('back') || 
                    device.label.toLowerCase().includes('rear') ||
                    device.label.toLowerCase().includes('основная')
                );

                const cameraId = backCamera ? backCamera.id : { facingMode: "environment" };

                startPromise = scannerRef.current.start(
                    cameraId,
                    config,
                    async (decodedText) => {
                        const now = Date.now()
                        if (lastScannedRef.current?.code === decodedText && now - lastScannedRef.current.time < 2000) {
                            return
                        }
                        lastScannedRef.current = { code: decodedText, time: now }
                        
                        if (typeof window !== 'undefined' && window.navigator.vibrate) {
                            window.navigator.vibrate(100)
                        }

                        // Try to process the scan without closing
                        const success = await onScan(decodedText)
                        
                        if (success) {
                            setScanStatus({ type: 'success', message: 'Товар добавлен' })
                        } else {
                            setScanStatus({ type: 'error', message: 'Товар не найден' })
                        }
                    },
                    () => {}
                )

                await startPromise
                
                try {
                    const capabilities = scannerRef.current.getRunningTrackCapabilities()
                    // @ts-ignore
                    setHasTorch(!!capabilities.torch)
                } catch (e) {
                    setHasTorch(false)
                }

                console.log("Scanner started successfully")
            } catch (err: any) {
                console.error("Camera access error:", err)
                if (err?.name === "NotAllowedError" || err?.name === "PermissionDeniedError") {
                    setError("Доступ к камере отклонен. Разрешите его в настройках браузера.")
                } else {
                    setError("Не удалось запустить камеру. Попробуйте обновить страницу.")
                }
            } finally {
                if (isMounted) setIsInitializing(false)
            }
        }

        startScanner()

        return () => {
            isMounted = false
            const scanner = scannerRef.current
            
            const cleanup = async () => {
                if (startPromise) {
                    try { await startPromise } catch (e) {}
                }
                if (scanner && scanner.isScanning) {
                    try {
                        await scanner.stop()
                        console.log("Scanner stopped")
                    } catch (err) {
                        // ignore
                    }
                }
            }
            
            cleanup()
            scannerRef.current = null
        }
    }, [isOpen]) // Remove onScan from dependencies to avoid restarts when parent state changes

    const toggleTorch = async () => {
        if (!scannerRef.current || !scannerRef.current.isScanning) return
        try {
            const nextState = !isTorchOn
            await scannerRef.current.applyVideoConstraints({
                // @ts-ignore
                advanced: [{ torch: nextState }]
            })
            setIsTorchOn(nextState)
        } catch (e) {
            console.error("Failed to toggle torch", e)
        }
    }

    const triggerFocus = async (e: React.MouseEvent) => {
        if (!scannerRef.current || !scannerRef.current.isScanning) return
        
        // Visual feedback for tap-to-focus
        const element = e.currentTarget
        const rect = element.getBoundingClientRect()
        const x = e.clientX - rect.left
        const y = e.clientY - rect.top
        
        const ripple = document.createElement('div')
        ripple.className = 'absolute border-2 border-white/50 rounded-full w-12 h-12 -translate-x-1/2 -translate-y-1/2 pointer-events-none animate-ripple'
        ripple.style.left = `${x}px`
        ripple.style.top = `${y}px`
        element.appendChild(ripple)
        setTimeout(() => ripple.remove(), 600)

        try {
            // @ts-ignore
            const capabilities: any = scannerRef.current.getRunningTrackCapabilities()
            if (capabilities.focusMode) {
                // Try to force a re-focus by switching modes
                await scannerRef.current.applyVideoConstraints({
                    // @ts-ignore
                    advanced: [{ focusMode: "manual" }, { focusMode: "continuous" }]
                })
            }
        } catch (e) {
            console.warn("Manual focus not supported", e)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] sm:max-w-[500px] p-0 overflow-hidden bg-black border-slate-800 z-[10000] rounded-3xl border shadow-2xl">
                <DialogHeader className="p-4 bg-slate-900/90 backdrop-blur-md sticky top-0 left-0 right-0 z-[10001] flex-row items-center justify-between space-y-0 border-b border-slate-800">
                    <DialogTitle className="text-white text-base font-bold flex items-center gap-2">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse" />
                        Сканер
                    </DialogTitle>
                    <div className="flex items-center gap-2">
                        {hasTorch && (
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={toggleTorch}
                                className={`h-9 w-9 rounded-xl border-slate-800 ${isTorchOn ? 'bg-yellow-500 text-black border-yellow-400' : 'bg-slate-800/50 text-slate-400'}`}
                            >
                                {isTorchOn ? <Zap className="h-5 w-5 fill-current" /> : <ZapOff className="h-5 w-5" />}
                            </Button>
                        )}
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={onClose} 
                            className="text-slate-400 hover:text-white border-slate-800 bg-slate-800/50 h-9 w-9 rounded-xl"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </DialogHeader>

                <div 
                    className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden cursor-crosshair"
                    onClick={triggerFocus}
                >
                    <div id="barcode-reader" className="w-full h-full"></div>
                    
                    {isInitializing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
                            <RefreshCcw className="h-8 w-8 text-blue-500 animate-spin mb-4" />
                            <p className="text-white text-sm font-medium">Запуск камеры...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 px-6 text-center">
                            <div className="bg-red-500/20 p-4 rounded-full mb-4">
                                <X className="h-8 w-8 text-red-500" />
                            </div>
                            <p className="text-white font-medium mb-2">{error}</p>
                            <Button variant="outline" onClick={() => window.location.reload()} className="mt-4 bg-white/10 border-white/20 text-white rounded-xl">
                                Обновить страницу
                            </Button>
                        </div>
                    )}

                    {/* Simple Indicator Overlay */}
                    {!isInitializing && !error && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                            {/* Target Frame */}
                            <div className="w-64 h-40 border-2 border-blue-500/30 rounded-2xl relative">
                                <div className="absolute top-0 left-0 w-4 h-4 border-t-2 border-l-2 border-blue-500 rounded-tl-lg" />
                                <div className="absolute top-0 right-0 w-4 h-4 border-t-2 border-r-2 border-blue-500 rounded-tr-lg" />
                                <div className="absolute bottom-0 left-0 w-4 h-4 border-b-2 border-l-2 border-blue-500 rounded-bl-lg" />
                                <div className="absolute bottom-0 right-0 w-4 h-4 border-b-2 border-r-2 border-blue-500 rounded-br-lg" />
                                
                                {/* Scan Line Animation */}
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-500/50 shadow-[0_0_10px_rgba(59,130,246,0.5)] animate-scan-line" />
                            </div>
                        </div>
                    )}

                    {/* Scan Status Feedback */}
                    {scanStatus.type !== 'idle' && (
                        <div className={`absolute bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl flex items-center gap-2 animate-in zoom-in slide-in-from-bottom-4 duration-300 z-50 shadow-2xl ${
                            scanStatus.type === 'success' ? 'bg-green-600 text-white' : 'bg-red-600 text-white'
                        }`}>
                            <div className="bg-white/20 p-1 rounded-full">
                                <Barcode className="h-4 w-4" />
                            </div>
                            <span className="font-bold text-sm whitespace-nowrap">{scanStatus.message}</span>
                        </div>
                    )}
                </div>
            </DialogContent>

            <style jsx global>{`
                #barcode-reader { border: none !important; }
                #barcode-reader__dashboard { display: none !important; }
                #barcode-reader__video_flow_container { width: 100% !important; height: 100% !important; }
                #barcode-reader video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
                #barcode-reader__scan_region { display: flex !important; align-items: center !important; justify-content: center !important; }
                #barcode-reader__scan_region svg { 
                    display: none !important;
                }
                @keyframes scan-line {
                    0% { top: 0; }
                    50% { top: 100%; }
                    100% { top: 0; }
                }
                .animate-scan-line {
                    animation: scan-line 3s infinite ease-in-out;
                }
                @keyframes ripple {
                    0% { transform: translate(-50%, -50%) scale(0.5); opacity: 1; }
                    100% { transform: translate(-50%, -50%) scale(2); opacity: 0; }
                }
                .animate-ripple {
                    animation: ripple 0.6s ease-out;
                }
            `}</style>
        </Dialog>
    )
}
