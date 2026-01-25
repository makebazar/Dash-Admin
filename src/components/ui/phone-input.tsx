"use client"

import * as React from "react"
import { Input } from "./input"

interface PhoneInputProps extends Omit<React.InputHTMLAttributes<HTMLInputElement>, 'onChange'> {
    value: string
    onChange: (value: string) => void
}

export const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
    ({ value, onChange, ...props }, ref) => {
        const formatPhoneNumber = (input: string) => {
            // Remove all non-digits
            const digits = input.replace(/\D/g, '')

            // Start with +7
            if (digits.length === 0) return ''

            let formatted = '+7'

            if (digits.length > 1) {
                formatted += ` (${digits.substring(1, 4)}`
            }

            if (digits.length >= 5) {
                formatted += `) ${digits.substring(4, 7)}`
            }

            if (digits.length >= 8) {
                formatted += `-${digits.substring(7, 9)}`
            }

            if (digits.length >= 10) {
                formatted += `-${digits.substring(9, 11)}`
            }

            return formatted
        }

        const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
            const input = e.target.value
            const digits = input.replace(/\D/g, '')

            // Limit to 11 digits (1 for country code + 10 for number)
            if (digits.length <= 11) {
                onChange(input)
            }
        }

        const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
            // Allow backspace to work properly
            if (e.key === 'Backspace') {
                const input = e.currentTarget
                const cursorPos = input.selectionStart || 0

                // If cursor is after a formatting character, move it back
                if (cursorPos > 0) {
                    const charBefore = value[cursorPos - 1]
                    if ([' ', '(', ')', '-'].includes(charBefore)) {
                        const newValue = value.slice(0, cursorPos - 2) + value.slice(cursorPos)
                        onChange(newValue)
                        e.preventDefault()
                    }
                }
            }
        }

        return (
            <Input
                ref={ref}
                type="tel"
                value={formatPhoneNumber(value)}
                onChange={handleChange}
                onKeyDown={handleKeyDown}
                {...props}
            />
        )
    }
)

PhoneInput.displayName = "PhoneInput"
