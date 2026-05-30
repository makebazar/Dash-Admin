using System;
using System.Diagnostics;
using System.Threading.Tasks;
using Microsoft.Win32;
using System.IO;

namespace DashAdminAgent.Services;

public sealed class SteamCmdService
{
    private const string SteamRegistryKey = @"Software\Valve\Steam";
    private const string SteamActiveProcessKey = @"Software\Valve\Steam\ActiveProcess";

    public SteamCmdService()
    {
    }

    private string? GetSteamExePath()
    {
        using var key = Registry.CurrentUser.OpenSubKey(SteamRegistryKey);
        return key?.GetValue("SteamExe") as string;
    }

    private int GetActiveUserId()
    {
        using var key = Registry.CurrentUser.OpenSubKey(SteamActiveProcessKey);
        var val = key?.GetValue("ActiveUser");
        return val is int userId ? userId : 0;
    }

    public async Task RunUpdateAsync(int appId, string gameName, string libraryDir, Action<string> log)
    {
        try
        {
            log($"[Steam] Подготовка обновления для {gameName}...");

            var steamExe = GetSteamExePath();
            var steamProcesses = Process.GetProcessesByName("steam");

            // 1. Проверяем, запущен ли Steam
            if (steamProcesses.Length == 0)
            {
                log("⚠️ Steam не запущен. Пытаюсь запустить...");
                if (!string.IsNullOrEmpty(steamExe) && File.Exists(steamExe))
                {
                    Process.Start(new ProcessStartInfo(steamExe) { UseShellExecute = true });
                    log("[Steam] Ожидание запуска клиента (10 сек)...");
                    await Task.Delay(10000);
                }
                else
                {
                    log("❌ Ошибка: Не удалось найти путь к steam.exe в реестре.");
                    return;
                }
            }

            // 2. Проверяем, залогинен ли пользователь
            int activeUser = GetActiveUserId();
            if (activeUser == 0)
            {
                log("⚠️ ВНИМАНИЕ: В Steam не выполнен вход!");
                log("⚠️ Пожалуйста, войдите в свой Steam аккаунт в открывшемся окне.");
                
                // Ждем немного, вдруг пользователь как раз заходит
                for (int i = 0; i < 5; i++)
                {
                    await Task.Delay(3000);
                    activeUser = GetActiveUserId();
                    if (activeUser != 0) break;
                }

                if (activeUser == 0)
                {
                    log("❌ Обновление отменено: требуется авторизация в Steam.");
                    return;
                }
            }

            // 3. Отправляем команду обновления
            string uri = $"steam://validate/{appId}";
            log($"[Steam] Отправка команды на обновление: {uri}");

            Process.Start(new ProcessStartInfo(uri) { UseShellExecute = true });
            log($"[Steam] Успешно! Проверьте прогресс в окне Steam.");
        }
        catch (Exception ex)
        {
            log($"[Steam] Ошибка: {ex.Message}");
        }
    }

    public async Task<bool> EnsureInstalledAsync(Action<string> log) => await Task.FromResult(true);
}
