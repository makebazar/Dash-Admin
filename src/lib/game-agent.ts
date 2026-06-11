export interface AgentServerSettings {
  executablePath?: string;
  matchTitle: string;
  map: string;
  port: number;
  rconPassword?: string;
  isLan?: boolean;
}

/**
 * Connector class for the local C# DashAdmin Game Agent (typically running on port 5000 of the club server)
 */
export class GameAgentConnector {
  private agentUrl: string;

  constructor(agentUrl = "http://127.0.0.1:5000") {
    // Trim trailing slash
    this.agentUrl = agentUrl.replace(/\/$/, "");
  }

  private async request(path: string, options: RequestInit = {}): Promise<any> {
    const url = `${this.agentUrl}${path}`;
    const headers = {
      "Content-Type": "application/json",
      ...(options.headers || {}),
    };

    try {
      const response = await fetch(url, {
        ...options,
        headers,
      });

      if (!response.ok) {
        const errText = await response.text();
        throw new Error(`Agent API Error (${response.status}): ${errText}`);
      }

      const contentType = response.headers.get("content-type");
      if (contentType && contentType.includes("application/json")) {
        return await response.json();
      }
      return await response.text();
    } catch (err) {
      console.error(`GameAgent request failed to URL: ${url}`, err);
      throw err;
    }
  }

  // 1. Discovery and installation
  async discover(): Promise<{ path: string }> {
    return this.request("/api/discover");
  }

  async checkMods(gamePath: string): Promise<{ installed: boolean }> {
    return this.request(`/api/server/mods-check?path=${encodeURIComponent(gamePath)}`);
  }

  async installMods(gamePath: string): Promise<any> {
    return this.request("/api/install", {
      method: "POST",
      body: JSON.stringify({ gamePath }),
    });
  }

  // 2. Server Management
  async getServers(): Promise<any[]> {
    return this.request("/api/servers");
  }

  async addServer(settings: AgentServerSettings): Promise<{ id: string }> {
    return this.request("/api/servers/add", {
      method: "POST",
      body: JSON.stringify({
        executablePath: settings.executablePath,
        matchTitle: settings.matchTitle,
        map: settings.map,
        port: settings.port,
        rconPassword: settings.rconPassword || "club123",
        isLan: settings.isLan !== false,
      }),
    });
  }

  async startServer(serverId: string): Promise<any> {
    return this.request(`/api/servers/${serverId}/start`, {
      method: "POST",
    });
  }

  async stopServer(serverId: string): Promise<any> {
    return this.request(`/api/servers/${serverId}/stop`, {
      method: "POST",
    });
  }

  async sendRcon(serverId: string, command: string): Promise<{ response: string }> {
    return this.request(`/api/servers/${serverId}/rcon`, {
      method: "POST",
      body: JSON.stringify({ command }),
    });
  }

  // 3. Match Stats
  async getMatches(): Promise<any[]> {
    return this.request("/api/matches");
  }

  async getMatchStats(matchId: string): Promise<any> {
    return this.request(`/api/matches/${matchId}/stats`);
  }

  // 4. Custom whitelisting flow via RCON commands
  async whitelistPlayers(serverId: string, steamIds: string[]): Promise<void> {
    console.log(`[GameAgent] Whitelisting players on server ${serverId}: ${steamIds.join(", ")}`);
    
    // Enable MatchZy whitelist
    await this.sendRcon(serverId, "matchzy_whitelist_enabled 1");
    // Clear any previous whitelist
    await this.sendRcon(serverId, "matchzy_whitelist_clear");
    
    // Add each SteamID
    for (const steamId of steamIds) {
      if (steamId && steamId.trim()) {
        await this.sendRcon(serverId, `matchzy_whitelist_add ${steamId.trim()}`);
      }
    }
  }
}
export default GameAgentConnector;
