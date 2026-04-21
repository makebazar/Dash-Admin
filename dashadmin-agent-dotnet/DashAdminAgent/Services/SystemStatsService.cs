using System;
using System.Collections.Generic;
using System.IO;
using Microsoft.VisualBasic.Devices;

namespace DashAdminAgent.Services;

public sealed class SystemStatsService
{
    private readonly ComputerInfo _computerInfo = new();

    public (ulong totalBytes, ulong usedBytes) GetMemory()
    {
        try
        {
            var total = _computerInfo.TotalPhysicalMemory;
            var available = _computerInfo.AvailablePhysicalMemory;
            var used = total > available ? total - available : 0;
            return (total, used);
        }
        catch
        {
            return (0, 0);
        }
    }

    public List<(string name, string mount, ulong totalBytes, ulong freeBytes)> GetDisks()
    {
        var list = new List<(string name, string mount, ulong totalBytes, ulong freeBytes)>();
        try
        {
            foreach (var di in DriveInfo.GetDrives())
            {
                if (!di.IsReady) continue;
                if (di.DriveType != DriveType.Fixed) continue;

                list.Add((
                    name: string.IsNullOrWhiteSpace(di.VolumeLabel) ? di.Name : di.VolumeLabel,
                    mount: di.RootDirectory.FullName,
                    totalBytes: (ulong)di.TotalSize,
                    freeBytes: (ulong)di.AvailableFreeSpace
                ));
            }
        }
        catch
        {
            return new List<(string name, string mount, ulong totalBytes, ulong freeBytes)>();
        }

        return list;
    }
}

