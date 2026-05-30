using System;
using System.Diagnostics;
using System.IO;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Threading;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace DashAdminAgent.Services;

public sealed class LanDiscoveryService : IDisposable
{
    private const int Port = 5555;
    private const string MagicWord = "DASHADMIN_MASTER:";
    private UdpClient? _udpClient;
    private CancellationTokenSource? _cts;
    private readonly Action<string> _onMasterFound;
    private readonly Action<string> _log;

    public LanDiscoveryService(Action<string> onMasterFound, Action<string> log)
    {
        _onMasterFound = onMasterFound;
        _log = log;
    }

    private HttpListener? _httpListener;
    private int _activeSyncs = 0;
    private const int MaxParallelSyncs = 3;

    public void Start(bool isMaster)
    {
        Stop();
        _cts = new CancellationTokenSource();

        if (isMaster)
        {
            _log("[LAN] Режим Мастера: Настройка доступа и очереди...");
            SetupMasterShare();
            Task.Run(() => MasterLoop(_cts.Token));
            Task.Run(() => QueueServerLoop(_cts.Token));
        }
        else
        {
            _log("[LAN] Режим Клиента: Ожидание эталона...");
            Task.Run(() => ClientLoop(_cts.Token));
        }
    }

    public void Stop()
    {
        _cts?.Cancel();
        _udpClient?.Close();
        _udpClient = null;
        _httpListener?.Stop();
        _httpListener = null;
    }

    private async Task QueueServerLoop(CancellationToken ct)
    {
        try {
            _httpListener = new HttpListener();
            _httpListener.Prefixes.Add($"http://*:{Port + 1}/");
            _httpListener.Start();

            while (!ct.IsCancellationRequested)
            {
                var context = await _httpListener.GetContextAsync();
                _ = Task.Run(() => HandleQueueRequest(context));
            }
        } catch { }
    }

    private void HandleQueueRequest(HttpListenerContext context)
    {
        using var response = context.Response;
        var path = context.Request.Url?.AbsolutePath;

        if (path == "/request")
        {
            if (Interlocked.CompareExchange(ref _activeSyncs, 0, 0) < MaxParallelSyncs)
            {
                Interlocked.Increment(ref _activeSyncs);
                byte[] buf = Encoding.UTF8.GetBytes("OK");
                response.OutputStream.Write(buf, 0, buf.Length);
                _log($"[Queue] Клиент начал синхронизацию ({_activeSyncs}/{MaxParallelSyncs})");
            }
            else
            {
                response.StatusCode = (int)HttpStatusCode.ServiceUnavailable;
            }
        }
        else if (path == "/release")
        {
            Interlocked.Decrement(ref _activeSyncs);
            if (_activeSyncs < 0) _activeSyncs = 0;
            _log($"[Queue] Клиент завершил работу ({_activeSyncs}/{MaxParallelSyncs})");
        }
    }

    private string? FindSteamPath()
    {
        // Try multiple registry locations
        string[] keys = {
            @"HKEY_CURRENT_USER\Software\Valve\Steam",
            @"HKEY_LOCAL_MACHINE\SOFTWARE\Valve\Steam",
            @"HKEY_LOCAL_MACHINE\SOFTWARE\WOW6432Node\Valve\Steam"
        };
        string[] values = { "SteamPath", "InstallPath" };

        foreach (var keyPath in keys)
        {
            foreach (var valName in values)
            {
                try {
                    var val = Registry.GetValue(keyPath, valName, null) as string;
                    if (!string.IsNullOrEmpty(val) && Directory.Exists(val)) return val;
                } catch { }
            }
        }
        
        // Fallback to common path
        var fallback = @"C:\Program Files (x86)\Steam";
        return Directory.Exists(fallback) ? fallback : null;
    }

