"use client";

import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { QRCode } from "@/components/qr/QRCode";
import { Monitor, Info, ChevronRight, QrCode } from "lucide-react";

interface HandoverTerminalDialogProps {
  isOpen: boolean;
  onClose: () => void;
  clubId: string;
  shiftId: string;
  type: "OPEN" | "CLOSE";
  blindMode?: boolean;
}

export function HandoverTerminalDialog({
  isOpen,
  onClose,
  clubId,
  shiftId,
  type,
  blindMode = false,
}: HandoverTerminalDialogProps) {
  const terminalUrl = `${window.location.origin}/employee/terminal/handover/${type}/${shiftId}?clubId=${clubId}${blindMode ? '&blind=true' : ''}`;

  return (
    <Dialog open={isOpen} onOpenChange={onClose}>
      <DialogContent className="max-w-sm bg-zinc-950 border-zinc-800 text-zinc-100 rounded-[2.5rem] p-0 overflow-hidden">
        <div className="p-8 space-y-8">
          <div className="space-y-4 text-center">
            <div className="h-20 w-20 rounded-[2rem] bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-500 mx-auto">
              <QrCode className="h-10 w-10" />
            </div>
            <div className="space-y-2">
              <DialogTitle className="text-xl font-black text-white uppercase italic tracking-tight">
                {type === "OPEN" ? "Приемка бара" : "Сдача бара"}
              </DialogTitle>
              <DialogDescription className="text-sm text-zinc-500 font-medium leading-relaxed">
                Для быстрого подсчета товаров прямо у витрины используйте мобильный терминал
              </DialogDescription>
            </div>
          </div>

          <div className="bg-white p-5 rounded-[2rem] flex items-center justify-center shadow-[0_0_50px_rgba(16,185,129,0.1)] border-4 border-zinc-900 mx-auto w-fit">
            <QRCode value={terminalUrl} size={180} />
          </div>

          <div className="space-y-3">
            <Button
              className="w-full h-14 rounded-2xl bg-zinc-100 hover:bg-white text-zinc-950 font-black uppercase italic tracking-tighter shadow-lg transition-all active:scale-95"
              onClick={() => window.open(terminalUrl, "_blank")}
            >
              Открыть в браузере
              <ChevronRight className="ml-2 h-5 w-5" />
            </Button>

            <div className="p-4 rounded-2xl bg-zinc-900/50 border border-zinc-800 flex gap-3 items-start">
              <Info className="h-4 w-4 text-zinc-500 shrink-0 mt-0.5" />
              <p className="text-[11px] text-zinc-500 leading-relaxed font-medium">
                Отсканируйте код камерой телефона. Данные синхронизируются автоматически.
              </p>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
