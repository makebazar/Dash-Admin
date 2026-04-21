using System;
using System.Collections.Generic;
using LibreHardwareMonitor.Hardware;

namespace DashAdminAgent.Services;

public sealed class HardwareMonitorService : IDisposable
{
    private readonly Computer _computer;
    private readonly UpdateVisitor _visitor = new();

    public HardwareMonitorService()
    {
        _computer = new Computer
        {
            IsCpuEnabled = true,
            IsGpuEnabled = true,
            IsMotherboardEnabled = true,
            IsControllerEnabled = true
        };
        _computer.Open();
    }

    public (float cpuTemp, float cpuLoad, string cpuName, List<(string name, float temp, float load, ulong memUsed, ulong memTotal)> gpus) Read()
    {
        _computer.IsCpuEnabled = true;
        _computer.IsGpuEnabled = true;
        _computer.IsMotherboardEnabled = true;
        _computer.IsControllerEnabled = true;
        _computer.Accept(_visitor);

        float cpuTemp = 0;
        float cpuLoad = 0;
        string cpuName = "";

        var gpus = new List<(string name, float temp, float load, ulong memUsed, ulong memTotal)>();

        foreach (var hw in _computer.Hardware)
        {
            if (hw.HardwareType == HardwareType.Cpu)
            {
                cpuName = hw.Name;
                cpuTemp = Math.Max(cpuTemp, PickMaxTempRecursive(hw));
                cpuLoad = Math.Max(cpuLoad, PickLoadRecursive(hw));
            }

            if (hw.HardwareType == HardwareType.GpuNvidia || hw.HardwareType == HardwareType.GpuAmd || hw.HardwareType == HardwareType.GpuIntel)
            {
                var temp = PickMaxTempRecursive(hw);
                var load = PickLoadRecursive(hw);
                var memUsed = PickMemoryRecursive(hw, SensorType.SmallData);
                var memTotal = PickMemoryRecursive(hw, SensorType.Data);
                gpus.Add((hw.Name, temp, load, memUsed, memTotal));
            }
        }

        if (cpuTemp <= 0.1f)
        {
            foreach (var hw in _computer.Hardware)
            {
                if (hw.HardwareType != HardwareType.Motherboard) continue;
                cpuTemp = Math.Max(cpuTemp, PickMaxTempRecursive(hw));
            }
        }

        return (cpuTemp, cpuLoad, cpuName, gpus);
    }

    private static void Traverse(IHardware hw, Action<IHardware> action)
    {
        action(hw);
        foreach (var sub in hw.SubHardware)
        {
            Traverse(sub, action);
        }
    }

    private static float PickMaxTempRecursive(IHardware hw)
    {
        float preferredMax = 0;
        float otherMax = 0;

        Traverse(hw, part =>
        {
            foreach (var s in part.Sensors)
            {
                if (s.SensorType != SensorType.Temperature) continue;
                if (!s.Value.HasValue) continue;

                var name = s.Name ?? "";
                if (name.Contains("TjMax", StringComparison.OrdinalIgnoreCase)) continue;

                var value = s.Value.Value;

                if (name.Contains("Package", StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("Core Max", StringComparison.OrdinalIgnoreCase) ||
                    name.Contains("CPU", StringComparison.OrdinalIgnoreCase))
                {
                    preferredMax = Math.Max(preferredMax, value);
                }
                else
                {
                    otherMax = Math.Max(otherMax, value);
                }
            }
        });

        return preferredMax > 0 ? preferredMax : otherMax;
    }

    private static float PickLoadRecursive(IHardware hw)
    {
        float? best = null;
        Traverse(hw, part =>
        {
            foreach (var s in part.Sensors)
            {
                if (s.SensorType != SensorType.Load) continue;
                if (!s.Value.HasValue) continue;

                if (s.Name.Contains("Total", StringComparison.OrdinalIgnoreCase) ||
                    s.Name.Contains("CPU Total", StringComparison.OrdinalIgnoreCase) ||
                    s.Name.Contains("GPU Core", StringComparison.OrdinalIgnoreCase))
                {
                    best = s.Value.Value;
                    return;
                }

                best ??= s.Value.Value;
            }
        });
        return best ?? 0;
    }

    private static ulong PickMemoryRecursive(IHardware hw, SensorType sensorType)
    {
        ulong value = 0;
        Traverse(hw, part =>
        {
            foreach (var s in part.Sensors)
            {
                if (s.SensorType != sensorType) continue;
                if (!s.Value.HasValue) continue;
                if (s.Name.Contains("Memory", StringComparison.OrdinalIgnoreCase))
                {
                    var mb = s.Value.Value;
                    if (mb <= 0) return;
                    value = (ulong)(mb * 1024 * 1024);
                    return;
                }
            }
        });
        return value;
    }

    public void Dispose()
    {
        _computer.Close();
    }

    private sealed class UpdateVisitor : IVisitor
    {
        public void VisitComputer(IComputer computer) => computer.Traverse(this);
        public void VisitHardware(IHardware hardware)
        {
            hardware.Update();
            foreach (var subHardware in hardware.SubHardware) subHardware.Accept(this);
        }
        public void VisitSensor(ISensor sensor) { }
        public void VisitParameter(IParameter parameter) { }
    }
}
