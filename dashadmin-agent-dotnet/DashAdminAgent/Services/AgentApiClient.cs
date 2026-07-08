using System;
using System.Collections.Generic;
using System.Linq;
using System.Net.Http;
using System.Net.Http.Json;
using System.Text.Json;
using System.Threading;
using System.Threading.Tasks;
using DashAdminAgent.Models;

namespace DashAdminAgent.Services;

public sealed class AgentApiClient
{
    private readonly HttpClient _http;

    public AgentApiClient(HttpClient http)
    {
        _http = http;
        _http.Timeout = TimeSpan.FromSeconds(10);
    }

    public sealed class ApiResponse<T>
    {
        public bool Ok { get; init; }
        public string Url { get; init; } = "";
        public int StatusCode { get; init; }
        public string RequestBody { get; init; } = "";
        public string Body { get; init; } = "";
        public string Error { get; init; } = "";
        public T? Data { get; init; }
    }

    public sealed class RegisterResult
    {
        public string WorkstationId { get; set; } = "";
        public string ClubId { get; set; } = "";
        public string Name { get; set; } = "";
    }

    public async Task<ApiResponse<RegisterResult>> RegisterAsync(string serverUrl, string bindingCode, string hostname, CancellationToken ct)
    {
        var url = $"{Trim(serverUrl)}/api/agents/register";
        try
        {
            var res = await _http.PostAsJsonAsync(url, new { binding_code = bindingCode, hostname }, ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            var status = (int)res.StatusCode;

            if (!res.IsSuccessStatusCode)
            {
                return new ApiResponse<RegisterResult> { Ok = false, Url = url, StatusCode = status, Body = body, Error = $"HTTP {status}" };
            }

            var json = JsonSerializer.Deserialize<JsonElement>(body);
            static string ReadString(JsonElement el)
            {
                return el.ValueKind switch
                {
                    JsonValueKind.String => el.GetString() ?? "",
                    JsonValueKind.Number => el.GetRawText(),
                    JsonValueKind.True => "true",
                    JsonValueKind.False => "false",
                    _ => ""
                };
            }
            var data = new RegisterResult
            {
                WorkstationId = ReadString(json.GetProperty("workstation_id")),
                ClubId = json.TryGetProperty("club_id", out var clubId) ? ReadString(clubId) : "",
                Name = json.TryGetProperty("name", out var name) ? ReadString(name) : ""
            };

            return new ApiResponse<RegisterResult> { Ok = true, Url = url, StatusCode = status, Body = body, Data = data };
        }
        catch (Exception ex) { return new ApiResponse<RegisterResult> { Ok = false, Url = url, Error = ex.ToString() }; }
    }

    public async Task<ApiResponse<object>> SendFullStateAsync(string serverUrl, string workstationId, FullStatePayload payload, CancellationToken ct)
    {
        var url = $"{Trim(serverUrl)}/api/agents/full-state";
        try
        {
            var res = await _http.PostAsJsonAsync(url, payload, ct);
            return new ApiResponse<object> { Ok = res.IsSuccessStatusCode, StatusCode = (int)res.StatusCode };
        }
        catch (Exception ex) { return new ApiResponse<object> { Ok = false, Error = ex.Message }; }
    }

    public sealed class FullStatePayload
    {
        public string workstation_id { get; set; } = "";
        public string hostname { get; set; } = "";
        public bool is_locked { get; set; }
        public HardwarePayload hardware { get; set; } = new();
        public List<GameRowDto> games { get; set; } = new();
        public ConfigDto config { get; set; } = new();
        public List<LogRow> logs { get; set; } = new();
    }

    public class HardwarePayload
    {
        public float cpu_temp { get; set; }
        public float cpu_load { get; set; }
        public string cpu_name { get; set; } = "";
        public List<GpuDto> gpus { get; set; } = new();
        public List<DiskRow> disks { get; set; } = new();
        public List<DeviceRow> devices { get; set; } = new();
        public ulong mem_total { get; set; }
        public ulong mem_used { get; set; }
    }

    public class GpuDto { public string name { get; set; } = ""; public float temp { get; set; } public float load { get; set; } public ulong mem_used { get; set; } public ulong mem_total { get; set; } }
    
    public class GameRowDto
    {
        public string name { get; set; } = "";
        public int app_id { get; set; }
        public string status_text { get; set; } = "";
        public string status_fg { get; set; } = "";
        public string local_build { get; set; } = "";
        public string master_build { get; set; } = "";
        public string latest_build { get; set; } = "";
        public bool is_updating { get; set; }
        public double progress { get; set; }
        public string speed { get; set; } = "";
        public bool is_ignored { get; set; }
        public bool is_extra { get; set; }
        public bool is_installed { get; set; }
        public string size { get; set; } = "";
        public string group { get; set; } = "";
    }

    public class ConfigDto
    {
        public bool is_master { get; set; }
        public string master_path { get; set; } = "";
        public string authorized_ids { get; set; } = "";
        public bool auto_start { get; set; }
        public bool has_pin { get; set; }
    }

    public sealed class AgentCommand
    {
        public string id { get; set; } = "";
        public string type { get; set; } = "";
        public JsonElement payload { get; set; }
    }

    public async Task<ApiResponse<List<AgentCommand>>> GetCommandsAsync(string serverUrl, string workstationId, CancellationToken ct)
    {
        var url = $"{Trim(serverUrl)}/api/agents/commands?workstation_id={workstationId}";
        try
        {
            var res = await _http.GetAsync(url, ct);
            var body = await res.Content.ReadAsStringAsync(ct);
            if (!res.IsSuccessStatusCode) return new ApiResponse<List<AgentCommand>> { Ok = false, Url = url, StatusCode = (int)res.StatusCode, Error = body };
            var commands = JsonSerializer.Deserialize<List<AgentCommand>>(body);
            return new ApiResponse<List<AgentCommand>> { Ok = true, Url = url, Data = commands ?? new List<AgentCommand>() };
        }
        catch (Exception ex) { return new ApiResponse<List<AgentCommand>> { Ok = false, Error = ex.Message }; }
    }

    public async Task<ApiResponse<object>> MarkCommandDoneAsync(string serverUrl, string workstationId, string commandId, CancellationToken ct)
    {
        var url = $"{Trim(serverUrl)}/api/agents/commands/done";
        try
        {
            var res = await _http.PostAsJsonAsync(url, new { workstation_id = workstationId, command_id = commandId }, ct);
            return new ApiResponse<object> { Ok = res.IsSuccessStatusCode };
        }
        catch { return new ApiResponse<object> { Ok = false }; }
    }

    public async Task<ApiResponse<List<int>>> GetAuthorizedGamesAsync(string baseUrl, string workstationId, CancellationToken ct)
    {
        try
        {
            var res = await _http.GetAsync($"{Trim(baseUrl)}/api/agent/authorized-games?workstation_id={workstationId}", ct);
            if (!res.IsSuccessStatusCode) return new ApiResponse<List<int>> { Ok = false, StatusCode = (int)res.StatusCode };
            var data = await res.Content.ReadFromJsonAsync<List<int>>(cancellationToken: ct);
            return new ApiResponse<List<int>> { Ok = true, Data = data, StatusCode = (int)res.StatusCode };
        }
        catch (Exception ex) { return new ApiResponse<List<int>> { Ok = false, Error = ex.Message }; }
    }

    private static string Trim(string url)
    {
        if (string.IsNullOrWhiteSpace(url)) return "";
        url = url.Trim();
        while (url.EndsWith("/")) url = url[..^1];
        return url;
    }
}
