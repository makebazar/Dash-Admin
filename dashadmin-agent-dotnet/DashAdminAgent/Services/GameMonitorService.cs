using System;
using System.Collections.Generic;
using System.IO;
using System.Text.RegularExpressions;
using Microsoft.Win32;

namespace DashAdminAgent.Services;

public sealed class GameStatus
{
    public string Name { get; set; } = "";
    public string InstallDir { get; set; } = ""; // The actual folder name
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

    public List<GameStatus> ScanSteamGames(string? extraLibraryPath = null)
    {
        var games = new List<GameStatus>();
        var libraryPaths = GetSteamLibraryPaths();
        if (!string.IsNullOrEmpty(extraLibraryPath) && !libraryPaths.Contains(extraLibraryPath))
        {
            libraryPaths.Add(extraLibraryPath);
        }

        foreach (var libraryPath in libraryPaths)
        {
            try
            {
                var steamappsPath = Path.Combine(libraryPath, "steamapps");
                if (!Directory.Exists(steamappsPath)) continue;

                var acfFiles = Directory.GetFiles(steamappsPath, "appmanifest_*.acf");
                foreach (var file in acfFiles)
                {
                    var status = ParseAcfFile(file, libraryPath);
                    if (status != null)
                    {
                        // Deduplicate by AppId, prioritizing local versions if they exist
                        var existing = games.Find(g => g.AppId == status.AppId);
                        if (existing == null)
                        {
                            games.Add(status);
                        }
                    }
                }
            }
            catch (Exception ex)
            {
                Console.WriteLine($"Error scanning library {libraryPath}: {ex.Message}");
            }
        }

        return games;
    }

    private List<string> GetSteamLibraryPaths()
    {
        var paths = new List<string>();

        // Try to find primary Steam path from Registry
        string? steamPath = null;
        try
        {
            using var key = Registry.CurrentUser.OpenSubKey(@"Software\Valve\Steam");
            if (key != null)
            {
                steamPath = key.GetValue("SteamPath") as string;
            }
        }
        catch
        {
            // Registry access failed, fallback to default path
        }

        if (string.IsNullOrEmpty(steamPath))
        {
            steamPath = Path.Combine(
                Environment.GetFolderPath(Environment.SpecialFolder.ProgramFilesX86),
                "Steam"
            );
        }

        // Standardize path separators
        steamPath = Path.GetFullPath(steamPath.Replace('/', '\\'));
        if (Directory.Exists(steamPath))
        {
            paths.Add(steamPath);

            // Read libraryfolders.vdf to find other Steam libraries (e.g. on drive D, E)
            var libraryFoldersFile = Path.Combine(steamPath, "steamapps", "libraryfolders.vdf");
            if (File.Exists(libraryFoldersFile))
            {
                try
                {
                    var content = File.ReadAllText(libraryFoldersFile);
                    var matches = PathRegex.Matches(content);
                    foreach (Match match in matches)
                    {
                        if (match.Groups.Count > 1)
                        {
                            var rawPath = match.Groups[1].Value;
                            var cleanPath = Path.GetFullPath(rawPath.Replace(@"\\", @"\").Replace('/', '\\'));
                            if (Directory.Exists(cleanPath) && !paths.Contains(cleanPath))
                            {
                                paths.Add(cleanPath);
                            }
                        }
                    }
                }
                catch (Exception ex)
                {
                    Console.WriteLine($"Error reading libraryfolders.vdf: {ex.Message}");
                }
            }
        }

        return paths;
    }

    private GameStatus? ParseAcfFile(string filePath, string libraryPath)
    {
        try
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
                        case "name":
                            name = val;
                            break;
                        case "installdir":
                            installDir = val;
                            break;
                        case "appid":
                            int.TryParse(val, out appId);
                            break;
                        case "buildid":
                            buildId = val;
                            break;
                        case "stateflags":
                            int.TryParse(val, out stateFlags);
                            break;
                    }
                }
            }

            if (appId == 0 || string.IsNullOrEmpty(name)) return null;

            // StateFlags = 4 means fully installed and updated
            bool updateRequired = stateFlags != 4;

            return new GameStatus
            {
                Name = name,
                InstallDir = string.IsNullOrEmpty(installDir) ? name : installDir,
                AppId = appId,
                BuildId = buildId,
                UpdateRequired = updateRequired,
                LibraryPath = libraryPath
            };
        }
        catch (Exception ex)
        {
            Console.WriteLine($"Error parsing ACF file {filePath}: {ex.Message}");
            return null;
        }
    }
}
