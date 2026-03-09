"use client"

import { Product, PriceTagTemplate } from "../actions"
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog"
import { Button } from "@/components/ui/button"
import { Printer } from "lucide-react"
import { useRef } from "react"
import { cn } from "@/lib/utils"

interface PriceTagPrinterProps {
    isOpen: boolean
    onClose: () => void
    products: Product[]
    template?: PriceTagTemplate
}

function getFieldText(
    product: Product,
    field: PriceTagTemplate['elements'][0]['field'],
    showDecimals: boolean
) {
    if (field === 'price') {
        return showDecimals
            ? `${product.selling_price.toFixed(2)}`
            : `${Math.round(product.selling_price)}`
    }
    if (field === 'barcode') {
        return product.barcode || product.barcodes?.[0] || '—'
    }
    return product.name || '—'
}

function getAutoScaleFontSize(
    el: PriceTagTemplate['elements'][0],
    value: string
) {
    const width = el.width || 20
    const height = el.height || 10
    const viewBoxWidth = (width / height) * 100
    const safeLength = Math.max(1, value.length)
    return Math.min(95, viewBoxWidth / (safeLength * 0.55))
}

export function PriceTagPrinter({ isOpen, onClose, products, template }: PriceTagPrinterProps) {
    const printRef = useRef<HTMLDivElement>(null)

    const activeTemplate = template || {
        id: 'default',
        name: 'Стандартный',
        width_mm: 58,
        height_mm: 40,
        elements: [
            { id: '1', type: 'text', x: 5, y: 5, fontSize: 12, fontWeight: 'bold', field: 'name', width: 48, height: 15, wrap_text: true },
            { id: '2', type: 'price', x: 5, y: 25, fontSize: 18, fontWeight: 'black', field: 'price', width: 48, height: 10 }
        ]
    }

    const handlePrint = () => {
        const printContents = printRef.current?.innerHTML
        if (!printContents) return

        const printWindow = window.open('', '_blank')
        if (!printWindow) return

        const fontUrls = new Set<string>()
        if (activeTemplate.font_url) fontUrls.add(activeTemplate.font_url)
        activeTemplate.elements.forEach(el => {
            if (el.font_url) fontUrls.add(el.font_url)
            if (el.currency_font_url) fontUrls.add(el.currency_font_url)
        })

        const fontFaces = Array.from(fontUrls).map(url => {
            const fontId = `font-${url.replace(/[^a-z0-9]/gi, '')}`
            return `
                @font-face {
                    font-family: '${fontId}';
                    src: url('${url}');
                }
            `
        }).join('\n')
        const inheritedStyles = Array.from(document.querySelectorAll('style, link[rel="stylesheet"]'))
            .map(el => el.outerHTML)
            .join('\n')

        printWindow.document.write(`
            <html>
                <head>
                    <title>Печать ценников</title>
                    ${inheritedStyles}
                    <style>
                        ${fontFaces}
                        @page {
                            size: A4;
                            margin: 0;
                        }
                        body {
                            margin: 0;
                            padding: 0;
                            background: white;
                            -webkit-print-color-adjust: exact;
                            print-color-adjust: exact;
                        }
                        .sheet {
                            width: 210mm;
                            display: flex;
                            flex-wrap: wrap;
                            gap: 1mm;
                            align-content: flex-start;
                        }
                        .price-tag {
                            width: ${activeTemplate.width_mm}mm;
                            height: ${activeTemplate.height_mm}mm;
                            position: relative;
                            overflow: hidden;
                            background-color: ${activeTemplate.background_color || '#ffffff'};
                            background-image: ${activeTemplate.background_image_url ? `url(${activeTemplate.background_image_url})` : 'none'};
                            background-size: cover;
                            background-position: center;
                            box-sizing: border-box;
                            border: 0.1mm solid #eee;
                            ${activeTemplate.font_url ? `font-family: 'font-${activeTemplate.font_url.replace(/[^a-z0-9]/gi, '')}';` : "font-family: sans-serif;"}
                        }
                        .element {
                            position: absolute;
                            white-space: nowrap;
                            line-height: 1.1;
                            display: flex;
                            align-items: center;
                            justify-content: center;
                            text-align: center;
                            word-break: break-word;
                            overflow: hidden;
                            box-sizing: border-box;
                        }
                        .wrap-text {
                            white-space: normal;
                        }
                        svg {
                            width: 100%;
                            height: 100%;
                            display: block;
                        }
                    </style>
                </head>
                <body>
                    <div class="sheet">
                        ${printContents}
                    </div>
                    <script>
                        window.onload = () => {
                            window.print();
                        };
                    </script>
                </body>
            </html>
        `)
        printWindow.document.close()
    }

    return (
        <Dialog open={isOpen} onOpenChange={onClose}>
            <DialogContent className="max-w-[95vw] w-[1000px] max-h-[95vh] flex flex-col p-0 overflow-hidden">
                <DialogHeader className="p-6 pb-2">
                    <DialogTitle className="flex items-center gap-2">
                        <Printer className="h-5 w-5" />
                        Печать ценников ({products.length})
                    </DialogTitle>
                </DialogHeader>

                <div className="flex-1 overflow-auto bg-slate-500/10 p-8 flex justify-center">
                    {/* Visual A4 Sheet */}
                    <div className="bg-white shadow-2xl w-[210mm] min-h-[297mm] p-0 box-content overflow-hidden">
                        <div ref={printRef} className="flex flex-wrap gap-[1mm] w-full">
                            {products.map((product) => (
                                <div 
                                    key={product.id} 
                                    className="price-tag bg-white shadow-sm"
                                    style={{ 
                                        width: `${activeTemplate.width_mm}mm`, 
                                        height: `${activeTemplate.height_mm}mm`,
                                        position: 'relative',
                                        overflow: 'hidden',
                                        backgroundColor: activeTemplate.background_color || '#ffffff',
                                        backgroundImage: activeTemplate.background_image_url ? `url(${activeTemplate.background_image_url})` : 'none',
                                        backgroundSize: 'cover',
                                        backgroundPosition: 'center',
                                        boxSizing: 'border-box',
                                        border: '0.1mm solid #eee',
                                        fontFamily: activeTemplate.font_family || 'sans-serif'
                                    }}
                                >
                                    {activeTemplate.elements.map((el: PriceTagTemplate['elements'][0]) => (
                                        <div 
                                            key={el.id}
                                            className={cn(
                                                "element",
                                                el.wrap_text && "wrap-text"
                                            )}
                                            style={{ 
                                                left: `${el.x}mm`, 
                                                top: `${el.y}mm`,
                                                width: el.width ? `${el.width}mm` : 'auto',
                                                height: el.height ? `${el.height}mm` : 'auto',
                                                fontSize: `${el.fontSize || 12}mm`,
                                                fontWeight: el.fontWeight || 'normal',
                                                color: el.color || 'black',
                                                overflow: 'hidden',
                                                fontFamily: el.font_family || activeTemplate.font_family || 'inherit',
                                                display: 'flex',
                                                alignItems: 'center',
                                                justifyContent: 'center',
                                                textAlign: 'center',
                                                position: 'absolute',
                                                lineHeight: 1.1
                                            }}
                                        >
                                            {el.auto_scale ? (
                                                <svg 
                                                    viewBox={`0 0 ${((el.width || 20) / (el.height || 10)) * 100} 100`} 
                                                    width="100%" 
                                                    height="100%" 
                                                    preserveAspectRatio="xMidYMid meet"
                                                >
                                                    <text 
                                                        x="50%" 
                                                        y="50%" 
                                                        textAnchor="middle" 
                                                        dominantBaseline="central"
                                                        fill={el.color || 'black'}
                                                        fontWeight={el.fontWeight || 'normal'}
                                                        style={{ 
                                                            fontSize: getAutoScaleFontSize(
                                                                el,
                                                                `${getFieldText(product, el.field, !!activeTemplate.show_decimals)}${el.field === 'price' ? ' ₽' : ''}`
                                                            ), 
                                                            fontFamily: el.font_family || activeTemplate.font_family || 'sans-serif' 
                                                        }}
                                                    >
                                                        {el.field === 'price' ? (
                                                            <>
                                                                {getFieldText(product, 'price', !!activeTemplate.show_decimals)}
                                                                <tspan style={{ fontFamily: el.currency_font_family || el.font_family || activeTemplate.font_family || 'sans-serif' }}> ₽</tspan>
                                                            </>
                                                        ) : (
                                                            getFieldText(product, el.field, !!activeTemplate.show_decimals)
                                                        )}
                                                    </text>
                                                </svg>
                                            ) : (
                                                <div className="w-full h-full flex items-center justify-center">
                                                    {el.field === 'price' ? (
                                                        <>
                                                            {getFieldText(product, 'price', !!activeTemplate.show_decimals)}
                                                            <span style={{ fontFamily: el.currency_font_family || el.font_family || activeTemplate.font_family || 'sans-serif' }}> ₽</span>
                                                        </>
                                                    ) : (
                                                        getFieldText(product, el.field, !!activeTemplate.show_decimals)
                                                    )}
                                                </div>
                                            )}
                                        </div>
                                    ))}
                                </div>
                            ))}
                        </div>
                    </div>
                </div>

                <div className="p-6 bg-white border-t flex justify-end gap-3">
                    <Button variant="outline" onClick={onClose}>Отмена</Button>
                    <Button onClick={handlePrint} className="gap-2 font-bold bg-blue-600 hover:bg-blue-700 text-white">
                        <Printer className="h-4 w-4" />
                        Распечатать
                    </Button>
                </div>
            </DialogContent>
        </Dialog>
    )
}
