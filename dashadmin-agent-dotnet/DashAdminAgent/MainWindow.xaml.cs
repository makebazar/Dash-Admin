using System;
using System.Collections.ObjectModel;
using System.ComponentModel;
using System.Collections.Generic;
using System.Diagnostics;
using System.Linq;
using System.Net.Http;
using System.Runtime.CompilerServices;
using System.Security.Cryptography;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using System.Windows;
using System.Windows.Media;
using System.Windows.Threading;
using DashAdminAgent.Models;
using DashAdminAgent.Services;

namespace DashAdminAgent;

public partial class MainWindow : Window
{
    private readonly ConfigService _configService = new();
    private readonly AgentApiClient _api = new(new HttpClient());
    private readonly HardwareMonitorService _hardware = new();
    private readonly SystemStatsService _systemStats = new();
    private readonly AgentConfig _config;
    private readonly NotifyIconHost _tray;
    private readonly DispatcherTimer _uiTimer;
    private readonly DispatcherTimer _sendTimer;
    private readonly MainWindowViewModel _vm;
    private CancellationTokenSource? _sendCts;

    public MainWindow()
    {
        InitializeComponent();
        _config = _configService.Load();
        _config.Hostname = Environment.MachineName;
        _tray = new NotifyIconHost(ShowFromTray, ExitFromTray);

        _vm = new MainWindowViewModel(_config);
        DataContext = _vm;
        _vm.AddLog("info", "Запуск", $"Hostname={_config.Hostname}");

        _uiTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(2) };
        _uiTimer.Tick += (_, _) => RefreshTelemetry();
        _uiTimer.Start();

        _sendTimer = new DispatcherTimer { Interval = TimeSpan.FromSeconds(30) };
        _sendTimer.Tick += async (_, _) => await SendTelemetryIfBound();
        _sendTimer.Start();

        Closing += OnClosing;

