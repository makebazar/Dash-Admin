namespace DashAdminAgent.Models;

using System;
using System.Collections.Generic;

public sealed class AgentConfig
{
    public string ServerUrl { get; set; } = "https://mydashadmin.ru";
    public string BindingCode { get; set; } = "";
    public string WorkstationId { get; set; } = "";
    public string ClubId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Hostname { get; set; } = "";
    public string SteamUsername { get; set; } = "";
    public string SteamPassword { get; set; } = "";
    public string MasterMachinePath { get; set; } = "";
    public string AuthorizedAppIds { get; set; } = ""; 
    public string SettingsPin { get; set; } = ""; 
    public string IgnoredAppIds { get; set; } = ""; 
    public DateTime? LastCloudCheck { get; set; }
    public Dictionary<string, string> SavedCloudBuilds { get; set; } = new();
    public bool IsMaster { get; set; } = false;
    public bool AutoStart { get; set; } = false;
}