    private void SetupMasterShare()
    {
        try
        {
            string? steamPath = FindSteamPath();

            if (string.IsNullOrEmpty(steamPath))
            {
                _log("❌ [LAN] Не удалось найти папку Steam для общего доступа.");
                return;
            }

            _log($"[LAN] Использую путь для шары: {steamPath}");
            var shareName = "SteamGames";

            // POWERSHELL "ULTIMATE ACCESS" SCRIPT WITH LOCALIZATION FIX
            var psScript = $@"
                Write-Host '--- НАСТРОЙКА СЕТЕВОГО ДОСТУПА DASHADMIN ---' -ForegroundColor Cyan
                
                # Resolve localized name for 'Everyone' (S-1-1-0)
                $sid = New-Object System.Security.Principal.SecurityIdentifier('S-1-1-0')
                $everyone = $sid.Translate([System.Security.Principal.NTAccount]).Value
                Write-Host ""[INFO] Группа 'Все' в этой системе: $everyone"" -ForegroundColor Gray

                function Set-Reg {{
                    param($path, $name, $value)
                    if (!(Test-Path $path)) {{ New-Item -Path $path -Force | Out-Null }}
                    Set-ItemProperty -Path $path -Name $name -Value $value -Force
                    Write-Host ""[OK] Реестр: $name = $value"" -ForegroundColor Green
                }}

                try {{
                    # 1. Guest Access
                    Set-Reg 'HKLM:\SYSTEM\CurrentControlSet\Services\LanmanWorkstation\Parameters' 'AllowInsecureGuestAuth' 1
                    Set-Reg 'HKLM:\SYSTEM\CurrentControlSet\Control\Lsa' 'everyoneincludesanonymous' 1
                    Set-Reg 'HKLM:\SYSTEM\CurrentControlSet\Services\LanmanServer\Parameters' 'restrictnullsessaccess' 0
                    
                    # 2. NTFS Permissions using universal SID
                    Write-Host '[...] Настройка прав NTFS (это может занять время)...'
                    icacls '{steamPath}' /grant '*S-1-1-0:(OI)(CI)R' /T /C /Q | Out-Null
                    Write-Host '[OK] Права NTFS настроены.' -ForegroundColor Green
                    
                    # 3. Network Share using localized name
                    Write-Host ""[...] Создание сетевой папки {shareName} для $everyone...""
                    net share {shareName} /delete /y 2>$null
                    $res = net share {shareName}='{steamPath}' /GRANT:""$everyone"",READ
                    if ($LASTEXITCODE -eq 0) {{ 
                        Write-Host '[OK] Сетевая папка успешно создана!' -ForegroundColor Green 
                    }} else {{
                        Write-Host ""[!] Ошибка создания папки net share. Код: $LASTEXITCODE"" -ForegroundColor Red
                    }}

                }} catch {{
                    Write-Host ""❌ КРИТИЧЕСКАЯ ОШИБКА: $($_.Exception.Message)"" -ForegroundColor Red
                }}

                Write-Host '--------------------------------------------'
                Write-Host 'Настройка завершена. Нажмите ENTER для закрытия...'
                Read-Host
            ";

            var startInfo = new ProcessStartInfo
            {
                FileName = "powershell.exe",
                Arguments = $"-NoProfile -ExecutionPolicy Bypass -Command \"{psScript.Replace("\"", "\\\"")}\"",
                Verb = "runas",
                UseShellExecute = true,
                CreateNoWindow = false
            };

            Process.Start(startInfo);
            _log($"[LAN] Запущена интерактивная настройка для {shareName}.");
        }
        catch (Exception ex)
        {
            _log($"❌ [LAN] Ошибка настройки: {ex.Message}");
        }
    }

    private string GetLocalIPAddress()
    {
        var host = Dns.GetHostEntry(Dns.GetHostName());
        foreach (var ip in host.AddressList)
        {
            if (ip.AddressFamily == AddressFamily.InterNetwork)
            {
                return ip.ToString();
            }
        }
        return Environment.MachineName; // Fallback to hostname
    }

    private async Task MasterLoop(CancellationToken ct)
    {
        _udpClient = new UdpClient { EnableBroadcast = true };
        var endpoint = new IPEndPoint(IPAddress.Broadcast, Port);
        
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var ip = GetLocalIPAddress();
                var message = Encoding.UTF8.GetBytes($"{MagicWord}\\\\{ip}\\SteamGames");
                await _udpClient.SendAsync(message, message.Length, endpoint);
                await Task.Delay(30000, ct); 
            }
            catch { /* Ignore errors during broadcast */ }
        }
    }

    private async Task ClientLoop(CancellationToken ct)
    {
        try 
        {
            _udpClient = new UdpClient(Port);
            // Allow multiple apps to bind to the same port if needed
            _udpClient.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
        }
        catch (Exception ex)
        {
            _log($"❌ [LAN] Ошибка запуска слушателя: {ex.Message}");
            return;
        }
        
        while (!ct.IsCancellationRequested)
        {
            try
            {
                var result = await _udpClient.ReceiveAsync(ct);
                var message = Encoding.UTF8.GetString(result.Buffer);

                if (message.StartsWith(MagicWord))
                {
                    var path = message.Substring(MagicWord.Length);
                    _onMasterFound(path);
                }
            }
            catch (OperationCanceledException) { break; }
            catch (Exception ex)
            {
                _log($"[LAN] Ошибка приема UDP: {ex.Message}");
                // Critical: prevent busy loop on network errors
                await Task.Delay(2000, ct);
            }
        }
    }

    public void Dispose() => Stop();
}
