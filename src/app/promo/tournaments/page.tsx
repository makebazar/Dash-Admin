"use client";

import React, { useEffect, useState, useCallback } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { TournamentsHeader } from "./components/TournamentsHeader";
import { TournamentsNavTabs, TournamentTabType } from "./components/TournamentsNavTabs";
import { TournamentsFeedTab } from "./components/TournamentsFeedTab";
import { MyTeamTab } from "./components/MyTeamTab";
import { TournamentProfileTab } from "./components/TournamentProfileTab";
import { LeaderboardTab } from "./components/LeaderboardTab";
import { BottomNav } from "../components/BottomNav";

export default function TournamentsPortal() {
  const router = useRouter();
  const searchParams = useSearchParams();

  const urlClubId = searchParams.get("clubId") || "";
  const urlTournamentId = searchParams.get("tournamentId") || searchParams.get("id") || "";
  const urlTab = searchParams.get("tab") || "";
  const urlPlayerId = searchParams.get("playerId") || "";

  const [clubId, setClubId] = useState<string>(urlClubId);
  const [activeTab, setActiveTab] = useState<TournamentTabType>(() => {
    if (urlPlayerId) return "profile";
    if (urlTab === "team" || urlTab === "profile" || urlTab === "leaderboard") return urlTab;
    return "feed";
  });
  const [loading, setLoading] = useState(true);
  const [player, setPlayer] = useState<any>(null);

  // Tournament feed states
  const [tournaments, setTournaments] = useState<any[]>([]);
  const [activeTournament, setActiveTournament] = useState<any>(null);
  const [competitors, setCompetitors] = useState<any[]>([]);
  const [matches, setMatches] = useState<any[]>([]);

  // Team states
  const [teams, setTeams] = useState<any[]>([]);
  const [incomingInvites, setIncomingInvites] = useState<any[]>([]);
  const [outgoingInvites, setOutgoingInvites] = useState<any[]>([]);
  const [lftPlayers, setLftPlayers] = useState<any[]>([]);
  const [activeTeamId, setActiveTeamId] = useState<string | null>(null);

  // Leaderboard states
  const [leaderboardDiscipline, setLeaderboardDiscipline] = useState("cs2");
  const [leaderboard, setLeaderboard] = useState<any[]>([]);

  // Selected player for viewing public tournament profile in Profile tab
  const [targetPlayerId, setTargetPlayerId] = useState<string | null>(urlPlayerId || null);
  const [targetPlayerName, setTargetPlayerName] = useState<string | null>(null);

  // Helper to sync query parameters without full page reloads
  const updateUrl = useCallback((newParams: Record<string, string | null>) => {
    if (typeof window === "undefined") return;
    const current = new URLSearchParams(window.location.search);
    Object.entries(newParams).forEach(([k, v]) => {
      if (v === null || v === undefined || v === "") {
        current.delete(k);
      } else {
        current.set(k, v);
      }
    });
    const qs = current.toString();
    const newUrl = `${window.location.pathname}${qs ? `?${qs}` : ""}`;
    window.history.replaceState(null, "", newUrl);
  }, []);

  const fetchPlayerAndTeam = async (overrideActiveId?: string | number, currentClubId = clubId) => {
    try {
      const pRes = await fetch("/api/promo/player");
      if (pRes.status === 401) {
        router.push(`/promo/login?clubId=${currentClubId}`);
        return null;
      }
      const pData = await pRes.json();
      setPlayer(pData.player);

      const tRes = await fetch("/api/promo/teams");
      const tData = await tRes.json();
      const fetchedTeams = tData.teams || [];
      setTeams(fetchedTeams);
      setIncomingInvites(tData.incomingInvites || []);
      setOutgoingInvites(tData.outgoingInvites || []);
      setLftPlayers(tData.lftPlayers || []);

      if (fetchedTeams.length > 0) {
        if (overrideActiveId && fetchedTeams.some((t: any) => String(t.id) === String(overrideActiveId))) {
          setActiveTeamId(String(overrideActiveId));
        } else {
          setActiveTeamId((prev) => {
            if (prev && fetchedTeams.some((t: any) => String(t.id) === String(prev))) return String(prev);
            return String(fetchedTeams[0].id);
          });
        }
      } else {
        setActiveTeamId(null);
      }

      const resolvedClubId = currentClubId || (pData.player.clubId ? String(pData.player.clubId) : "");
      if (resolvedClubId && resolvedClubId !== clubId) {
        setClubId(resolvedClubId);
        updateUrl({ clubId: resolvedClubId });
      }
      return resolvedClubId;
    } catch (err) {
      console.error(err);
      return null;
    }
  };

  const fetchTournaments = async (targetClubId = clubId) => {
    if (!targetClubId) return;
    try {
      const res = await fetch(`/api/clubs/${targetClubId}/tournaments`);
      const data = await res.json();
      setTournaments(data.tournaments || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchTournamentDetails = async (id: string | number, targetClubId = clubId) => {
    if (!targetClubId) return;
    try {
      const res = await fetch(`/api/clubs/${targetClubId}/tournaments?id=${id}`);
      const data = await res.json();
      setActiveTournament(data.tournament);
      setCompetitors(data.competitors || []);
      setMatches(data.matches || []);
    } catch (err) {
      console.error(err);
    }
  };

  const fetchLeaderboard = async (discipline: string, targetClubId = clubId) => {
    try {
      if (!targetClubId) return;
      const boardRes = await fetch(`/api/promo/public/board-data?discipline=${discipline}&clubId=${targetClubId}`);
      if (!boardRes.ok) {
        setLeaderboard([]);
        return;
      }
      const boardData = await boardRes.json();
      setLeaderboard(boardData.leaderboard || []);
    } catch (err) {
      console.error(err);
    }
  };

  const urlJoinCode = searchParams.get("join") || "";

  useEffect(() => {
    async function init() {
      setLoading(true);
      const resolvedClubId = await fetchPlayerAndTeam(undefined, urlClubId);
      const effectiveClub = resolvedClubId || urlClubId;

      if (effectiveClub) {
        await fetchTournaments(effectiveClub);

        // Auto-load tournament if URL has tournamentId
        if (urlTournamentId) {
          await fetchTournamentDetails(urlTournamentId, effectiveClub);
        }
      }

      // Handle auto-join via invite link
      if (urlJoinCode) {
        try {
          const joinRes = await fetch("/api/promo/teams", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ action: "join", joinCode: urlJoinCode.trim().toUpperCase() }),
          });
          const joinData = await joinRes.json();
          if (joinRes.ok) {
            alert("Вы успешно вступили в команду по приглашению!");
            await fetchPlayerAndTeam(joinData.teamId, effectiveClub);
            setActiveTab("team");
            updateUrl({ tab: "team", join: null });
          }
        } catch (e) {
          console.warn("Auto-join error:", e);
        }
      }

      setLoading(false);
    }
    init();
  }, [urlClubId, urlJoinCode, urlTournamentId]);

  // Re-fetch data whenever tab is switched so views are always completely fresh
  useEffect(() => {
    if (activeTab === "team" || activeTab === "feed") {
      fetchPlayerAndTeam(activeTeamId || undefined);
      if (clubId) fetchTournaments(clubId);
    } else if (activeTab === "leaderboard") {
      fetchLeaderboard(leaderboardDiscipline);
    }
  }, [activeTab]);

  // Real-time SSE listener for active tournament (live scores, bracket updates, competitors)
  useEffect(() => {
    if (!activeTournament?.id) return;
    const tourneyId = activeTournament.id;
    const sseUrl = `/api/promo/tournaments/${tourneyId}/stream`;
    const eventSource = new EventSource(sseUrl);

    eventSource.addEventListener("update", () => {
      fetchTournamentDetails(tourneyId, clubId);
    });

    eventSource.onerror = () => {
      // EventSource auto-reconnects
    };

    return () => {
      eventSource.close();
    };
  }, [activeTournament?.id, clubId]);

  const handleTabChange = (tab: TournamentTabType) => {
    setActiveTab(tab);
    setActiveTournament(null);
    if (tab !== "profile") {
      handleResetToSelf();
      updateUrl({
        tab: tab === "feed" ? null : tab,
        tournamentId: null,
        id: null,
        playerId: null,
        detailTab: null,
      });
    } else {
      updateUrl({
        tab: "profile",
        tournamentId: null,
        id: null,
        detailTab: null,
      });
    }
  };

  const handleSelectPlayer = (pId: string, pName: string) => {
    setTargetPlayerId(pId);
    setTargetPlayerName(pName);
    setActiveTournament(null);
    setActiveTab("profile");
    updateUrl({
      tab: "profile",
      playerId: pId,
      tournamentId: null,
      id: null,
      detailTab: null,
    });
  };

  const handleResetToSelf = () => {
    setTargetPlayerId(null);
    setTargetPlayerName(null);
    updateUrl({ playerId: null });
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#070708] flex items-center justify-center text-white">
        <span className="text-xs font-black uppercase tracking-widest text-gray-500 animate-pulse">
          Загрузка турнирного портала...
        </span>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#070708] text-white selection:bg-orange-500/20 selection:text-orange-400 pb-36 font-sans">
      {/* Header */}
      <TournamentsHeader player={player} />

      {/* Main Container */}
      <div className="max-w-6xl mx-auto px-4 sm:px-6 py-6">
        {/* Navigation Tabs */}
        <TournamentsNavTabs
          activeTab={activeTab}
          onSelectTab={handleTabChange}
          selectedPlayerName={targetPlayerName}
        />

        {/* Tab 1: FEED / TOURNAMENTS */}
        {activeTab === "feed" && (
          <TournamentsFeedTab
            player={player}
            tournaments={tournaments}
            activeTournament={activeTournament}
            setActiveTournament={setActiveTournament}
            competitors={competitors}
            matches={matches}
            teams={teams}
            clubId={clubId}
            fetchTournamentDetails={fetchTournamentDetails}
            fetchTournaments={fetchTournaments}
            onSelectPlayer={handleSelectPlayer}
          />
        )}

        {/* Tab 2: MY TEAM */}
        {activeTab === "team" && (
          <MyTeamTab
            player={player}
            teams={teams}
            incomingInvites={incomingInvites}
            outgoingInvites={outgoingInvites}
            lftPlayers={lftPlayers}
            activeTeamId={activeTeamId}
            setActiveTeamId={setActiveTeamId}
            onRefreshTeams={fetchPlayerAndTeam}
            onSelectPlayer={handleSelectPlayer}
          />
        )}

        {/* Tab 3: TOURNAMENT PROFILE */}
        {activeTab === "profile" && (
          <TournamentProfileTab
            currentPlayer={player}
            targetPlayerId={targetPlayerId}
            onResetToSelf={handleResetToSelf}
            onRefreshPlayer={fetchPlayerAndTeam}
          />
        )}

        {/* Tab 4: LEADERBOARD */}
        {activeTab === "leaderboard" && (
          <LeaderboardTab
            leaderboardDiscipline={leaderboardDiscipline}
            setLeaderboardDiscipline={setLeaderboardDiscipline}
            leaderboard={leaderboard}
            onSelectPlayer={handleSelectPlayer}
          />
        )}
      </div>

      <BottomNav />
    </div>
  );
}
