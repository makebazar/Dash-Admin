using System;
using System.Diagnostics;
using System.IO;
using System.Net.Http;
using System.Threading.Tasks;

namespace DashAdminAgent.Services;

public sealed class NetworkSyncService
{
    public NetworkSyncService() { }

    public async Task RunSyncAsync(int appId, string installDir, string sourceLibrary, string destLibrary, Action<string> log)
    {
        bool hasPermit = false;
        var masterIp = ExtractIp(sourceLibrary);
        var queueUrl = $"http://{masterIp}:5556";
        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };

        try
        {
            // 0. Request permission from Master's Queue
            log("[Sync] Запрос места в очереди...");
            while (!hasPermit)
            {
                try {
                    var resp = await http.GetAsync($"{queueUrl}/request");
                    if (resp.IsSuccessStatusCode) {
                        hasPermit = true;
                        log("[Sync] Место получено. Начинаю работу.");
                    } else {
                        log("[Sync] Мастер занят. Ожидание очереди (5 сек)...");
                        await Task.Delay(5000);
                    }
                } catch {
                    log("[Sync] Ошибка связи с очередью Мастера. Пробую без очереди...");
                    hasPermit = true; // Fallback
                }
            }

            log($"[Sync] Синхронизация {installDir} по локальной сети...");

            // 1. Copy the ACF manifest file first so Steam recognizes the game
            var acfName = $"appmanifest_{appId}.acf";
            var sourceAcf = Path.Combine(sourceLibrary.TrimEnd('\\'), "steamapps", acfName);
            var destAcf = Path.Combine(destLibrary.TrimEnd('\\'), "steamapps", acfName);

            if (File.Exists(sourceAcf))
            {
                log($"[Sync] Копирование манифеста {acfName}...");
                try { File.Copy(sourceAcf, destAcf, true); }
                catch (Exception ex) { log($"⚠️ Ошибка копирования манифеста: {ex.Message}"); }
            }

            // 2. Sync game files
            var sourcePath = Path.Combine(sourceLibrary.TrimEnd('\\'), "steamapps", "common", installDir);
            var destPath = Path.Combine(destLibrary.TrimEnd('\\'), "steamapps", "common", installDir);

            if (!Directory.Exists(sourcePath))
            {
                log($"❌ Ошибка: Сетевой путь не найден: {sourcePath}");
                log("Убедитесь, что эталонная машина включена и папка расшарена.");
                return;
            }

            log($"[Sync] Источник: {sourcePath}");
            log($"[Sync] Назначение: {destPath}");

            // Robocopy command:
            // /MIR - Mirror (sync)
            // /MT:16 - Multithreaded (16 threads)
            // /R:3 /W:5 - 3 retries, 5 sec wait
            // /Z - Restartable mode (for network drops)
            // /NDL - No directory logging (cleaner output)
            // /NFL - No file logging (cleaner output)
            var args = $"\"{sourcePath}\" \"{destPath}\" /MIR /MT:16 /R:3 /W:5 /Z /NDL /NFL";

            log($"[Robocopy] Запуск: robocopy {args}");

            var startInfo = new ProcessStartInfo
            {
                FileName = "robocopy.exe",
                Arguments = args,
                UseShellExecute = false,
                RedirectStandardOutput = true,
                CreateNoWindow = true
            };

            using var process = new Process { StartInfo = startInfo };
            
            process.OutputDataReceived += (s, e) => { if (e.Data != null) log($"[Robocopy] {e.Data.Trim()}"); };
            
            process.Start();
            process.BeginOutputReadLine();
            
            await process.WaitForExitAsync();

            // Robocopy exit codes < 8 are successful
            if (process.ExitCode < 8)
            {
                log($"[Sync] Синхронизация {installDir} успешно завершена!");
            }
            else
            {
                log($"[Sync] Robocopy завершился с кодом {process.ExitCode}. Проверьте логи.");
            }
        }
        finally
        {
            if (hasPermit)
            {
                try { await http.GetAsync($"{queueUrl}/release"); } catch { }
            }
        }
    }

    private string ExtractIp(string path)
    {
        // Path looks like \\192.168.1.1\SteamGames
        var parts = path.Split('\\', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 0 ? parts[0] : "localhost";
    }
}
