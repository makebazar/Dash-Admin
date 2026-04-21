namespace DashAdminAgent.Models;

using System;

public sealed class AgentConfig
{
    public string ServerUrl { get; set; } = "https://www.mydashadmin.ru";
    public string BindingCode { get; set; } = "";
    public string WorkstationId { get; set; } = "";
    public string ClubId { get; set; } = "";
    public string Name { get; set; } = "";
    public string Hostname { get; set; } = "";
}
