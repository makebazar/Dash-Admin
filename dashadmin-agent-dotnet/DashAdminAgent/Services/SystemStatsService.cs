using System;
using System.Collections.Generic;
using System.IO;
using System.Runtime.InteropServices;

namespace DashAdminAgent.Services;

public sealed class SystemStatsService
{
    [StructLayout(LayoutKind.Sequential, CharSet = CharSet.Auto)]
    private class MEMORYSTATUSEX
    {
        public uint dwLength;
        public uint dwMemoryLoad;
        public ulong ullTotalPhys;
        public ulong ullAvailPhys;
        public ulong ullTotalPageFile;
        public ulong ullAvailPageFile;
        public ulong ullTotalVirtual;
        public ulong ullAvailVirtual;
        public ulong ullAvailExtendedVirtual;
        public MEMORYSTATUSEX()
        {
            dwLength = (uint)Marshal.SizeOf(typeof(MEMORYSTATUSEX));
        }
    }

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    [return: MarshalAs(UnmanagedType.Bool)]
    private static extern bool GlobalMemoryStatusEx([In, Out] MEMORYSTATUSEX lpBuffer);

    public (ulong totalBytes, ulong usedBytes) GetMemory()
    {
        try
        {
            var msex = new MEMORYSTATUSEX();
            if (GlobalMemoryStatusEx(msex))
            {
                var total = msex.ullTotalPhys;
                var available = msex.ullAvailPhys;
                var used = total > available ? total - available : 0;
                return (total, used);
            }
            return (0, 0);
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