        if (!string.IsNullOrWhiteSpace(_config.WorkstationId))
        {
            _vm.SetStatus("Подключен", _vm.Ok);
        }
        else
        {
            _vm.SetStatus("Не подключен", _vm.Danger);
        }
    }

    private void OnClosing(object? sender, CancelEventArgs e)
    {
        _tray.Dispose();
        _sendCts?.Cancel();
        _hardware.Dispose();
    }

    private void RefreshTelemetry()
    {
        var (cpuTemp, cpuLoad, cpuName, gpus) = _hardware.Read();
        var (memTotal, memUsed) = _systemStats.GetMemory();

        _vm.CpuLoad = Math.Clamp(cpuLoad, 0, 100);
        _vm.CpuNameText = string.IsNullOrWhiteSpace(cpuName) ? "Unknown CPU" : cpuName;
        _vm.CpuTempText = cpuTemp > 0.1f ? $"{cpuTemp:0.0} °C" : "N/A";
        _vm.CpuLoadText = $"{_vm.CpuLoad:0.0} %";

        if (gpus.Count > 0)
        {
            var gpu = gpus[0];
            _vm.GpuNameText = string.IsNullOrWhiteSpace(gpu.name) ? "Unknown GPU" : gpu.name;
            _vm.GpuTempText = gpu.temp > 0.1f ? $"{gpu.temp:0.0} °C" : "N/A";
            _vm.GpuLoad = Math.Clamp(gpu.load, 0, 100);
            _vm.GpuLoadText = $"{_vm.GpuLoad:0.0} %";
        }
        else
        {
            _vm.GpuNameText = "No GPU detected";
            _vm.GpuTempText = "N/A";
            _vm.GpuLoad = 0;
            _vm.GpuLoadText = "0 %";
        }

        var devices = DeviceEnumerator.GetInputDevices();
        _vm.Devices.Clear();
        foreach (var d in devices)
        {
            var tracking = string.IsNullOrWhiteSpace(d.Id) ? "-" : d.Id;
            _vm.Devices.Add(new DeviceRow { Type = d.Type, Name = d.Name, Id = MakeShortId(tracking), FullId = d.RawId });
        }

        _vm.MemoryText = memTotal > 0
            ? $"{ToGiB(memUsed):0.0} / {ToGiB(memTotal):0.0} GB"
            : "N/A";

        var disks = _systemStats.GetDisks();
        _vm.Disks.Clear();
        foreach (var d in disks)
        {
            var used = d.totalBytes > d.freeBytes ? d.totalBytes - d.freeBytes : 0;
            _vm.Disks.Add(new DiskRow
            {
                Name = d.name,
                Mount = d.mount,
                UsedText = $"{ToGiB(used):0.0} / {ToGiB(d.totalBytes):0.0} GB"
            });
        }

        if (cpuTemp <= 0.1f)
        {
            _vm.HintText = "Температура CPU недоступна. На некоторых системах (в т.ч. Intel i5‑10400) это бывает из‑за ограничений доступа к датчикам или из‑за прав. Проверь запуск x64 и от администратора.";
        }
        else
        {
            _vm.HintText = "Телеметрия обновляется каждые 2 секунды. Отправка на сервер — каждые 30 секунд.";
        }
    }

    private static string MakeShortId(string id)
    {
        if (string.IsNullOrWhiteSpace(id) || id == "-") return "-";
        var s = id.Trim();

        if (Guid.TryParse(s, out var g))
        {
            return g.ToString("N")[..12];
        }

        if (s.Length <= 16 && s.All(char.IsLetterOrDigit))
        {
            return s.ToUpperInvariant();
        }

        var bytes = System.Text.Encoding.UTF8.GetBytes(s);
        var hash = SHA256.HashData(bytes);
        return Convert.ToHexString(hash)[..12];
    }

    private async Task SendTelemetryIfBound()
    {
        if (string.IsNullOrWhiteSpace(_config.WorkstationId)) return;

        _sendCts?.Cancel();
        _sendCts = new CancellationTokenSource(TimeSpan.FromSeconds(15));

        try
        {
            var (cpuTemp, cpuLoad, cpuName, gpus) = _hardware.Read();
            var devices = DeviceEnumerator.GetInputDevices();
            var (memTotal, memUsed) = _systemStats.GetMemory();
            var disks = _systemStats.GetDisks();

            var payload = new TelemetryPayload
            {
                WorkstationId = _config.WorkstationId,
                Hostname = _config.Hostname,
                Cpu = new TelemetryPayload.CpuPayload
                {
                    Temp = cpuTemp,
                    Usage = cpuLoad,
                    ModelName = cpuName
                },
                Memory = new TelemetryPayload.MemoryPayload
                {
                    TotalBytes = memTotal,
                    UsedBytes = memUsed
                },
                GpuData = gpus.Select(g => new TelemetryPayload.GpuPayload
                {
                    Name = g.name,
                    Temp = g.temp,
                    Usage = g.load,
                    MemoryUsed = g.memUsed,
                    MemoryTotal = g.memTotal
                }).ToList(),
                Disks = disks.Select(d => new TelemetryPayload.DiskPayload
                {
                    Name = d.name,
                    Mount = d.mount,
                    TotalBytes = d.totalBytes,
                    FreeBytes = d.freeBytes
                }).ToList(),
                Devices = devices.Select(d => new TelemetryPayload.InputDevicePayload { Name = d.Name, Type = d.Type, Id = d.Id }).ToList()
            };

            var res = await _api.SendTelemetryAsync(_config.ServerUrl, payload, _sendCts.Token);

            var missingParts = new List<string>();
            if (payload.GpuData.Count == 0) missingParts.Add("gpu");
            if (payload.Memory.TotalBytes == 0) missingParts.Add("ram");
            if (payload.Disks.Count == 0) missingParts.Add("disks");

            if (missingParts.Count > 0 || _vm.IsDebugOpen)
            {
                var summary = new
                {
                    workstation_id = payload.WorkstationId,
                    hostname = payload.Hostname,
                    cpu = payload.Cpu,
                    memory = payload.Memory,
                    gpu_count = payload.GpuData.Count,
                    disks_count = payload.Disks.Count,
                    devices_count = payload.Devices.Count,
                    missing = missingParts.ToArray(),
                    request = res.RequestBody
                };
                _vm.AddLog("debug", "Телеметрия: payload", Trunc(JsonSerializer.Serialize(summary, new JsonSerializerOptions { WriteIndented = true })));
            }

            if (!res.Ok)
            {
                _vm.AddLog("error", "Телеметрия: ошибка", $"{res.Url}\n{res.Error}\n{Trunc(res.Body)}\n\nREQUEST:\n{Trunc(res.RequestBody)}");
            }
            else
            {
                _vm.AddLog("info", "Телеметрия: отправлено", $"{res.Url} ({res.StatusCode})");
            }
        }
        catch
        {
            _vm.AddLog("error", "Телеметрия: исключение", "Неожиданная ошибка");
        }
    }

    private async void Bind_Click(object sender, RoutedEventArgs e)
    {
        var code = (_vm.BindingCode ?? "").Trim().ToUpperInvariant();
        if (string.IsNullOrWhiteSpace(code)) return;

        _vm.SetStatus("Регистрация...", _vm.Accent);
        _vm.AddLog("info", "Регистрация", $"code={code}\nserver={_config.ServerUrl}");

        _sendCts?.Cancel();
        _sendCts = new CancellationTokenSource(TimeSpan.FromSeconds(15));

        try
        {
            var regRes = await _api.RegisterAsync(_config.ServerUrl, code, _config.Hostname, _sendCts.Token);
            if (!regRes.Ok || regRes.Data == null)
            {
                _vm.SetStatus("Нет связи с сервером", _vm.Danger);
                _vm.AddLog("error", "Регистрация: ошибка", $"{regRes.Url}\n{regRes.Error}\n{Trunc(regRes.Body)}");
                return;
            }

            var reg = regRes.Data;
            if (string.IsNullOrWhiteSpace(reg.WorkstationId))
            {
                _vm.SetStatus("Неверный код", _vm.Danger);
                _vm.AddLog("error", "Неверный код", Trunc(regRes.Body));
                return;
            }

            _config.BindingCode = code;
            _config.WorkstationId = reg.WorkstationId;
            _config.ClubId = reg.ClubId;
            _config.Name = reg.Name;
            _configService.Save(_config);
            _vm.SetStatus("Подключен", _vm.Ok);
            _vm.AddLog("info", "Успешно", $"workstation_id={reg.WorkstationId}");

            await SendTelemetryIfBound();
        }
        catch
        {
            _vm.SetStatus("Нет связи с сервером", _vm.Danger);
            _vm.AddLog("error", "Регистрация: исключение", "Неожиданная ошибка");
        }
    }

    private void Unbind_Click(object sender, RoutedEventArgs e)
    {
        _config.BindingCode = "";
        _config.WorkstationId = "";
        _config.ClubId = "";
        _config.Name = "";
        _configService.Save(_config);
        _vm.BindingCode = "";
        _vm.SetStatus("Не подключен", _vm.Danger);
        _vm.AddLog("info", "Отвязано", "");
    }

    private void OpenDashboard_Click(object sender, RoutedEventArgs e)
    {
        var url = _config.ServerUrl.TrimEnd('/') + "/";
        Process.Start(new ProcessStartInfo(url) { UseShellExecute = true });
    }

    private void ToggleDebug_Click(object sender, RoutedEventArgs e)
    {
        _vm.IsDebugOpen = !_vm.IsDebugOpen;
    }

    private void ToTray_Click(object sender, RoutedEventArgs e)
    {
        Hide();
        _tray.ShowBalloon("DashAdmin Агент", "Работает в трее.");
    }

    private void Minimize_Click(object sender, RoutedEventArgs e)
    {
        WindowState = WindowState.Minimized;
    }

    private void Close_Click(object sender, RoutedEventArgs e)
    {
        Hide();
        _tray.ShowBalloon("DashAdmin Агент", "Работает в трее.");
    }

    private void ShowFromTray()
    {
        Dispatcher.Invoke(() =>
        {
            Show();
            WindowState = WindowState.Normal;
            Activate();
        });
    }

    private void ExitFromTray()
    {
        Dispatcher.Invoke(Close);
    }

    private static string Trunc(string s)
    {
        if (string.IsNullOrWhiteSpace(s)) return "";
        s = s.Trim();
        return s.Length > 800 ? s[..800] + "…" : s;
    }

    private static double ToGiB(ulong bytes) => bytes / 1024.0 / 1024.0 / 1024.0;
}

