import { syncSmartShellShifts } from "@/lib/smartshell/shift-sync";

export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  { params }: { params: Promise<{ clubId: string }> }
) {
  const { clubId } = await params;
  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      let isAborted = false;

      request.signal.addEventListener("abort", () => {
        isAborted = true;
      });

      let lastFingerprint = "";

      const runSync = async () => {
        if (isAborted) return;
        try {
          const result = await syncSmartShellShifts(clubId);
          
          // Вычисление фингерпринта для отправки только изменившихся данных
          const fingerprint = JSON.stringify({
            synced: result.synced,
            shiftId: result.activeShift?.id || null,
            created: result.activeShift?.created_at || null,
            finished: result.activeShift?.finished_at || null,
            cash: result.activeShift?.money?.sum?.cash || 0,
            card: result.activeShift?.money?.sum?.card || 0,
            total: result.activeShift?.money?.sum?.total || 0,
            paymentsCount: Array.isArray(result.activeShift?.payments) ? result.activeShift.payments.length : 0,
            dbShiftId: result.dbShiftId || null,
            message: result.message || "",
          });

          if (fingerprint !== lastFingerprint) {
            lastFingerprint = fingerprint;
            const eventData = `data: ${JSON.stringify(result)}\n\n`;
            controller.enqueue(encoder.encode(eventData));
          }
        } catch (error: any) {
          console.error("SSE Sync Error:", error);
        }
      };

      // Первичная синхронизация при подключении клиента
      await runSync();

      // Живая проверка смены каждые 10 секунд
      const interval = setInterval(async () => {
        if (isAborted) {
          clearInterval(interval);
          controller.close();
          return;
        }
        await runSync();
      }, 10000);
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache, no-transform",
      Connection: "keep-alive",
    },
  });
}
