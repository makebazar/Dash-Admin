using System;
using System.Collections.Generic;
using System.Linq;
using System.Runtime.InteropServices;
using System.Text;
using Microsoft.Win32.SafeHandles;

namespace DashAdminAgent.Services;

public static class HidDeviceEnumerator
{
    public sealed class HidInfo
    {
        public string InstanceId { get; init; } = "";
        public string DevicePath { get; init; } = "";
        public string Serial { get; init; } = "";
        public string Product { get; init; } = "";
        public string Kind { get; init; } = "hid";
    }

    public static List<HidInfo> Enumerate()
    {
        var list = new List<HidInfo>();
        var guid = Guid.Parse("4D1E55B2-F16F-11CF-88CB-001111000030");
        var hDevInfo = SetupDiGetClassDevs(ref guid, null, IntPtr.Zero, DIGCF_PRESENT | DIGCF_DEVICEINTERFACE);
        if (hDevInfo == IntPtr.Zero || hDevInfo == new IntPtr(-1)) return list;

        try
        {
            uint index = 0;
            while (true)
            {
                var ifData = new SP_DEVICE_INTERFACE_DATA();
                ifData.cbSize = Marshal.SizeOf<SP_DEVICE_INTERFACE_DATA>();

                if (!SetupDiEnumDeviceInterfaces(hDevInfo, IntPtr.Zero, ref guid, index, ref ifData))
                {
                    break;
                }

                var devInfo = new SP_DEVINFO_DATA();
                devInfo.cbSize = Marshal.SizeOf<SP_DEVINFO_DATA>();

                uint requiredSize = 0;
                SetupDiGetDeviceInterfaceDetail(hDevInfo, ref ifData, IntPtr.Zero, 0, ref requiredSize, ref devInfo);
                if (requiredSize == 0)
                {
                    index++;
                    continue;
                }

                var detailBuffer = Marshal.AllocHGlobal((int)requiredSize);
                try
                {
                    var cbSize = IntPtr.Size == 8 ? 8 : 6;
                    Marshal.WriteInt32(detailBuffer, cbSize);

                    if (!SetupDiGetDeviceInterfaceDetail(hDevInfo, ref ifData, detailBuffer, requiredSize, ref requiredSize, ref devInfo))
                    {
                        index++;
                        continue;
                    }

                    var devicePath = Marshal.PtrToStringAuto(detailBuffer + 4) ?? "";
                    var instanceId = GetInstanceId(hDevInfo, ref devInfo);
                    if (string.IsNullOrWhiteSpace(devicePath) || string.IsNullOrWhiteSpace(instanceId))
                    {
                        index++;
                        continue;
                    }

                    using var handle = CreateFile(devicePath, 0, FILE_SHARE_READ | FILE_SHARE_WRITE, IntPtr.Zero, OPEN_EXISTING, 0, IntPtr.Zero);
                    var serial = "";
                    var product = "";
                    var kind = "hid";

                    if (!handle.IsInvalid)
                    {
                        serial = ReadHidString(handle, HidD_GetSerialNumberString);
                        product = ReadHidString(handle, HidD_GetProductString);
                        kind = ReadKind(handle);
                    }

                    list.Add(new HidInfo
                    {
                        InstanceId = instanceId,
                        DevicePath = devicePath,
                        Serial = serial,
                        Product = product,
                        Kind = kind
                    });
                }
                finally
                {
                    Marshal.FreeHGlobal(detailBuffer);
                }

                index++;
            }
        }
        finally
        {
            SetupDiDestroyDeviceInfoList(hDevInfo);
        }

        return list;
    }

    private static string GetInstanceId(IntPtr hDevInfo, ref SP_DEVINFO_DATA devInfo)
    {
        var sb = new StringBuilder(512);
        if (!SetupDiGetDeviceInstanceId(hDevInfo, ref devInfo, sb, (uint)sb.Capacity, out _)) return "";
        return sb.ToString();
    }

    private static string ReadHidString(SafeFileHandle handle, HidStringReader reader)
    {
        var buf = new byte[512];
        if (!reader(handle, buf, buf.Length)) return "";
        var s = Encoding.Unicode.GetString(buf).TrimEnd('\0').Trim();
        return s;
    }

    private static string ReadKind(SafeFileHandle handle)
    {
        if (!HidD_GetPreparsedData(handle, out var preparsed)) return "hid";
        try
        {
            var caps = new HIDP_CAPS();
            var status = HidP_GetCaps(preparsed, ref caps);
            if (status != HIDP_STATUS_SUCCESS) return "hid";
            if (caps.UsagePage != 0x01) return "hid";
            if (caps.Usage == 0x06 || caps.Usage == 0x07) return "keyboard";
            if (caps.Usage == 0x02 || caps.Usage == 0x01) return "mouse";
            return "hid";
        }
        finally
        {
            HidD_FreePreparsedData(preparsed);
        }
    }

