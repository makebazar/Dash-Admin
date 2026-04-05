"use client"

import { useEffect, useState } from "react"
import QRCodeLib from "qrcode"
import { Button } from "@/components/ui/button"
import { Download } from "lucide-react"

type QRCodeProps = {
    value: string
    size?: number
    downloadable?: boolean
    filename?: string
}

function sanitizeFilename(value: string) {
    return value
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9-_]+/g, "-")
        .replace(/-+/g, "-")
        .replace(/^-|-$/g, "") || "qr-code"
}

export function QRCode({ value, size = 220, downloadable = false, filename = "qr-code" }: QRCodeProps) {
    const [svg, setSvg] = useState<string>("")

    useEffect(() => {
        let alive = true
        const run = async () => {
            try {
                const out = await QRCodeLib.toString(value, {
                    type: "svg",
                    margin: 1,
                    width: size,
                    color: {
                        dark: "#000000",
                        light: "#0000"
                    }
                })
                if (alive) setSvg(out)
            } catch {
                if (alive) setSvg("")
            }
        }
        run()
        return () => {
            alive = false
        }
    }, [value, size])

    if (!svg) return null

    const baseFilename = sanitizeFilename(filename)

    const handleDownloadSvg = () => {
        const blob = new Blob([svg], { type: "image/svg+xml;charset=utf-8" })
        const url = URL.createObjectURL(blob)
        const link = document.createElement("a")
        link.href = url
        link.download = `${baseFilename}.svg`
        link.click()
        URL.revokeObjectURL(url)
    }

    const handleDownloadPng = async () => {
        try {
            const dataUrl = await QRCodeLib.toDataURL(value, {
                margin: 1,
                width: size * 4,
                color: {
                    dark: "#000000",
                    light: "#0000"
                }
            })
            const link = document.createElement("a")
            link.href = dataUrl
            link.download = `${baseFilename}.png`
            link.click()
        } catch {}
    }

    return (
        <div className="space-y-3">
            <button
                type="button"
                onClick={downloadable ? handleDownloadSvg : undefined}
                className="block w-fit rounded-xl border border-muted-foreground/10 bg-transparent p-3"
                dangerouslySetInnerHTML={{ __html: svg }}
            />
            {downloadable ? (
                <div className="flex flex-col gap-2 sm:flex-row">
                    <Button variant="outline" className="w-full" onClick={handleDownloadSvg}>
                        <Download className="mr-2 h-4 w-4" />
                        SVG
                    </Button>
                    <Button variant="outline" className="w-full" onClick={handleDownloadPng}>
                        <Download className="mr-2 h-4 w-4" />
                        PNG
                    </Button>
                </div>
            ) : null}
        </div>
    )
}
