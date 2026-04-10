"use client"

import { useEffect, useRef, useState } from "react"
import { Html5Qrcode, Html5QrcodeScanType, Html5QrcodeSupportedFormats } from "html5-qrcode"
import { X, Camera, RefreshCcw, Zap, ZapOff, Barcode, ChevronDown, CheckCircle2, AlertCircle } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"
import { DropdownMenu, DropdownMenuContent, DropdownMenuItem, DropdownMenuTrigger } from "@/components/ui/dropdown-menu"
import { cn } from "@/lib/utils"

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
    const [cameras, setCameras] = useState<{ id: string, label: string }[]>([])
    const [currentCameraId, setCurrentCameraId] = useState<string | null>(null)
    const [zoom, setZoom] = useState(1)
    const [maxZoom, setMaxZoom] = useState(1)

    const cycleCamera = () => {
        if (cameras.length <= 1) return
        const currentIndex = cameras.findIndex(c => c.id === currentCameraId)
        const nextIndex = (currentIndex + 1) % cameras.length
        switchCamera(cameras[nextIndex].id)
    }

    // Clear scan status after some time
    useEffect(() => {
        if (scanStatus.type !== 'idle') {
            const timer = setTimeout(() => {
                setScanStatus({ type: 'idle' })
            }, 2000)
            return () => clearTimeout(timer)
        }
    }, [scanStatus])

    const startScanner = async (cameraId: string) => {
        if (!isOpen) return
        
        setIsInitializing(true)
        setError(null)
        setIsTorchOn(false)
        
        // Wait for element to be in DOM
        await new Promise(resolve => setTimeout(resolve, 300))
        
        const element = document.getElementById("barcode-reader")
        if (!element) {
            setIsInitializing(false)
            return
        }

        try {
            if (scannerRef.current?.isScanning) {
                await scannerRef.current.stop()
            }
            
            if (!scannerRef.current) {
                scannerRef.current = new Html5Qrcode("barcode-reader", {
                    formatsToSupport: [
                        Html5QrcodeSupportedFormats.EAN_13,
                        Html5QrcodeSupportedFormats.EAN_8,
                        Html5QrcodeSupportedFormats.CODE_128,
                        Html5QrcodeSupportedFormats.CODE_39,
                        Html5QrcodeSupportedFormats.UPC_A,
                        Html5QrcodeSupportedFormats.UPC_E,
                        Html5QrcodeSupportedFormats.QR_CODE
                    ],
                    verbose: false
                })
            }

            // Identify if it's likely a back camera by label or index
            const isBackCamera = /back|rear|основная/i.test(cameras.find(c => c.id === cameraId)?.label || '') || cameras.length > 1

            const config = {
                fps: 20,
                qrbox: (viewfinderWidth: number, viewFinderHeight: number) => {
                    const qrboxWidth = Math.floor(viewfinderWidth * 0.85);
                    const qrboxHeight = Math.min(Math.floor(viewFinderHeight * 0.3), 160);
                    return { width: qrboxWidth, height: qrboxHeight };
                },
                aspectRatio: 1.777778,
                videoConstraints: {
                    deviceId: cameraId,
                    facingMode: isBackCamera ? { ideal: "environment" } : "user",
                    width: { ideal: 1920 },
                    height: { ideal: 1080 },
                    // @ts-ignore
                    focusMode: { ideal: "continuous" }
                }
            }

            await scannerRef.current.start(
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

                    const success = await onScan(decodedText)
                    setScanStatus({ 
                        type: success ? 'success' : 'error', 
                        message: success ? 'Товар добавлен' : 'Товар не найден' 
                    })
                },
                () => {}
            )

            setCurrentCameraId(cameraId)
            
            try {
                const capabilities = scannerRef.current.getRunningTrackCapabilities()
                // @ts-ignore
                setHasTorch(!!capabilities.torch)
                // @ts-ignore
                if (capabilities.zoom) {
                    // @ts-ignore
                    setMaxZoom(capabilities.zoom.max || 1)
                    // @ts-ignore
                    setZoom(capabilities.zoom.min || 1)
                }
            } catch (e) {
                setHasTorch(false)
            }
        } catch (err: any) {
            console.error("Scanner start error:", err)
            setError("Не удалось запустить камеру.")
        } finally {
            setIsInitializing(false)
        }
    }

    useEffect(() => {
        let isMounted = true
        
        const init = async () => {
            if (!isOpen) return
            
            if (typeof window !== 'undefined' && window.location.protocol !== 'https:' && window.location.hostname !== 'localhost') {
                setError("Требуется HTTPS для доступа к камере.")
                return
            }

            try {
                const devices = await Html5Qrcode.getCameras()
                if (isMounted) {
                    const mappedDevices = devices.map(d => ({ id: d.id, label: d.label }))
                    setCameras(mappedDevices)
                    
                    if (devices.length > 0) {
                        // Better back camera selection
                        const backCameras = devices.filter(d => 
                            /back|rear|основная/i.test(d.label) || 
                            d.label.toLowerCase().includes("камера 0") ||
                            d.label.toLowerCase().includes("camera 0")
                        )

                        // If no matches, try finding cameras that don't say "front"
                        const likelyBackCameras = backCameras.length > 0 ? backCameras : devices.filter(d => 
                            !/front|селфи|передняя/i.test(d.label)
                        )

                        // Avoid wide/ultra-wide if possible
                        const preferredCamera = likelyBackCameras.find(d => 
                            !/wide|ultra|широко/i.test(d.label.toLowerCase()) && 
                            !/0\.5x/i.test(d.label.toLowerCase())
                        ) || likelyBackCameras[0] || devices[0]
                        
                        await startScanner(preferredCamera.id)
                    } else {
                        setError("Камеры не найдены.")
                    }
                }
            } catch (err) {
                console.error("Camera init error:", err)
                setError("Ошибка при поиске камер.")
            }
        }

        init()

        return () => {
            isMounted = false
            if (scannerRef.current?.isScanning) {
                scannerRef.current.stop().catch(console.error)
            }
            scannerRef.current = null
        }
    }, [isOpen])

    const switchCamera = (cameraId: string) => {
        if (cameraId === currentCameraId) return
        startScanner(cameraId)
    }

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

    const handleZoomChange = async (value: number[]) => {
        if (!scannerRef.current || !scannerRef.current.isScanning) return
        try {
            const nextZoom = value[0]
            await scannerRef.current.applyVideoConstraints({
                // @ts-ignore
                advanced: [{ zoom: nextZoom }]
            })
            setZoom(nextZoom)
        } catch (e) {
            console.error("Failed to apply zoom", e)
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
            const track = scannerRef.current?.getRunningTrack?.()
            if (!track) return

            // @ts-ignore
            const capabilities: any = track.getCapabilities?.() || {}
            
            // For iPhone: specifically try to use focusDistance if focusMode is available
            const constraints: any = { advanced: [] }
            
            if (capabilities.focusMode) {
                constraints.advanced.push({ focusMode: "continuous" })
            }
            
            if (capabilities.focusDistance) {
                // Try to focus on something closer (barcode range)
                constraints.advanced.push({ focusDistance: 0.2 })
            }

            if (constraints.advanced.length > 0) {
                await track.applyConstraints(constraints)
            }
        } catch (e) {
            console.warn("Manual focus nudge failed", e)
        }
    }

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="w-[95vw] sm:max-w-[500px] p-0 overflow-hidden bg-primary border-slate-800 z-[10000] rounded-3xl border shadow-2xl">
                <DialogHeader className="p-4 bg-primary/90 backdrop-blur-md sticky top-0 left-0 right-0 z-[10001] flex-row items-center justify-between space-y-0 border-b border-slate-800">
                    <div className="flex items-center gap-3 overflow-hidden mr-2">
                        <div className="h-2 w-2 rounded-full bg-green-500 animate-pulse shrink-0" />
                        
                        {cameras.length > 1 ? (
                            <DropdownMenu>
                                <DropdownMenuTrigger asChild>
                                    <Button variant="ghost" className="p-0 h-auto hover:bg-transparent text-primary-foreground text-sm font-bold flex items-center gap-1 truncate max-w-[200px]">
                                        <span className="truncate">{cameras.find(c => c.id === currentCameraId)?.label || 'Сканер'}</span>
                                        <ChevronDown className="h-3 w-3 shrink-0 opacity-50" />
                                    </Button>
                                </DropdownMenuTrigger>
                                <DropdownMenuContent className="bg-primary border-slate-800 text-primary-foreground min-w-[240px]">
                                    {cameras.map((camera, index) => {
                                        const label = camera.label || `Камера ${index + 1}`
                                        const isWide = /wide|ultra|широко/i.test(label) || /0\.5x/i.test(label)
                                        const isFront = /front|селфи|передняя/i.test(label)
                                        
                                        return (
                                            <DropdownMenuItem 
                                                key={camera.id} 
                                                onClick={() => switchCamera(camera.id)}
                                                className={`text-xs p-3 focus:bg-slate-800 focus:text-primary-foreground ${camera.id === currentCameraId ? 'bg-blue-600/20 text-blue-400' : ''}`}
                                            >
                                                <div className="flex flex-col">
                                                    <div className="flex items-center">
                                                        <Camera className="h-3 w-3 mr-2 shrink-0" />
                                                        <span className="truncate font-medium">{label}</span>
                                                    </div>
                                                    {(isWide || isFront) && (
                                                        <span className="text-[10px] opacity-50 ml-5">
                                                            {isWide ? 'Широкоугольная' : 'Фронтальная'}
                                                        </span>
                                                    )}
                                                </div>
                                            </DropdownMenuItem>
                                        )
                                    })}
                                </DropdownMenuContent>
                            </DropdownMenu>
                        ) : (
                            <DialogTitle className="text-primary-foreground text-base font-bold truncate">
                                Сканер
                            </DialogTitle>
                        )}
                    </div>
                    
                    <div className="flex items-center gap-2 shrink-0">
                        {cameras.length > 1 && (
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={cycleCamera}
                                className="h-9 w-9 rounded-xl border-slate-800 bg-slate-800/50 text-muted-foreground/70 hover:text-primary-foreground"
                            >
                                <RefreshCcw className="h-5 w-5" />
                            </Button>
                        )}
                        {hasTorch && (
                            <Button 
                                variant="outline" 
                                size="icon" 
                                onClick={toggleTorch}
                                className={`h-9 w-9 rounded-xl border-slate-800 ${isTorchOn ? 'bg-yellow-500 text-foreground border-yellow-400' : 'bg-slate-800/50 text-muted-foreground/70'}`}
                            >
                                {isTorchOn ? <Zap className="h-5 w-5 fill-current" /> : <ZapOff className="h-5 w-5" />}
                            </Button>
                        )}
                        <Button 
                            variant="outline" 
                            size="icon" 
                            onClick={onClose} 
                            className="text-muted-foreground/70 hover:text-primary-foreground border-slate-800 bg-slate-800/50 h-9 w-9 rounded-xl"
                        >
                            <X className="h-5 w-5" />
                        </Button>
                    </div>
                </DialogHeader>

                <div className="relative aspect-[16/9] w-full bg-primary flex items-center justify-center overflow-hidden">
                    <div id="barcode-reader" className="w-full h-full [&_video]:object-cover" onClick={triggerFocus}></div>
                    
                    {/* Scanner Overlay UI */}
                    <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                        {/* Scanning Guide Line */}
                        <div className="w-[85%] h-[2px] bg-red-500/60 shadow-[0_0_8px_rgba(239,68,68,0.8)] animate-pulse" />
                        
                        {/* Corner Markers */}
                        <div className="absolute top-[35%] left-[7.5%] w-6 h-6 border-t-2 border-l-2 border-white/80 rounded-tl-lg" />
                        <div className="absolute top-[35%] right-[7.5%] w-6 h-6 border-t-2 border-r-2 border-white/80 rounded-tr-lg" />
                        <div className="absolute bottom-[35%] left-[7.5%] w-6 h-6 border-b-2 border-l-2 border-white/80 rounded-bl-lg" />
                        <div className="absolute bottom-[35%] right-[7.5%] w-6 h-6 border-b-2 border-r-2 border-white/80 rounded-br-lg" />
                    </div>

                    {/* Zoom Control Overlay */}
                     {maxZoom > 1 && (
                         <div className="absolute bottom-4 left-1/2 -translate-x-1/2 w-[60%] bg-primary/40 backdrop-blur-md px-4 py-2 rounded-full border border-white/10 flex items-center gap-3 pointer-events-auto">
                             <span className="text-[10px] text-primary-foreground/60 font-bold">1x</span>
                             <input 
                                 type="range" 
                                 min={1} 
                                 max={maxZoom} 
                                 step={0.1} 
                                 value={zoom}
                                 onChange={(e) => handleZoomChange([parseFloat(e.target.value)])}
                                 className="flex-1 h-1 bg-card/20 rounded-lg appearance-none cursor-pointer accent-blue-500"
                             />
                             <span className="text-[10px] text-primary-foreground/60 font-bold">{Math.round(maxZoom)}x</span>
                         </div>
                     )}

                     {/* Scan status indicator - Mini version */}
                     {scanStatus.type !== 'idle' && (
                        <div className="absolute top-4 left-1/2 -translate-x-1/2 z-[10002] animate-in slide-in-from-top-2 duration-300">
                            <div className={cn(
                                "px-4 py-2 rounded-full border shadow-lg flex items-center gap-2 backdrop-blur-md",
                                scanStatus.type === 'success' ? "bg-green-500/90 border-green-400 text-primary-foreground" : "bg-red-500/90 border-red-400 text-primary-foreground"
                            )}>
                                {scanStatus.type === 'success' ? <CheckCircle2 className="h-4 w-4" /> : <AlertCircle className="h-4 w-4" />}
                                <span className="font-bold text-xs uppercase tracking-wider">{scanStatus.message}</span>
                            </div>
                        </div>
                    )}

                    {isInitializing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary/80 z-20">
                            <RefreshCcw className="h-8 w-8 text-blue-500 animate-spin mb-4" />
                            <p className="text-primary-foreground text-sm font-medium">Запуск камеры...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-primary/90 z-30 px-6 text-center">
                            <div className="bg-red-500/20 p-4 rounded-full mb-4">
                                <X className="h-8 w-8 text-red-500" />
                            </div>
                            <p className="text-primary-foreground font-medium mb-2">{error}</p>
                            <Button variant="outline" onClick={() => window.location.reload()} className="mt-4 bg-card/10 border-white/20 text-primary-foreground rounded-xl">
                                Обновить страницу
                            </Button>
                        </div>
                    )}

                    {/* Scan Status Feedback */}
                    {scanStatus.type !== 'idle' && (
                        <div className={`absolute bottom-10 left-1/2 -translate-x-1/2 px-6 py-3 rounded-2xl flex items-center gap-2 animate-in zoom-in slide-in-from-bottom-4 duration-300 z-50 shadow-2xl ${
                            scanStatus.type === 'success' ? 'bg-green-600 text-primary-foreground' : 'bg-red-600 text-primary-foreground'
                        }`}>
                            <div className="bg-card/20 p-1 rounded-full">
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