    private delegate bool HidStringReader(SafeFileHandle handle, byte[] buffer, int bufferLength);

    private const int DIGCF_PRESENT = 0x00000002;
    private const int DIGCF_DEVICEINTERFACE = 0x00000010;
    private const int FILE_SHARE_READ = 0x00000001;
    private const int FILE_SHARE_WRITE = 0x00000002;
    private const int OPEN_EXISTING = 3;

    private const int HIDP_STATUS_SUCCESS = 0x00110000;

    [StructLayout(LayoutKind.Sequential)]
    private struct SP_DEVICE_INTERFACE_DATA
    {
        public int cbSize;
        public Guid InterfaceClassGuid;
        public int Flags;
        public IntPtr Reserved;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct SP_DEVINFO_DATA
    {
        public int cbSize;
        public Guid ClassGuid;
        public uint DevInst;
        public IntPtr Reserved;
    }

    [StructLayout(LayoutKind.Sequential)]
    private struct HIDP_CAPS
    {
        public short Usage;
        public short UsagePage;
        public short InputReportByteLength;
        public short OutputReportByteLength;
        public short FeatureReportByteLength;
        [MarshalAs(UnmanagedType.ByValArray, SizeConst = 17)]
        public short[] Reserved;
        public short NumberLinkCollectionNodes;
        public short NumberInputButtonCaps;
        public short NumberInputValueCaps;
        public short NumberInputDataIndices;
        public short NumberOutputButtonCaps;
        public short NumberOutputValueCaps;
        public short NumberOutputDataIndices;
        public short NumberFeatureButtonCaps;
        public short NumberFeatureValueCaps;
        public short NumberFeatureDataIndices;
    }

    [DllImport("setupapi.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern IntPtr SetupDiGetClassDevs(ref Guid ClassGuid, string? Enumerator, IntPtr hwndParent, int Flags);

    [DllImport("setupapi.dll", SetLastError = true)]
    private static extern bool SetupDiEnumDeviceInterfaces(IntPtr DeviceInfoSet, IntPtr DeviceInfoData, ref Guid InterfaceClassGuid, uint MemberIndex, ref SP_DEVICE_INTERFACE_DATA DeviceInterfaceData);

    [DllImport("setupapi.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool SetupDiGetDeviceInterfaceDetail(IntPtr DeviceInfoSet, ref SP_DEVICE_INTERFACE_DATA DeviceInterfaceData, IntPtr DeviceInterfaceDetailData, uint DeviceInterfaceDetailDataSize, ref uint RequiredSize, ref SP_DEVINFO_DATA DeviceInfoData);

    [DllImport("setupapi.dll", SetLastError = true)]
    private static extern bool SetupDiDestroyDeviceInfoList(IntPtr DeviceInfoSet);

    [DllImport("setupapi.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern bool SetupDiGetDeviceInstanceId(IntPtr DeviceInfoSet, ref SP_DEVINFO_DATA DeviceInfoData, StringBuilder DeviceInstanceId, uint DeviceInstanceIdSize, out uint RequiredSize);

    [DllImport("kernel32.dll", CharSet = CharSet.Auto, SetLastError = true)]
    private static extern SafeFileHandle CreateFile(string lpFileName, int dwDesiredAccess, int dwShareMode, IntPtr lpSecurityAttributes, int dwCreationDisposition, int dwFlagsAndAttributes, IntPtr hTemplateFile);

    [DllImport("hid.dll", SetLastError = true)]
    private static extern bool HidD_GetSerialNumberString(SafeFileHandle HidDeviceObject, byte[] Buffer, int BufferLength);

    [DllImport("hid.dll", SetLastError = true)]
    private static extern bool HidD_GetProductString(SafeFileHandle HidDeviceObject, byte[] Buffer, int BufferLength);

    [DllImport("hid.dll", SetLastError = true)]
    private static extern bool HidD_GetPreparsedData(SafeFileHandle HidDeviceObject, out IntPtr PreparsedData);

    [DllImport("hid.dll", SetLastError = true)]
    private static extern bool HidD_FreePreparsedData(IntPtr PreparsedData);

    [DllImport("hid.dll", SetLastError = true)]
    private static extern int HidP_GetCaps(IntPtr PreparsedData, ref HIDP_CAPS Capabilities);
}