public sealed class MainWindowViewModel : INotifyPropertyChanged
{
    private string _bindingCode;
    private string _statusText = "";
    private Brush _statusBrush;
    private Brush _statusBg;
    private Brush _statusBorder;
    private Brush _statusDot;
    private Brush _statusTextColor;
    private string _cpuNameText = "Unknown CPU";
    private double _cpuLoad;
    private string _cpuTempText = "N/A";
    private string _cpuLoadText = "0 %";
    private string _gpuNameText = "No GPU detected";
    private double _gpuLoad;
    private string _gpuTempText = "N/A";
    private string _gpuLoadText = "0 %";
    private string _memoryText = "N/A";
    private string _hintText = "";
    private readonly ObservableCollection<DeviceRow> _devices = new();
    private readonly ObservableCollection<DiskRow> _disks = new();
    private readonly ObservableCollection<LogRow> _logs = new();
    private LogRow? _selectedLog;
    private bool _isDebugOpen;

    public Brush Accent { get; } = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#007AFF"));
    public Brush AccentLight { get; } = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#E5F1FF"));
    public Brush Danger { get; } = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FF3B30"));
    public Brush Ok { get; } = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#34C759"));
    public Brush Warning { get; } = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FF9500"));
    public Brush ControlBgActive { get; } = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#E8E8EA"));
    public Brush PanelStroke { get; } = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#E5E5E7"));

    public MainWindowViewModel(AgentConfig config)
    {
        _bindingCode = config.BindingCode;
        _statusBrush = Danger;
        _statusBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFF5F5"));
        _statusBorder = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FF3B30"));
        _statusDot = Danger;
        _statusTextColor = Danger;
    }

