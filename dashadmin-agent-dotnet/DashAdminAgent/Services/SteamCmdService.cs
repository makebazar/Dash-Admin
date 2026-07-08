using System;
using System.Diagnostics;
using System.IO;
using System.Threading.Tasks;

namespace DashAdminAgent.Services;

public sealed class SteamCmdService
{
    public SteamCmdService() { }

    public async Task RunUpdateAsync(int appId, string installDir, string libraryPath, Action<string, double> onProgress, Action<string, string, string> log)
    {
        // 1. Check if SteamCMD exists
        var steamCmdPath = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "steamcmd", "steamcmd.exe");
        if (!File.Exists(steamCmdPath))
        {
            log("error", "SteamCMD не найден", steamCmdPath);
            onProgress("Ошибка: SteamCMD", 0);
            return;
        }

        // 2. Build arguments
        // +force_install_dir "path" +login anonymous +app_update ID +quit
        var installPath = Path.Combine(libraryPath, "steamapps", "common", installDir);
        var args = $"+force_install_dir \"{installPath}\" +login anonymous +app_update {appId} validate +quit";

        var startInfo = new ProcessStartInfo
        {
            FileName = steamCmdPath,
            Arguments = args,
            UseShellExecute = false,
            CreateNoWindow = true,
            RedirectStandardOutput = true
        };

        using var process = new Process { StartInfo = startInfo };
        
        process.OutputDataReceived += (s, e) =>
        {
            if (string.IsNullOrEmpty(e.Data)) return;
            log("debug", "SteamCMD", e.Data);
            
            // Basic parsing of SteamCMD progress: "Update state (0x...) 45.12% ..."
            if (e.Data.Contains("%"))
            {
                var parts = e.Data.Split(' ');
                foreach (var p in parts)
                {
                    if (p.EndsWith("%") && double.TryParse(p.TrimEnd('%'), out var prg))
                    {
                        onProgress("Загрузка из Steam...", prg);
                        break;
                    }
                }
            }
        };

        process.Start();
        process.BeginOutputReadLine();
        await process.WaitForExitAsync();

        if (process.ExitCode == 0)
        {
            onProgress("Готово!", 100);
        }
        else
        {
            log("error", "SteamCMD завершился с ошибкой", $"Код: {process.ExitCode}");
        }
    }

    public void InstallViaSteamProtocol(int appId)
    {
        try
        {
            Process.Start(new ProcessStartInfo($"steam://install/{appId}") { UseShellExecute = true });
        }
        catch { }
    }
}
