"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode, Html5QrcodeScanType } from "html5-qrcode"
import { X, Camera, RefreshCcw, Zap, ZapOff, Barcode } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface BarcodeScannerProps {
    onScan: (barcode: string) => void
    onClose: () => void
    isOpen: boolean
}

export function BarcodeScanner({ onScan, onClose, isOpen }: BarcodeScannerProps) {
    const scannerRef = useRef<Html5Qrcode | null>(null)
    const lastScannedRef = useRef<{ code: string, time: number } | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(false)
    const [isTorchOn, setIsTorchOn] = useState(false)
    const [hasTorch, setHasTorch] = useState(false)

    useEffect(() => {
        let isMounted = true
        let startPromise: Promise<any> | null = null
        
        const startScanner = async () => {
            if (!isOpen) return
            
            // Если уже инициализируем или сканируем, не запускаем заново
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
                    fps: 20, // Higher FPS for faster recognition
                    qrbox: (viewfinderWidth: number, viewFinderHeight: number) => {
                        const minEdge = Math.min(viewfinderWidth, viewFinderHeight);
                        const qrboxSize = Math.floor(minEdge * 0.7);
                        return { width: qrboxSize, height: Math.floor(qrboxSize * 0.6) }; // Rectangular for barcodes
                    },
                    aspectRatio: 1.0,
                    experimentalFeatures: {
                        useBarCodeDetectorIfSupported: true // Uses native system API if available (much faster)
                    }
                }

                startPromise = scannerRef.current.start(
                    { facingMode: "environment" },
                    config,
                    (decodedText) => {
                        const now = Date.now()
                        if (lastScannedRef.current?.code === decodedText && now - lastScannedRef.current.time < 1500) {
                            return
                        }
                        lastScannedRef.current = { code: decodedText, time: now }
                        
                        // Haptic feedback if supported
                        if (typeof window !== 'undefined' && window.navigator.vibrate) {
                            window.navigator.vibrate(100)
                        }

                        // Закрываем сканер сразу после успешного сканирования
                        onClose()
                        onScan(decodedText)
                    },
                    () => {}
                )

                await startPromise
                
                // Check if camera supports torch
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
                        // ignore stop errors
                    }
                }
            }
            
            cleanup()
            scannerRef.current = null
        }
    }, [isOpen, onScan])

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

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] sm:max-w-[500px] p-0 overflow-hidden bg-black border-slate-800 z-[10000] rounded-3xl border">
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

                <div className="relative w-full aspect-square bg-black flex items-center justify-center overflow-hidden">
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

                    {/* Pro Scanning Overlay */}
                    {!isInitializing && !error && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                            <div className="w-[260px] h-[160px] relative">
                                {/* Corners with glowing effect */}
                                <div className="absolute -top-2 -left-2 w-8 h-8 border-t-4 border-l-4 border-blue-500 rounded-tl-2xl shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                                <div className="absolute -top-2 -right-2 w-8 h-8 border-t-4 border-r-4 border-blue-500 rounded-tr-2xl shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                                <div className="absolute -bottom-2 -left-2 w-8 h-8 border-b-4 border-l-4 border-blue-500 rounded-bl-2xl shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                                <div className="absolute -bottom-2 -right-2 w-8 h-8 border-b-4 border-r-4 border-blue-500 rounded-br-2xl shadow-[0_0_15px_rgba(59,130,246,0.5)]"></div>
                                
                                {/* High-tech scanning line */}
                                <div className="absolute top-0 left-0 right-0 h-1 bg-gradient-to-r from-transparent via-blue-400 to-transparent shadow-[0_0_20px_rgba(96,165,250,1)] animate-scan-fast"></div>
                                
                                {/* Darken outside the scanning area */}
                                <div className="absolute -inset-[2000px] border-[2000px] border-black/40"></div>
                            </div>
                            
                            <div className="mt-12 px-6 py-2 bg-blue-600/20 backdrop-blur-md border border-blue-500/30 rounded-full flex items-center gap-2">
                                <Barcode className="h-4 w-4 text-blue-400" />
                                <span className="text-blue-100 text-[10px] uppercase font-bold tracking-widest">
                                    Наведите на штрихкод
                                </span>
                            </div>
                        </div>
                    )}
                </div>

                <div className="p-4 bg-slate-900/50 border-t border-slate-800">
                    <p className="text-[10px] text-slate-500 text-center px-4 leading-relaxed">
                        Совет: держите телефон параллельно штрихкоду на расстоянии 10-15 см.
                    </p>
                </div>
            </DialogContent>

            <style jsx global>{`
                #barcode-reader { border: none !important; }
                #barcode-reader__dashboard { display: none !important; }
                #barcode-reader__video_flow_container { width: 100% !important; height: 100% !important; }
                #barcode-reader video { width: 100% !important; height: 100% !important; object-fit: cover !important; }
                #barcode-reader__scan_region { display: none !important; }
                #barcode-reader__scan_region svg { display: none !important; }
                #barcode-reader__video_flow_container > div { display: none !important; }
                @keyframes scan-fast {
                    0% { top: 0%; opacity: 0; }
                    10% { opacity: 1; }
                    90% { opacity: 1; }
                    100% { top: 100%; opacity: 0; }
                }
                .animate-scan-fast {
                    animation: scan-fast 1.5s cubic-bezier(0.4, 0, 0.2, 1) infinite;
                }
            `}</style>
        </Dialog>
    )
}
