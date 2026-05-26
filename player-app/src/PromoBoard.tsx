import React, { useEffect, useState } from "react";
import {
  Trophy,
  Target,
  Gift,
  Clock,
  Zap,
  Users,
  Gamepad2,
  Ticket,
  CreditCard,
  UtensilsCrossed,
} from "lucide-react";
import QRCodeLib from "qrcode";

type PromoBoardProps = {
  clubId: number | string;
  serverUrl: string;
  isPortrait?: boolean;
};

export function PromoBoard({ clubId, serverUrl, isPortrait = false }: PromoBoardProps) {
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);
  const [qrSvg, setQrSvg] = useState<string>("");

  useEffect(() => {
    const fetchData = async () => {
      try {
        const response = await fetch(`${serverUrl}/api/promo/board/data?clubId=${clubId}`);
        const result = await response.json();
        setData(result);
      } catch (error) {
        console.error("Failed to fetch promo board data:", error);
      } finally {
        setLoading(false);
      }
    };

    fetchData();
    const interval = setInterval(fetchData, 60000);
    return () => clearInterval(interval);
  }, [clubId, serverUrl]);

  useEffect(() => {
    const domain = "game.mydashadmin.ru";
    const url = `https://${domain}/?clubId=${clubId}`;

    QRCodeLib.toString(url, {
      type: "svg",
      margin: 1,
      width: 180,
      color: { dark: "#FFFFFF", light: "#00000000" }
    }).then(setQrSvg).catch(console.error);
  }, [clubId]);

  if (loading) {
    return (
      <div className="promo-board-loading">
        <Clock className="animate-spin" />
        <span>Загрузка данных...</span>
      </div>
    );
  }

  if (!data) return null;

  return (
    <div className={`promo-board ${isPortrait ? "is-portrait" : ""}`}>
      <div className="promo-header">
        <h1>{data.clubName || "DashAdmin"}</h1>
        <div className="promo-qr-container">
          <div className="promo-qr" dangerouslySetInnerHTML={{ __html: qrSvg }} />
          <div className="promo-qr-text">
            <span>Играй и выигрывай</span>
            <strong>game.mydashadmin.ru</strong>
          </div>
        </div>
      </div>

      <div className="promo-grid">
        <section className="promo-section promo-leaderboard">
          <h2><Trophy className="icon" /> Лидеры</h2>
          <div className="promo-list">
            {data.leaderboard?.slice(0, 5).map((player: any, i: number) => (
              <div key={player.id} className="promo-item">
                <span className="rank">{i + 1}</span>
                <span className="name">{player.name}</span>
                <span className="value">{player.level} LVL</span>
              </div>
            ))}
          </div>
        </section>

        <section className="promo-section promo-quests">
          <h2><Target className="icon" /> Активные квесты</h2>
          <div className="promo-list">
            {data.quests?.slice(0, 4).map((quest: any) => (
              <div key={quest.id} className="promo-item quest-item">
                <div className="quest-icon">{getQuestIcon(quest.trigger_type)}</div>
                <div className="quest-details">
                  <span className="title">{quest.title}</span>
                  <span className="reward">{quest.reward_xp} XP</span>
                </div>
              </div>
            ))}
          </div>
        </section>

        <section className="promo-section promo-wins">
          <h2><Gift className="icon" /> Последние призы</h2>
          <div className="promo-list">
            {data.recentWins?.slice(0, 3).map((win: any) => (
              <div key={win.id} className="promo-item win-item">
                <span className="name">{win.player_name}</span>
                <span className="prize">{win.prize_title}</span>
              </div>
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function getQuestIcon(trigger: string) {
  switch (trigger) {
    case "receipt_item":
    case "receipt_total":
      return <UtensilsCrossed className="w-5 h-5 text-blue-400" />;
    case "balance_topup":
      return <CreditCard className="w-5 h-5 text-yellow-400" />;
    case "game_play_count":
    case "game_win_count":
      return <Gamepad2 className="w-5 h-5 text-emerald-400" />;
    case "ticket_spend":
      return <Ticket className="w-5 h-5 text-purple-400" />;
    default:
      return <Zap className="w-5 h-5 text-orange-400" />;
  }
}
