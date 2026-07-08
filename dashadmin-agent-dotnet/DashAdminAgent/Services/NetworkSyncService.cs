using System;
using System.IO;
using System.Net.Http;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;

namespace DashAdminAgent.Services;

public sealed class NetworkSyncService
{
    private readonly CustomSyncEngine _syncEngine = new();

    public NetworkSyncService() { }

    public async Task RunSyncAsync(
        int appId, string gameName, string installDir, string sourceLibrary, string destLibrary, 
        string priority,
        Action<string, double, string, string, string> onProgress,
        Action<string, string, string> log)
    {
        bool hasPermit = false;
        var masterIp = ExtractIp(sourceLibrary);
        var queueUrl = $"http://{masterIp}:5556";
        var clientName = Environment.MachineName;

        using var http = new HttpClient { Timeout = TimeSpan.FromSeconds(5) };

        try
        {
            onProgress("Запрос очереди...", 0, "0 MB/s", "-", "-");
            
            int attempts = 0;
            while (!hasPermit)
            {
                try 
                {
                    var url = $"{queueUrl}/request?client={Uri.EscapeDataString(clientName)}&appId={appId}&priority={priority}";
                    var resp = await http.GetAsync(url);
                    if (resp.IsSuccessStatusCode) 
                    {
                        var body = await resp.Content.ReadAsStringAsync();
                        using var doc = JsonDocument.Parse(body);
                        var status = doc.RootElement.GetProperty("status").GetString();
                        
                        if (status == "approved") 
                        {
                            hasPermit = true;
                        }
                        else 
                        {
                            int pos = doc.RootElement.GetProperty("position").GetInt32();
                            int total = doc.RootElement.GetProperty("total_queued").GetInt32();
                            onProgress($"В очереди (Позиция: {pos}/{total})...", 0, "0 MB/s", "-", "-");
                        }
                    }
                    else 
                    {
                        attempts++;
                        if (attempts >= 3) 
                        {
                            log("warning", "Служба очередей выдала ошибку", "Вход в обход очереди (резервный путь)");
                            hasPermit = true;
                        }
                        else
                        {
                            await Task.Delay(3000);
                        }
                    }
                } 
                catch (Exception ex)
                {
                    attempts++;
                    if (attempts >= 3) 
                    {
                        log("warning", "Мастер-сервер очередей недоступен", $"Ошибка: {ex.Message}. Запуск в обход очереди.");
                        hasPermit = true;
                    }
                    else
                    {
                        await Task.Delay(3000);
                    }
                }
            }

            // High-performance Copy
            var lastReportTime = DateTime.MinValue;

            await _syncEngine.RunSyncAsync(appId, gameName, installDir, sourceLibrary, destLibrary,
                (fileName, progressPercentage, speedVal, downloadedText, totalText) =>
                {
                    onProgress(fileName, progressPercentage, speedVal, downloadedText, totalText);

                    // Send telemetry report to Master every 1 second
                    var now = DateTime.UtcNow;
                    if ((now - lastReportTime).TotalMilliseconds >= 1000)
                    {
                        lastReportTime = now;
                        _ = Task.Run(async () =>
                        {
                            try
                            {
                                var payload = new
                                {
                                    client = clientName,
                                    app_id = appId,
                                    game_name = gameName,
                                    speed = speedVal,
                                    progress = progressPercentage,
                                    remaining_size = downloadedText,
                                    total_size = totalText,
                                    current_file = fileName.StartsWith("Копирование: ") ? fileName.Substring("Копирование: ".Length) : fileName
                                };
                                var json = JsonSerializer.Serialize(payload);
                                using var content = new StringContent(json, Encoding.UTF8, "application/json");
                                await http.PostAsync($"{queueUrl}/report", content);
                            }
                            catch { }
                        });
                    }
                },
                (level, message, detail) => log(level, message, detail));
        }
        finally
        {
            if (hasPermit) 
            { 
                try 
                { 
                    await http.GetAsync($"{queueUrl}/release?client={Uri.EscapeDataString(clientName)}&appId={appId}"); 
                } 
                catch { } 
            }
        }
    }

    private string ExtractIp(string path)
    {
        var parts = path.Split('\\', StringSplitOptions.RemoveEmptyEntries);
        return parts.Length > 0 ? parts[0] : "localhost";
    }
}
