using System;
using System.Collections.Concurrent;
using System.Collections.Generic;
using System.Diagnostics;
using System.IO;
using System.Linq;
using System.Net;
using System.Net.Sockets;
using System.Text;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using DashAdminAgent.Models;
using Microsoft.Win32;

namespace DashAdminAgent.Services;

public sealed class LanDiscoveryService : IDisposable
{
    private const int Port = 5555;
    private const string MagicWord = "DASHADMIN_MASTER:";
    private CancellationTokenSource? _cts;
    private readonly Action<string> _onMasterFound;
    private readonly Action<string> _log;

    public sealed class ActivePeer
    {
        public string IpAddress { get; set; } = "";
        public int Port { get; set; }
        public DateTime LastAnnounce { get; set; } = DateTime.UtcNow;
    }

    private readonly ConcurrentDictionary<string, List<ActivePeer>> _torrentPeers = new(StringComparer.OrdinalIgnoreCase);

    private readonly Func<string?> _getLibraryPath;

    public LanDiscoveryService(Action<string> onMasterFound, Action<string> log, Func<string?> getLibraryPath)
    {
        _onMasterFound = onMasterFound;
        _log = log;
        _getLibraryPath = getLibraryPath;
    }

    private HttpListener? _httpListener;
    private const int MaxParallelSyncs = 3;

    // Smart Queue Data Structures
    public sealed class QueueItem
    {
        public string ClientName { get; set; } = "";
        public int AppId { get; set; }
        public string Priority { get; set; } = "Normal"; // "High" or "Normal"
        public DateTime LastHeartbeat { get; set; } = DateTime.UtcNow;
        public string Status { get; set; } = "waiting"; // "waiting" or "approved"
    }

    private readonly List<QueueItem> _queueList = new();
    private readonly object _queueLock = new();

    // Outbound transfers telemetry tracking (Master side)
    private static readonly ConcurrentDictionary<string, (SyncTaskViewModel task, DateTime lastSeen)> _activeTransfers = new(StringComparer.OrdinalIgnoreCase);

