using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Net.Http;
using System.Text.Json;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using Microsoft.Win32;

namespace DashAdminAgent.Services;

public sealed class GameStatus
{
    public string Name { get; set; } = "";
    public string Launcher { get; set; } = "";
    public string InstallDir { get; set; } = ""; 
    public int AppId { get; set; }
    public string BuildId { get; set; } = "";
    public bool UpdateRequired { get; set; }
    public string LibraryPath { get; set; } = "";
}

public sealed class GameMonitorService
{
    private static readonly Regex KeyValueRegex = new(
        @"\""(appid|name|installdir|StateFlags|buildid)\""\s+\""([^\""]+)\""",
        RegexOptions.Compiled | RegexOptions.IgnoreCase
    );

    private static readonly Regex PathRegex = new(
        @"\""path\""\s+\""([^\""]+)\""",
        RegexOptions.Compiled | RegexOptions.IgnoreCase
    );

    private readonly HttpClient _http = new() { Timeout = TimeSpan.FromSeconds(5) };
    private readonly Dictionary<int, (string buildId, DateTime expiry)> _buildCache = new();

    public string? GetCachedBuildId(int appId)
    {
        if (_buildCache.TryGetValue(appId, out var cached) && cached.expiry > DateTime.Now)
            return cached.buildId;
        return null;
    }

    public async Task<string> GetLatestBuildIdAsync(int appId)
    {
        if (_buildCache.TryGetValue(appId, out var cached) && cached.expiry > DateTime.Now)
            return cached.buildId;

        try
        {
            var resp = await _http.GetStringAsync($"https://api.steamcmd.net/v1/info/{appId}");
            using var doc = JsonDocument.Parse(resp);
            if (doc.RootElement.TryGetProperty("data", out var data) &&
                data.TryGetProperty(appId.ToString(), out var app) &&
                app.TryGetProperty("depots", out var branches) &&
                branches.TryGetProperty("branches", out var b) &&
                b.TryGetProperty("public", out var pub))
            {
                var buildId = pub.GetProperty("buildid").GetString() ?? "";
                if (!string.IsNullOrEmpty(buildId))
                {
                    _buildCache[appId] = (buildId, DateTime.Now.AddHours(12));
                    return buildId;
                }
            }
        }
        catch { }
        return "";
    }

    public List<GameStatus> ScanSteamGames(string? extraLibraryPath = null, Action<string>? debugLog = null)
    {
        var games = new List<GameStatus>();
        var libraryPaths = GetSteamLibraryPaths();
        
        if (!string.IsNullOrEmpty(extraLibraryPath))
        {
            try {
                if (Directory.Exists(extraLibraryPath) && !libraryPaths.Any(p => string.Equals(p, extraLibraryPath, StringComparison.OrdinalIgnoreCase)))
                    libraryPaths.Add(extraLibraryPath);
            } catch { }
        }

        debugLog?.Invoke($"[Scan] Checking {libraryPaths.Count} library paths...");

        foreach (var libraryPath in libraryPaths)
        {
            try
            {
                var steamappsPath = Path.Combine(libraryPath, "steamapps");
                if (!Directory.Exists(steamappsPath)) {
                    debugLog?.Invoke($"[Scan] No 'steamapps' in: {libraryPath}");
                    continue;
                }

                var acfFiles = Directory.GetFiles(steamappsPath, "appmanifest_*.acf");
                debugLog?.Invoke($"[Scan] Found {acfFiles.Length} .acf files in {steamappsPath}");

                foreach (var file in acfFiles)
                {
                    try {
                        var status = ParseAcfFile(file, libraryPath);
                        if (status != null)
                        {
                            var existing = games.Find(g => g.AppId == status.AppId);
                            if (existing == null) games.Add(status);
                        }
                    } catch { }
                }
            }
            catch (Exception ex) { debugLog?.Invoke($"[Scan] Error in {libraryPath}: {ex.Message}"); }
        }

        return games;
    }

    private List<string> GetSteamLibraryPaths()
    {
        var paths = new List<string>();
        
        // 1. Check Registry
        string? steamPath = null;
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
            if (key != null) steamPath = key.GetValue("SteamPath") as string;
        }
        catch { }

        // 2. Default Path
        if (string.IsNullOrEmpty(steamPath))
        {
            steamPath = Path.Combine(Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86), "Steam");
        }

        try {
            if (!string.IsNullOrEmpty(steamPath))
            {
                steamPath = Path.GetFullPath(steamPath.Replace('/', '\\'));
                if (Directory.Exists(steamPath))
                {
                    if (!paths.Contains(steamPath)) paths.Add(steamPath);

                    // 3. Check libraryfolders.vdf
                    var libraryFoldersFile = Path.Combine(steamPath, "steamapps", "libraryfolders.vdf");
                    if (File.Exists(libraryFoldersFile))
                    {
                        var content = File.ReadAllText(libraryFoldersFile);
                        var matches = PathRegex.Matches(content);
                        foreach (Match match in matches)
                        {
                            if (match.Groups.Count > 1)
                            {
                                var rawPath = match.Groups[1].Value;
                                var cleanPath = Path.GetFullPath(rawPath.Replace(@"\\", @"\").Replace('/', '\\'));
                                if (Directory.Exists(cleanPath) && !paths.Any(p => string.Equals(p, cleanPath, StringComparison.OrdinalIgnoreCase))) 
                                    paths.Add(cleanPath);
                            }
                        }
                    }
                }
            }
        } catch { }

        // 4. Common install locations fallback if none found
        if (paths.Count == 0)
        {
            foreach (var drive in DriveInfo.GetDrives().Where(d => d.IsReady))
            {
                var p = Path.Combine(drive.Name, "SteamLibrary");
                if (Directory.Exists(p)) paths.Add(p);
            }
        }

        return paths;
    }

    private GameStatus? ParseAcfFile(string filePath, string libraryPath)
    {
        var content = File.ReadAllText(filePath);
        var matches = KeyValueRegex.Matches(content);

        string name = "";
        string installDir = "";
        int appId = 0;
        string buildId = "";
        int stateFlags = 0;

        foreach (Match match in matches)
        {
            if (match.Groups.Count > 2)
            {
                var key = match.Groups[1].Value.ToLowerInvariant();
                var val = match.Groups[2].Value;
                switch (key)
                {
                    case "name": name = val; break;
                    case "installdir": installDir = val; break;
                    case "appid": int.TryParse(val, out appId); break;
                    case "buildid": buildId = val; break;
                    case "stateflags": int.TryParse(val, out stateFlags); break;
                }
            }
        }
        if (appId == 0 || string.IsNullOrEmpty(name)) return null;
        bool updateRequired = stateFlags != 4;
        return new GameStatus
        {
            Name = name,
            Launcher = "Steam",
            InstallDir = string.IsNullOrEmpty(installDir) ? name : installDir,
            AppId = appId,
            BuildId = buildId,
            UpdateRequired = updateRequired,
            LibraryPath = libraryPath
        };
    }
}
