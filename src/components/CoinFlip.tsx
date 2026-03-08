import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw, Trophy } from "lucide-react";

interface CoinFlipProps {
  gameId: string;
  currentUserId: string;
  profilesMap: Record<string, { username: string; avatar_url: string | null }>;
}

const getUserColor = (username: string) => {
  const colors = ["hsl(199, 89%, 55%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 55%)", "hsl(280, 65%, 60%)", "hsl(0, 72%, 60%)", "hsl(32, 98%, 55%)"];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const CoinFlip = ({ gameId, currentUserId, profilesMap }: CoinFlipProps) => {
  const [playerX, setPlayerX] = useState("");
  const [playerO, setPlayerO] = useState<string | null>(null);
  const [board, setBoard] = useState("-:-:-"); // p1bet:p2bet:result
  const [status, setStatus] = useState("pending");
  const [winner, setWinner] = useState<string | null>(null);
  const [flipping, setFlipping] = useState(false);

  const getProfile = (uid: string) => profilesMap[uid] || { username: uid.slice(0, 6), avatar_url: null };

  const loadGame = useCallback(async () => {
    const { data } = await supabase.from("games").select("*").eq("id", gameId).single();
    if (data) { setBoard(data.board); setPlayerX(data.player_x); setPlayerO(data.player_o); setStatus(data.status); setWinner(data.winner); }
  }, [gameId]);

  useEffect(() => { loadGame(); }, [loadGame]);

  useEffect(() => {
    const channel = supabase.channel(`game-cf-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        const d = payload.new as any;
        setBoard(d.board); setPlayerX(d.player_x); setPlayerO(d.player_o); setStatus(d.status); setWinner(d.winner);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  const handleAccept = async () => {
    await supabase.from("games").update({ player_o: currentUserId, status: "active", board: "-:-:-", updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const parts = board.split(":");
  const p1Bet = parts[0] || "-";
  const p2Bet = parts[1] || "-";
  const result = parts[2] || "-";
  const isParticipant = currentUserId === playerX || currentUserId === playerO;
  const myBet = currentUserId === playerX ? p1Bet : p2Bet;
  const canAccept = status === "pending" && !isParticipant;

  const handleBet = async (bet: string) => {
    if (status !== "active" || !isParticipant || myBet !== "-") return;
    const isP1 = currentUserId === playerX;
    const newP1 = isP1 ? bet : p1Bet;
    const newP2 = isP1 ? p2Bet : bet;

    let newResult = "-";
    let gameWinner: string | null = null;
    let gameStatus = "active";

    if (newP1 !== "-" && newP2 !== "-") {
      setFlipping(true);
      newResult = Math.random() < 0.5 ? "heads" : "tails";
      gameStatus = "finished";
      // Winner is whoever bet correctly
      const p1Won = newP1 === newResult;
      const p2Won = newP2 === newResult;
      if (p1Won && p2Won) gameWinner = "draw";
      else if (p1Won) gameWinner = playerX;
      else if (p2Won) gameWinner = playerO;
      else gameWinner = "draw"; // both wrong = draw
      setTimeout(() => setFlipping(false), 1500);
    }

    const newBoard = `${newP1}:${newP2}:${newResult}`;
    await supabase.from("games").update({ board: newBoard, winner: gameWinner, status: gameStatus, updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const handleRematch = async () => {
    await supabase.from("games").update({ board: "-:-:-", player_x: playerO || currentUserId, player_o: playerX, status: "active", winner: null, updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  return (
    <div className="rounded-2xl p-3 sm:p-4 max-w-[260px] w-full animate-fade-in" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🪙</span>
        <span className="text-xs font-bold" style={{ color: "hsl(var(--foreground))" }}>رمي العملة</span>
      </div>

      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-medium truncate max-w-[80px]" style={{ color: getUserColor(getProfile(playerX).username) }}>
          {playerX === currentUserId ? "أنت" : getProfile(playerX).username}
        </span>
        <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>ضد</span>
        <span className="text-xs font-medium truncate max-w-[80px]" style={{ color: playerO ? getUserColor(getProfile(playerO).username) : "hsl(var(--muted-foreground))" }}>
          {!playerO ? "بانتظار..." : playerO === currentUserId ? "أنت" : getProfile(playerO).username}
        </span>
      </div>

      {status === "active" && isParticipant && myBet === "-" && (
        <div className="space-y-2">
          <p className="text-xs text-center" style={{ color: "hsl(var(--muted-foreground))" }}>اختر توقعك! 🪙</p>
          <div className="flex gap-3 justify-center">
            <button onClick={() => handleBet("heads")}
              className="flex flex-col items-center gap-1 p-3 rounded-xl transition-all hover:scale-110 active:scale-90"
              style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
              <span className="text-2xl">👑</span>
              <span className="text-xs font-medium" style={{ color: "hsl(var(--foreground))" }}>وجه</span>
            </button>
            <button onClick={() => handleBet("tails")}
              className="flex flex-col items-center gap-1 p-3 rounded-xl transition-all hover:scale-110 active:scale-90"
              style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
              <span className="text-2xl">🔢</span>
              <span className="text-xs font-medium" style={{ color: "hsl(var(--foreground))" }}>كتابة</span>
            </button>
          </div>
        </div>
      )}

      {status === "active" && isParticipant && myBet !== "-" && (
        <div className="text-center py-4">
          <span className="text-2xl mb-2 block">{myBet === "heads" ? "👑" : "🔢"}</span>
          <span className="text-xs" style={{ color: "hsl(var(--foreground))" }}>اخترت: {myBet === "heads" ? "وجه" : "كتابة"}</span>
          <p className="text-xs animate-pulse mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>بانتظار الخصم... ⏳</p>
        </div>
      )}

      {status === "pending" && canAccept && (
        <button onClick={handleAccept} className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>قبول التحدي 🪙</button>
      )}
      {status === "pending" && playerX === currentUserId && (
        <div className="text-center py-2"><span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>بانتظار قبول الخصم... ⏳</span></div>
      )}

      {status === "finished" && (
        <div className="space-y-2">
          <div className={`text-center py-3 ${flipping ? "animate-spin" : ""}`}>
            <span className="text-4xl">{result === "heads" ? "👑" : "🔢"}</span>
            <p className="text-xs font-bold mt-1" style={{ color: "hsl(var(--foreground))" }}>{result === "heads" ? "وجه!" : "كتابة!"}</p>
          </div>
          <div className="flex items-center justify-center gap-2 py-2 rounded-xl" style={{ background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.2)" }}>
            {winner === "draw" ? (
              <span className="text-sm font-bold" style={{ color: "hsl(var(--chat-admin))" }}>تعادل! 🤝</span>
            ) : winner === currentUserId ? (
              <><Trophy className="w-4 h-4" style={{ color: "hsl(var(--chat-admin))" }} /><span className="text-sm font-bold" style={{ color: "hsl(var(--chat-admin))" }}>فزت! 🎉</span></>
            ) : (
              <span className="text-sm font-bold" style={{ color: "hsl(var(--destructive))" }}>خسرت 😔</span>
            )}
          </div>
          {isParticipant && (
            <button onClick={handleRematch} className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95" style={{ background: "hsl(var(--secondary))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))" }}>
              <RotateCcw className="w-3.5 h-3.5" /> إعادة اللعب
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default CoinFlip;
