namespace DashAdminAgent.Models;

using System.Collections.Generic;

public sealed class TelemetryPayload
{
    public string WorkstationId { get; set; } = "";
    public string Hostname { get; set; } = "";
    public CpuPayload Cpu { get; set; } = new();
    public MemoryPayload Memory { get; set; } = new();
    public List<GpuPayload> GpuData { get; set; } = new();
    public List<DiskPayload> Disks { get; set; } = new();
    public List<InputDevicePayload> Devices { get; set; } = new();

    public sealed class CpuPayload
    {
        public float Temp { get; set; }
        public float Usage { get; set; }
        public string ModelName { get; set; } = "";
    }

    public sealed class GpuPayload
    {
        public string Name { get; set; } = "";
        public float Temp { get; set; }
        public float Usage { get; set; }
        public ulong MemoryUsed { get; set; }
        public ulong MemoryTotal { get; set; }
    }

    public sealed class MemoryPayload
    {
        public ulong TotalBytes { get; set; }
        public ulong UsedBytes { get; set; }
    }

    public sealed class DiskPayload
    {
        public string Name { get; set; } = "";
        public string Mount { get; set; } = "";
        public ulong TotalBytes { get; set; }
        public ulong FreeBytes { get; set; }
    }

    public sealed class InputDevicePayload
    {
        public string Name { get; set; } = "";
        public string Type { get; set; } = "";
        public string Id { get; set; } = "";
    }
}