    public void Start(bool isMaster)
    {
        Stop();
        _cts = new CancellationTokenSource();

        if (isMaster)
        {
            _log("[LAN] Режим Мастера: Трансляция в сеть и умная очередь...");
            Task.Run(() => MasterLoop(_cts.Token));
            Task.Run(() => QueueServerLoop(_cts.Token));
            Task.Run(() => CleanupQueueLoop(_cts.Token));
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
        _httpListener?.Stop();
        _httpListener = null;
    }

    public List<SyncTaskViewModel> GetActiveOutboundTransfers()
    {
        var now = DateTime.UtcNow;
        var list = new List<SyncTaskViewModel>();
        foreach (var key in _activeTransfers.Keys)
        {
            if (_activeTransfers.TryGetValue(key, out var val))
            {
                if ((now - val.lastSeen).TotalSeconds > 6)
                {
                    _activeTransfers.TryRemove(key, out _);
                }
                else
                {
                    list.Add(val.task);
                }
            }
        }
        return list;
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

    private async Task CleanupQueueLoop(CancellationToken ct)
    {
        while (!ct.IsCancellationRequested)
        {
            try
            {
                await Task.Delay(3000, ct);
                lock (_queueLock)
                {
                    var now = DateTime.UtcNow;
                    for (int i = _queueList.Count - 1; i >= 0; i--)
                    {
                        if ((now - _queueList[i].LastHeartbeat).TotalSeconds > 10)
                        {
                            _log($"[Queue] Клиент {_queueList[i].ClientName} пропал (таймаут 10с). Удален из очереди.");
                            _queueList.RemoveAt(i);
                        }
                    }

                    // Re-allocate slots
                    int approvedCount = _queueList.Count(x => x.Status == "approved");
                    if (approvedCount < MaxParallelSyncs)
                    {
                        foreach (var item in _queueList)
                        {
                            if (item.Status == "waiting")
                            {
                                item.Status = "approved";
                                approvedCount++;
                                _log($"[Queue] Одобрен слот для {item.ClientName} (после очистки очереди)");
                                if (approvedCount >= MaxParallelSyncs) break;
                            }
                        }
                    }
                }

                // Clean stale outbound transfers from UI
                GetActiveOutboundTransfers();

                // Cleanup stale torrent peers
                var utcNow = DateTime.UtcNow;
                foreach (var hash in _torrentPeers.Keys)
                {
                    if (_torrentPeers.TryGetValue(hash, out var plist))
                    {
                        lock (plist)
                        {
                            plist.RemoveAll(p => (utcNow - p.LastAnnounce).TotalMinutes > 5);
                        }
                    }
                }
            }
            catch (OperationCanceledException) { break; }
            catch { }
        }
    }

    private void HandleQueueRequest(HttpListenerContext context)
    {
        using var response = context.Response;
        var path = context.Request.Url?.AbsolutePath;

        if (path == "/request")
        {
            var clientName = context.Request.QueryString["client"] ?? "Unknown";
            var appIdStr = context.Request.QueryString["appId"] ?? "0";
            int.TryParse(appIdStr, out var appId);
            var priority = context.Request.QueryString["priority"] ?? "Normal";

            lock (_queueLock)
            {
                var existing = _queueList.Find(x => x.ClientName.Equals(clientName, StringComparison.OrdinalIgnoreCase) && x.AppId == appId);
                if (existing == null)
                {
                    existing = new QueueItem
                    {
                        ClientName = clientName,
                        AppId = appId,
                        Priority = priority,
                        Status = "waiting",
                        LastHeartbeat = DateTime.UtcNow
                    };

                    if (priority.Equals("High", StringComparison.OrdinalIgnoreCase))
                    {
                        // High priority jumps in front of all waiting Normal priority items
                        int insertIndex = 0;
                        for (int i = 0; i < _queueList.Count; i++)
                        {
                            if (_queueList[i].Status == "approved" || _queueList[i].Priority.Equals("High", StringComparison.OrdinalIgnoreCase))
                            {
                                insertIndex = i + 1;
                            }
                        }
                        _queueList.Insert(insertIndex, existing);
                        _log($"[Queue] Добавлен в начало очереди: {clientName} (Высокий приоритет, AppID: {appId})");
                    }
                    else
                    {
                        _queueList.Add(existing);
                        _log($"[Queue] Добавлен в очередь: {clientName} (Обычный приоритет, AppID: {appId})");
                    }
                }
                else
                {
                    existing.LastHeartbeat = DateTime.UtcNow;

                    // Promote to high priority if triggered locally
                    if (priority.Equals("High", StringComparison.OrdinalIgnoreCase) && !existing.Priority.Equals("High", StringComparison.OrdinalIgnoreCase) && existing.Status == "waiting")
                    {
                        existing.Priority = "High";
                        _queueList.Remove(existing);
                        
                        int insertIndex = 0;
                        for (int i = 0; i < _queueList.Count; i++)
                        {
                            if (_queueList[i].Status == "approved" || _queueList[i].Priority.Equals("High", StringComparison.OrdinalIgnoreCase))
                            {
                                insertIndex = i + 1;
                            }
                        }
                        _queueList.Insert(insertIndex, existing);
                        _log($"[Queue] Повышен приоритет до ВЫСОКОГО: {clientName} (AppID: {appId})");
                    }
                }

                // Dynamic Slot Allocation
                int approvedCount = _queueList.Count(x => x.Status == "approved");
                if (approvedCount < MaxParallelSyncs)
                {
                    foreach (var item in _queueList)
                    {
                        if (item.Status == "waiting")
                        {
                            item.Status = "approved";
                            approvedCount++;
                            _log($"[Queue] Слоты свободны ({approvedCount}/{MaxParallelSyncs}). Одобрен: {item.ClientName} (AppID: {item.AppId})");
                            if (approvedCount >= MaxParallelSyncs) break;
                        }
                    }
                }

                response.ContentType = "application/json";
                if (existing.Status == "approved")
                {
                    byte[] buf = Encoding.UTF8.GetBytes("{\"status\":\"approved\"}");
                    response.OutputStream.Write(buf, 0, buf.Length);
                }
                else
                {
                    int pos = _queueList.IndexOf(existing) - _queueList.Count(x => x.Status == "approved") + 1;
                    int total = _queueList.Count - _queueList.Count(x => x.Status == "approved");
                    byte[] buf = Encoding.UTF8.GetBytes($"{{\"status\":\"waiting\",\"position\":{pos},\"total_queued\":{total}}}");
                    response.OutputStream.Write(buf, 0, buf.Length);
                }
            }
        }
        else if (path == "/report")
        {
            try
            {
                using var reader = new StreamReader(context.Request.InputStream, context.Request.ContentEncoding);
                var body = reader.ReadToEnd();
                using var doc = JsonDocument.Parse(body);
                var root = doc.RootElement;
                
                var clientName = root.GetProperty("client").GetString() ?? "Unknown";
                var appId = root.GetProperty("app_id").GetInt32();
                var gameName = root.GetProperty("game_name").GetString() ?? "Game";
                var speed = root.GetProperty("speed").GetString() ?? "";
                var progress = root.GetProperty("progress").GetDouble();
                var remainingSize = root.GetProperty("remaining_size").GetString() ?? "";
                var totalSize = root.GetProperty("total_size").GetString() ?? "";
                var currentFile = root.GetProperty("current_file").GetString() ?? "";

                var task = new SyncTaskViewModel
                {
                    GameName = gameName,
                    AppId = appId,
                    Direction = clientName,
                    Speed = speed,
                    Progress = progress,
                    RemainingSize = remainingSize,
                    TotalSize = totalSize,
                    CurrentFile = currentFile,
                    IsActive = true,
                    Status = "Активно"
                };

                _activeTransfers[clientName + "_" + appId] = (task, DateTime.UtcNow);

                byte[] buf = Encoding.UTF8.GetBytes("{\"status\":\"ok\"}");
                response.ContentType = "application/json";
                response.OutputStream.Write(buf, 0, buf.Length);
            }
            catch (Exception ex)
            {
                response.StatusCode = (int)HttpStatusCode.BadRequest;
                _log($"[Queue] Ошибка /report: {ex.Message}");
            }
        }
        else if (path == "/release")
        {
            var clientName = context.Request.QueryString["client"] ?? "Unknown";
            var appIdStr = context.Request.QueryString["appId"] ?? "0";
            int.TryParse(appIdStr, out var appId);

            lock (_queueLock)
            {
                var item = _queueList.Find(x => x.ClientName.Equals(clientName, StringComparison.OrdinalIgnoreCase) && x.AppId == appId);
                if (item != null)
                {
                    _queueList.Remove(item);
                    _log($"[Queue] Клиент {clientName} завершил работу и освободил слот (AppID: {appId})");
                }

                // Re-allocate slots
                int approvedCount = _queueList.Count(x => x.Status == "approved");
                if (approvedCount < MaxParallelSyncs)
                {
                    foreach (var qi in _queueList)
                    {
                        if (qi.Status == "waiting")
                        {
                            qi.Status = "approved";
                            approvedCount++;
                            _log($"[Queue] Одобрен слот для {qi.ClientName} (AppID: {qi.AppId})");
                            if (approvedCount >= MaxParallelSyncs) break;
                        }
                    }
                }
            }

            _activeTransfers.TryRemove(clientName + "_" + appId, out _);

            byte[] buf = Encoding.UTF8.GetBytes("{\"status\":\"released\"}");
            response.ContentType = "application/json";
            response.OutputStream.Write(buf, 0, buf.Length);
        }
        else if (path == "/announce")
        {
            try
            {
                var rawUrl = context.Request.RawUrl ?? "";
                var infoHashHex = ExtractInfoHashHex(rawUrl);

                var portStr = context.Request.QueryString["port"] ?? "6881";
                int.TryParse(portStr, out var port);

                var clientIp = context.Request.RemoteEndPoint?.Address.ToString() ?? "127.0.0.1";
                if (clientIp == "::1") clientIp = "127.0.0.1";

                if (!string.IsNullOrEmpty(infoHashHex))
                {
                    var list = _torrentPeers.GetOrAdd(infoHashHex, _ => new List<ActivePeer>());
                    lock (list)
                    {
                        var existing = list.Find(p => p.IpAddress == clientIp && p.Port == port);
                        if (existing == null)
                        {
                            list.Add(new ActivePeer { IpAddress = clientIp, Port = port, LastAnnounce = DateTime.UtcNow });
                        }
                        else
                        {
                            existing.LastAnnounce = DateTime.UtcNow;
                        }
                    }
                }

                var peersToSend = new List<ActivePeer>();
                if (!string.IsNullOrEmpty(infoHashHex) && _torrentPeers.TryGetValue(infoHashHex, out var allPeers))
                {
                    lock (allPeers)
                    {
                        foreach (var p in allPeers)
                        {
                            if (p.IpAddress == clientIp && p.Port == port) continue;
                            peersToSend.Add(p);
                        }
                    }
                }

                var compactPeers = new List<byte>();
                foreach (var p in peersToSend)
                {
                    if (IPAddress.TryParse(p.IpAddress, out var ipAddr))
                    {
                        if (ipAddr.AddressFamily == AddressFamily.InterNetwork)
                        {
                            var ipBytes = ipAddr.GetAddressBytes();
                            byte[] portBytes = new byte[2];
                            portBytes[0] = (byte)((p.Port >> 8) & 0xFF);
                            portBytes[1] = (byte)(p.Port & 0xFF);
                            compactPeers.AddRange(ipBytes);
                            compactPeers.AddRange(portBytes);
                        }
                    }
                }

                var peersByteStringHeader = $"{compactPeers.Count}:";
                var headerBytes = Encoding.UTF8.GetBytes($"d8:intervali120e5:peers{peersByteStringHeader}");
                var footerBytes = Encoding.UTF8.GetBytes("e");

                response.ContentType = "text/plain";
                response.StatusCode = (int)HttpStatusCode.OK;

                response.OutputStream.Write(headerBytes, 0, headerBytes.Length);
                if (compactPeers.Count > 0)
                {
                    var compactArray = compactPeers.ToArray();
                    response.OutputStream.Write(compactArray, 0, compactArray.Length);
                }
                response.OutputStream.Write(footerBytes, 0, footerBytes.Length);
            }
            catch (Exception ex)
            {
                response.StatusCode = (int)HttpStatusCode.BadRequest;
                _log($"[Queue] Ошибка /announce: {ex.Message}");
            }
        }
        else if (path.StartsWith("/torrents/"))
        {
            var fileName = Path.GetFileName(path);
            var torrentsDir = Path.Combine(AppDomain.CurrentDomain.BaseDirectory, "torrents");
            var filePath = Path.Combine(torrentsDir, fileName);

            if (File.Exists(filePath))
            {
                try
                {
                    byte[] fileBytes = await File.ReadAllBytesAsync(filePath);
                    response.ContentType = "application/x-bittorrent";
                    response.StatusCode = (int)HttpStatusCode.OK;
                    response.OutputStream.Write(fileBytes, 0, fileBytes.Length);
                }
                catch (Exception ex)
                {
                    response.StatusCode = (int)HttpStatusCode.InternalServerError;
                    _log($"[Queue] Ошибка чтения торрент-файла: {ex.Message}");
                }
            }
            else
            {
                response.StatusCode = (int)HttpStatusCode.NotFound;
            }
        }
        else if (path.StartsWith("/manifests/"))
        {
            var appIdStr = Path.GetFileName(path);
            if (int.TryParse(appIdStr, out var appId))
            {
                var localSteam = _getLibraryPath();
                if (!string.IsNullOrEmpty(localSteam))
                {
                    var acfPath = Path.Combine(localSteam, "steamapps", $"appmanifest_{appId}.acf");
                    if (File.Exists(acfPath))
                    {
                        try
                        {
                            byte[] acfBytes = await File.ReadAllBytesAsync(acfPath);
                            response.ContentType = "text/plain";
                            response.StatusCode = (int)HttpStatusCode.OK;
                            response.OutputStream.Write(acfBytes, 0, acfBytes.Length);
                            return;
                        }
                        catch (Exception ex)
                        {
                            _log($"[Queue] Ошибка чтения манифеста: {ex.Message}");
                        }
                    }
                }
            }
            response.StatusCode = (int)HttpStatusCode.NotFound;
        }
    }

    private string ExtractInfoHashHex(string rawUrl)
    {
        int index = rawUrl.IndexOf("info_hash=", StringComparison.OrdinalIgnoreCase);
        if (index == -1) return "";
        int start = index + 10;
        int end = rawUrl.IndexOf('&', start);
        string val = end == -1 ? rawUrl.Substring(start) : rawUrl.Substring(start, end - start);

        var bytes = new List<byte>();
        for (int i = 0; i < val.Length; i++)
        {
            if (val[i] == '%' && i + 2 < val.Length)
            {
                var hex = val.Substring(i + 1, 2);
                if (byte.TryParse(hex, System.Globalization.NumberStyles.HexNumber, null, out var b))
                {
                    bytes.Add(b);
                }
                i += 2;
            }
            else if (val[i] == '+')
            {
                bytes.Add((byte)' ');
            }
            else
            {
                bytes.Add((byte)val[i]);
            }
        }

        return Convert.ToHexString(bytes.ToArray());
    }

    private string GetLocalIPAddress()
    {
        try
        {
            using var socket = new Socket(AddressFamily.InterNetwork, SocketType.Dgram, 0);
            socket.Connect("8.8.8.8", 65530); // Dummy local routing table lookup
            if (socket.LocalEndPoint is IPEndPoint endPoint)
            {
                return endPoint.Address.ToString();
            }
        }
        catch { }

        try
        {
            var host = Dns.GetHostEntry(Dns.GetHostName());
            foreach (var ip in host.AddressList)
            {
                if (ip.AddressFamily == AddressFamily.InterNetwork && !IPAddress.IsLoopback(ip))
                {
                    return ip.ToString();
                }
            }
        }
        catch { }
        return "127.0.0.1";
    }

    private async Task MasterLoop(CancellationToken ct)
    {
        try
        {
            using var client = new UdpClient { EnableBroadcast = true };
            using (ct.Register(() => { try { client.Close(); } catch { } }))
            {
                var endpoint = new IPEndPoint(IPAddress.Broadcast, Port);
                
                while (!ct.IsCancellationRequested)
                {
                    try
                    {
                        var ip = GetLocalIPAddress();
                        var message = Encoding.UTF8.GetBytes($"{MagicWord}\\\\{ip}\\SteamGames");
                        await client.SendAsync(message, message.Length, endpoint);
                        await Task.Delay(30000, ct); 
                    }
                    catch (OperationCanceledException) { break; }
                    catch { }
                }
            }
        }
        catch { }
    }

    private async Task ClientLoop(CancellationToken ct)
    {
        UdpClient client;
        try 
        {
            client = new UdpClient(Port);
            client.Client.SetSocketOption(SocketOptionLevel.Socket, SocketOptionName.ReuseAddress, true);
        }
        catch (Exception ex)
        {
            _log($"❌ [LAN] Ошибка запуска слушателя: {ex.Message}");
            return;
        }
        
        using (client)
        using (ct.Register(() => { try { client.Close(); } catch { } }))
        {
            while (!ct.IsCancellationRequested)
            {
                try
                {
                    var result = await client.ReceiveAsync(ct);
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
                    if (ct.IsCancellationRequested) break;
                    _log($"[LAN] Ошибка приема UDP: {ex.Message}");
                    await Task.Delay(2000, ct);
                }
            }
        }
    }

    public void Dispose() => Stop();
}
