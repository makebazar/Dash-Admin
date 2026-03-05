"use client"

import { useEffect, useRef, useState } from "react"
import { Html5QrcodeScanner, Html5QrcodeScanType } from "html5-qrcode"
import { X, Camera, RefreshCcw } from "lucide-react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog"

interface BarcodeScannerProps {
    onScan: (barcode: string) => void
    onClose: () => void
    isOpen: boolean
}

export function BarcodeScanner({ onScan, onClose, isOpen }: BarcodeScannerProps) {
    const scannerRef = useRef<Html5QrcodeScanner | null>(null)
    const [error, setError] = useState<string | null>(null)
    const [isInitializing, setIsInitializing] = useState(false)

    useEffect(() => {
        let isMounted = true
        
        const initScanner = async () => {
            if (!isOpen) return
            
            setIsInitializing(true)
            console.log("Initializing scanner...")

            // Wait for Dialog to animate and element to be in DOM
            await new Promise(resolve => setTimeout(resolve, 400))
            
            if (!isMounted || !isOpen) {
                setIsInitializing(false)
                return
            }

            const element = document.getElementById("barcode-reader")
            if (!element) {
                console.error("barcode-reader element not found")
                // Try one more time after a short delay
                await new Promise(resolve => setTimeout(resolve, 200))
                if (!document.getElementById("barcode-reader")) {
                    setIsInitializing(false)
                    return
                }
            }

            try {
                if (!scannerRef.current) {
                    const scanner = new Html5QrcodeScanner(
                        "barcode-reader",
                        { 
                            fps: 10, 
                            qrbox: { width: 250, height: 150 },
                            aspectRatio: 1.777778,
                            showTorchButtonIfSupported: true,
                            rememberLastUsedCamera: true,
                            supportedScanTypes: [Html5QrcodeScanType.SCAN_TYPE_CAMERA]
                        },
                        /* verbose= */ false
                    )

                    await scanner.render(
                        (decodedText) => {
                            onScan(decodedText)
                        },
                        (errorMessage) => {
                            // ignore
                        }
                    )

                    scannerRef.current = scanner
                    console.log("Scanner initialized successfully")
                }
            } catch (err) {
                console.error("Failed to start scanner:", err)
                setError("Не удалось запустить камеру")
            } finally {
                setIsInitializing(false)
            }
        }

        initScanner()

        return () => {
            isMounted = false
            if (scannerRef.current) {
                const scanner = scannerRef.current
                scannerRef.current = null
                scanner.clear().catch(err => console.error("Failed to clear scanner", err))
            }
        }
    }, [isOpen, onScan])

    return (
        <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
            <DialogContent className="sm:max-w-[500px] p-0 overflow-hidden bg-black border-none z-[10000]">
                <DialogHeader className="p-4 bg-white/10 backdrop-blur-md absolute top-0 left-0 right-0 z-[10001] flex-row items-center justify-between space-y-0">
                    <DialogTitle className="text-white flex items-center gap-2">
                        <Camera className="h-5 w-5 text-blue-400" />
                        Сканирование штрихкода
                    </DialogTitle>
                    <Button variant="ghost" size="icon" onClick={onClose} className="text-white hover:bg-white/20">
                        <X className="h-5 w-5" />
                    </Button>
                </DialogHeader>

                <div className="relative w-full aspect-[4/3] bg-black flex items-center justify-center pt-14 min-h-[300px]">
                    <div id="barcode-reader" className="w-full h-full"></div>
                    
                    {isInitializing && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/80 z-20">
                            <RefreshCcw className="h-8 w-8 text-blue-500 animate-spin mb-4" />
                            <p className="text-white text-sm">Запуск камеры...</p>
                        </div>
                    )}

                    {error && (
                        <div className="absolute inset-0 flex flex-col items-center justify-center bg-black/90 z-30 px-6 text-center">
                            <X className="h-10 w-10 text-red-500 mb-4" />
                            <p className="text-white font-medium mb-2">{error}</p>
                            <p className="text-white/60 text-xs mb-6">Убедитесь, что вы дали разрешение на использование камеры</p>
                            <Button variant="outline" onClick={() => window.location.reload()} className="bg-white/10 border-white/20 text-white">
                                Обновить страницу
                            </Button>
                        </div>
                    )}

                    {/* Custom Overlay for better UX */}
                    {!isInitializing && !error && (
                        <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center">
                            <div className="w-[250px] h-[150px] border-2 border-blue-500/50 rounded-lg relative">
                                {/* Corner markers */}
                                <div className="absolute -top-1 -left-1 w-4 h-4 border-t-2 border-l-2 border-blue-400"></div>
                                <div className="absolute -top-1 -right-1 w-4 h-4 border-t-2 border-r-2 border-blue-400"></div>
                                <div className="absolute -bottom-1 -left-1 w-4 h-4 border-b-2 border-l-2 border-blue-400"></div>
                                <div className="absolute -bottom-1 -right-1 w-4 h-4 border-b-2 border-r-2 border-blue-400"></div>
                                
                                {/* Scanning line animation */}
                                <div className="absolute top-0 left-0 right-0 h-0.5 bg-blue-400/50 shadow-[0_0_8px_rgba(96,165,250,0.8)] animate-scan"></div>
                            </div>
                            <p className="text-white/70 text-xs mt-6 px-4 text-center bg-black/40 py-2 rounded-full backdrop-blur-sm">
                                Наведите камеру на штрихкод товара
                            </p>
                        </div>
                    )}
                </div>

                <div className="p-6 bg-slate-900 flex justify-center">
                    <Button variant="outline" onClick={() => window.location.reload()} className="bg-white/5 border-white/10 text-white hover:bg-white/10">
                        <RefreshCcw className="mr-2 h-4 w-4" />
                        Сбросить камеру
                    </Button>
                </div>
            </DialogContent>

            <style jsx global>{`
                #barcode-reader {
                    border: none !important;
                }
                #barcode-reader__dashboard {
                    display: none !important;
                }
                #barcode-reader__video_flow_container {
                    width: 100% !important;
                    height: 100% !important;
                }
                #barcode-reader video {
                    width: 100% !important;
                    height: 100% !important;
                    object-fit: cover !important;
                }
                @keyframes scan {
                    0% { top: 0; }
                    100% { top: 100%; }
                }
                .animate-scan {
                    animation: scan 2s linear infinite;
                }
            `}</style>
        </Dialog>
    )
}
