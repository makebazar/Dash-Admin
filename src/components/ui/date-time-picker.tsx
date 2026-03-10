"use client"

import * as React from "react"
import { format } from "date-fns"
import { ru } from "date-fns/locale"
import { CalendarIcon, Clock3 } from "lucide-react"
import { cn } from "@/lib/utils"
import { Button } from "@/components/ui/button"
import { Calendar } from "@/components/ui/calendar"
import {
    Popover,
    PopoverContent,
    PopoverTrigger
} from "@/components/ui/popover"
import { Input } from "@/components/ui/input"

interface DateTimePickerProps {
    value?: Date
    onChange: (value?: Date) => void
    placeholder?: string
    className?: string
    disabled?: boolean
}

export function DateTimePicker({ value, onChange, placeholder = "Выберите дату и время", className, disabled }: DateTimePickerProps) {
    const timeValue = value ? format(value, "HH:mm") : ""

    const handleTimeChange = (nextTime: string) => {
        if (!value) return
        const [hours, minutes] = nextTime.split(":").map(Number)
        if (Number.isNaN(hours) || Number.isNaN(minutes)) return
        const nextDate = new Date(value)
        nextDate.setHours(hours, minutes, 0, 0)
        onChange(nextDate)
    }

    return (
        <Popover>
            <PopoverTrigger asChild>
                <Button
                    type="button"
                    variant="outline"
                    className={cn("w-full justify-start text-left font-normal", !value && "text-muted-foreground", className)}
                    disabled={disabled}
                >
                    <CalendarIcon className="mr-2 h-4 w-4" />
                    {value ? format(value, "PPP HH:mm", { locale: ru }) : placeholder}
                </Button>
            </PopoverTrigger>
            <PopoverContent className="w-auto p-3 space-y-3" align="start">
                <Calendar
                    mode="single"
                    selected={value}
                    onSelect={(date: Date | undefined) => {
                        if (!date) {
                            onChange(undefined)
                            return
                        }
                        const nextDate = new Date(date)
                        if (value) {
                            nextDate.setHours(value.getHours(), value.getMinutes(), 0, 0)
                        } else {
                            nextDate.setHours(12, 0, 0, 0)
                        }
                        onChange(nextDate)
                    }}
                    initialFocus
                />
                <div className="flex items-center gap-2">
                    <Clock3 className="h-4 w-4 text-muted-foreground" />
                    <Input
                        type="time"
                        value={timeValue}
                        onChange={(e: React.ChangeEvent<HTMLInputElement>) => handleTimeChange(e.target.value)}
                        disabled={!value}
                        className="h-9"
                    />
                </div>
            </PopoverContent>
        </Popover>
    )
}
