"use client"

import { useState } from "react"
import { Button } from "@/components/ui/button"
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle } from "@/components/ui/dialog"

type ConfirmOptions = {
    title?: string
    description: string
    confirmText?: string
    cancelText?: string
}

type MessageOptions = {
    title?: string
    description: string
    buttonText?: string
}

type ConfirmState = ConfirmOptions & {
    resolve: (value: boolean) => void
}

export function useUiDialogs() {
    const [confirmState, setConfirmState] = useState<ConfirmState | null>(null)
    const [messageState, setMessageState] = useState<MessageOptions | null>(null)

    const confirmAction = (options: ConfirmOptions) =>
        new Promise<boolean>((resolve) => {
            setConfirmState({
                title: options.title || "Подтверждение",
                description: options.description,
                confirmText: options.confirmText || "Подтвердить",
                cancelText: options.cancelText || "Отмена",
                resolve,
            })
        })

    const showMessage = (options: MessageOptions) => {
        setMessageState({
            title: options.title || "Уведомление",
            description: options.description,
            buttonText: options.buttonText || "Понятно",
        })
    }

    const closeConfirm = (value: boolean) => {
        setConfirmState(prev => {
            if (prev) prev.resolve(value)
            return null
        })
    }

    const Dialogs = (
        <>
            <Dialog
                open={!!confirmState}
                onOpenChange={(open) => {
                    if (!open && confirmState) closeConfirm(false)
                }}
            >
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{confirmState?.title}</DialogTitle>
                        <DialogDescription>{confirmState?.description}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button variant="outline" onClick={() => closeConfirm(false)}>
                            {confirmState?.cancelText}
                        </Button>
                        <Button onClick={() => closeConfirm(true)}>
                            {confirmState?.confirmText}
                        </Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>

            <Dialog open={!!messageState} onOpenChange={(open) => !open && setMessageState(null)}>
                <DialogContent>
                    <DialogHeader>
                        <DialogTitle>{messageState?.title}</DialogTitle>
                        <DialogDescription>{messageState?.description}</DialogDescription>
                    </DialogHeader>
                    <DialogFooter>
                        <Button onClick={() => setMessageState(null)}>{messageState?.buttonText}</Button>
                    </DialogFooter>
                </DialogContent>
            </Dialog>
        </>
    )

    return { confirmAction, showMessage, Dialogs }
}
