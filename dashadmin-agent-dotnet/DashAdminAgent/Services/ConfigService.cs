using System;
using System.IO;
using System.Text.Json;
using DashAdminAgent.Models;

namespace DashAdminAgent.Services;

public sealed class ConfigService
{
    private static readonly JsonSerializerOptions Options = new()
    {
        PropertyNamingPolicy = JsonNamingPolicy.CamelCase,
        WriteIndented = true
    };

    public string GetConfigPath()
    {
        var baseDir = Path.Combine(
            Environment.GetFolderPath(Environment.SpecialFolder.ApplicationData),
            "DashAdminAgent"
        );
        Directory.CreateDirectory(baseDir);
        return Path.Combine(baseDir, "config.json");
    }

    public AgentConfig Load()
    {
        try
        {
            var path = GetConfigPath();
            if (!File.Exists(path)) return new AgentConfig();
            var json = File.ReadAllText(path);
            return JsonSerializer.Deserialize<AgentConfig>(json, Options) ?? new AgentConfig();
        }
        catch
        {
            return new AgentConfig();
        }
    }

    public void Save(AgentConfig config)
    {
        var path = GetConfigPath();
        var json = JsonSerializer.Serialize(config, Options);
        File.WriteAllText(path, json);
    }
}