    public string BindingCode
    {
        get => _bindingCode;
        set { _bindingCode = value; OnPropertyChanged(); }
    }

    public string StatusText
    {
        get => _statusText;
        set { _statusText = value; OnPropertyChanged(); }
    }

    public Brush StatusBrush
    {
        get => _statusBrush;
        set { _statusBrush = value; OnPropertyChanged(); }
    }

    public Brush StatusBg
    {
        get => _statusBg;
        set { _statusBg = value; OnPropertyChanged(); }
    }

    public Brush StatusBorder
    {
        get => _statusBorder;
        set { _statusBorder = value; OnPropertyChanged(); }
    }

    public Brush StatusDot
    {
        get => _statusDot;
        set { _statusDot = value; OnPropertyChanged(); }
    }

    public Brush StatusTextColor
    {
        get => _statusTextColor;
        set { _statusTextColor = value; OnPropertyChanged(); }
    }

    public double CpuLoad
    {
        get => _cpuLoad;
        set { _cpuLoad = value; OnPropertyChanged(); }
    }

    public string CpuNameText
    {
        get => _cpuNameText;
        set { _cpuNameText = value; OnPropertyChanged(); }
    }

    public string CpuTempText
    {
        get => _cpuTempText;
        set { _cpuTempText = value; OnPropertyChanged(); }
    }

    public string CpuLoadText
    {
        get => _cpuLoadText;
        set { _cpuLoadText = value; OnPropertyChanged(); }
    }

    public string GpuNameText
    {
        get => _gpuNameText;
        set { _gpuNameText = value; OnPropertyChanged(); }
    }

    public double GpuLoad
    {
        get => _gpuLoad;
        set { _gpuLoad = value; OnPropertyChanged(); }
    }

    public string GpuTempText
    {
        get => _gpuTempText;
        set { _gpuTempText = value; OnPropertyChanged(); }
    }

    public string GpuLoadText
    {
        get => _gpuLoadText;
        set { _gpuLoadText = value; OnPropertyChanged(); }
    }

    public string MemoryText
    {
        get => _memoryText;
        set { _memoryText = value; OnPropertyChanged(); }
    }

    public ObservableCollection<DeviceRow> Devices => _devices;
    public ObservableCollection<DiskRow> Disks => _disks;

    public ObservableCollection<LogRow> Logs => _logs;

    public LogRow? SelectedLog
    {
        get => _selectedLog;
        set { _selectedLog = value; OnPropertyChanged(); }
    }

    public bool IsDebugOpen
    {
        get => _isDebugOpen;
        set { _isDebugOpen = value; OnPropertyChanged(); }
    }

    public string HintText
    {
        get => _hintText;
        set { _hintText = value; OnPropertyChanged(); }
    }

    public void SetStatus(string text, Brush brush)
    {
        StatusText = text;
        StatusBrush = brush;
        
        if (brush == Ok)
        {
            StatusBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#E8F5E9"));
            StatusBorder = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#34C759"));
            StatusDot = Ok;
            StatusTextColor = Ok;
        }
        else if (brush == Danger)
        {
            StatusBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFF5F5"));
            StatusBorder = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FF3B30"));
            StatusDot = Danger;
            StatusTextColor = Danger;
        }
        else if (brush == Warning)
        {
            StatusBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FFF9E6"));
            StatusBorder = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#FF9500"));
            StatusDot = Warning;
            StatusTextColor = Warning;
        }
        else
        {
            StatusBg = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#E5F1FF"));
            StatusBorder = new SolidColorBrush((Color)ColorConverter.ConvertFromString("#007AFF"));
            StatusDot = Accent;
            StatusTextColor = Accent;
        }
    }

    public void AddLog(string level, string message, string detail)
    {
        Application.Current?.Dispatcher.Invoke(() =>
        {
            _logs.Insert(0, new LogRow { Time = DateTime.Now.ToString("HH:mm:ss"), Level = level.ToUpperInvariant(), Message = message, Detail = detail });
            if (_logs.Count > 200) _logs.RemoveAt(_logs.Count - 1);
        });
    }

    public event PropertyChangedEventHandler? PropertyChanged;
    private void OnPropertyChanged([CallerMemberName] string? name = null) => PropertyChanged?.Invoke(this, new PropertyChangedEventArgs(name));
}

public sealed class DeviceRow
{
    public string Type { get; set; } = "";
    public string Name { get; set; } = "";
    public string Id { get; set; } = "";
    public string FullId { get; set; } = "";
}

public sealed class DiskRow
{
    public string Name { get; set; } = "";
    public string Mount { get; set; } = "";
    public string UsedText { get; set; } = "";
}

public sealed class LogRow
{
    public string Time { get; set; } = "";
    public string Level { get; set; } = "";
    public string Message { get; set; } = "";
    public string Detail { get; set; } = "";
}
