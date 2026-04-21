using System;
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
                return new ApiResponse<RegisterResult>
                {
                    Ok = false,
                    Url = url,
                    StatusCode = status,
                    Body = body,
                    Error = $"HTTP {status}"
                };
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
        catch (Exception ex)
        {
            return new ApiResponse<RegisterResult>
            {
                Ok = false,
                Url = url,
                StatusCode = 0,
                Body = "",
                Error = ex.ToString()
            };
        }
    }

    public async Task<ApiResponse<object>> SendTelemetryAsync(string serverUrl, TelemetryPayload payload, CancellationToken ct)
    {
        var url = $"{Trim(serverUrl)}/api/agents/telemetry";
        try
        {
            var dto = new
            {
                workstation_id = payload.WorkstationId,
                hostname = payload.Hostname,
                cpu = new
                {
                    temp = payload.Cpu.Temp,
                    usage = payload.Cpu.Usage,
                    model_name = payload.Cpu.ModelName
                },
                memory = new
                {
                    totalBytes = payload.Memory.TotalBytes,
                    usedBytes = payload.Memory.UsedBytes
                },
                gpu_data = payload.GpuData.Select(g => new
                {
                    name = g.Name,
                    temp = g.Temp,
                    usage = g.Usage,
                    memoryUsed = g.MemoryUsed,
                    memoryTotal = g.MemoryTotal
                }).ToArray(),
                disks = payload.Disks.Select(d => new
                {
                    name = d.Name,
                    mount = d.Mount,
                    totalBytes = d.TotalBytes,
                    freeBytes = d.FreeBytes
                }).ToArray(),
                devices = payload.Devices.Select(d => new
                {
                    name = d.Name,
                    type = d.Type,
                    id = d.Id
                }).ToArray()
            };

            var requestBody = JsonSerializer.Serialize(dto, new JsonSerializerOptions { WriteIndented = true });
            var res = await _http.PostAsJsonAsync(url, dto, ct);

            var body = await res.Content.ReadAsStringAsync(ct);
            var status = (int)res.StatusCode;
            if (!res.IsSuccessStatusCode)
            {
                return new ApiResponse<object>
                {
                    Ok = false,
                    Url = url,
                    StatusCode = status,
                    RequestBody = requestBody,
                    Body = body,
                    Error = $"HTTP {status}"
                };
            }

            return new ApiResponse<object> { Ok = true, Url = url, StatusCode = status, RequestBody = requestBody, Body = body, Data = new object() };
        }
        catch (Exception ex)
        {
            return new ApiResponse<object>
            {
                Ok = false,
                Url = url,
                StatusCode = 0,
                RequestBody = "",
                Body = "",
                Error = ex.ToString()
            };
        }
    }

    private static string Trim(string url)
    {
        url = url.Trim();
        while (url.EndsWith("/")) url = url[..^1];
        return url;
    }
}
