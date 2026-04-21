using System;
using System.Collections.Generic;
using Microsoft.Win32;

namespace DashAdminAgent.Services;

public static class DeviceEnumerator
{
    public sealed class InputDeviceInfo
    {
        public string Name { get; init; } = "";
        public string Type { get; init; } = "";
        public string Id { get; init; } = "";
        public string RawId { get; init; } = "";
    }

    public static List<InputDeviceInfo> GetInputDevices()
    {
        var list = new List<InputDeviceInfo>();
        var seen = new HashSet<string>(StringComparer.OrdinalIgnoreCase);

        var hidInfos = HidDeviceEnumerator.Enumerate();
        foreach (var hid in hidInfos)
        {
            if (hid.Kind != "keyboard" && hid.Kind != "mouse") continue;
            var rawId = hid.InstanceId;
            var tracking = GetTrackingId(rawId, hid.Serial);
            var dedupeKey = hid.Kind + ":" + tracking;
            if (!seen.Add(dedupeKey)) continue;

            var name = hid.Product;
            if (string.IsNullOrWhiteSpace(name)) name = TryGetRegistryDeviceName(rawId);
            if (string.IsNullOrWhiteSpace(name)) name = rawId;

            list.Add(new InputDeviceInfo
            {
                Name = name,
                Type = hid.Kind,
                Id = tracking,
                RawId = rawId
            });
        }

        return list;
    }

    private static string GetTrackingId(string pnpDeviceId, string serial)
    {
        if (string.IsNullOrWhiteSpace(pnpDeviceId)) return "";

        if (LooksLikeSerial(serial)) return serial.Trim();

        var instance = "";
        try
        {
            var idx = pnpDeviceId.LastIndexOf('\\');
            if (idx >= 0 && idx + 1 < pnpDeviceId.Length) instance = pnpDeviceId[(idx + 1)..].Trim();
        }
        catch { }

        if (LooksLikeSerial(instance)) return instance;

        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Enum\" + pnpDeviceId);
            if (key != null)
            {
                var containerId = (key.GetValue("ContainerID") as string ?? "").Trim();
                if (!string.IsNullOrWhiteSpace(containerId))
                {
                    return containerId;
                }
            }
        }
        catch
        {
        }

        return pnpDeviceId;
    }

    private static bool LooksLikeSerial(string instance)
    {
        if (string.IsNullOrWhiteSpace(instance)) return false;
        var s = instance.Trim();
        if (s.StartsWith("7&", StringComparison.OrdinalIgnoreCase)) return false;
        if (s.Contains('&')) return false;
        if (s.Length < 4) return false;
        return true;
    }

    private static string TryGetRegistryDeviceName(string pnpDeviceId)
    {
        if (string.IsNullOrWhiteSpace(pnpDeviceId)) return "";

        try
        {
            using var key = Registry.LocalMachine.OpenSubKey(@"SYSTEM\CurrentControlSet\Enum\" + pnpDeviceId);
            if (key == null) return "";

            var friendly = (key.GetValue("FriendlyName") as string ?? "").Trim();
            if (!string.IsNullOrWhiteSpace(friendly)) return friendly;

            var deviceDesc = (key.GetValue("DeviceDesc") as string ?? "").Trim();
            if (string.IsNullOrWhiteSpace(deviceDesc)) return "";

            var semi = deviceDesc.LastIndexOf(';');
            if (semi >= 0 && semi + 1 < deviceDesc.Length)
            {
                var tail = deviceDesc[(semi + 1)..].Trim();
                if (!string.IsNullOrWhiteSpace(tail) && !tail.StartsWith("@")) return tail;
            }

            if (!deviceDesc.StartsWith("@")) return deviceDesc;
            return "";
        }
        catch
        {
            return "";
        }
    }
}
