import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw, Trophy, Handshake } from "lucide-react";

interface NumberBattleProps {
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

const NumberBattle = ({ gameId, currentUserId, profilesMap }: NumberBattleProps) => {
  const [playerX, setPlayerX] = useState("");
  const [playerO, setPlayerO] = useState<string | null>(null);
  const [board, setBoard] = useState("-:-");
  const [status, setStatus] = useState("pending");
  const [winner, setWinner] = useState<string | null>(null);

  const getProfile = (uid: string) => profilesMap[uid] || { username: uid.slice(0, 6), avatar_url: null };

  const loadGame = useCallback(async () => {
    const { data } = await supabase.from("games").select("*").eq("id", gameId).single();
    if (data) { setBoard(data.board); setPlayerX(data.player_x); setPlayerO(data.player_o); setStatus(data.status); setWinner(data.winner); }
  }, [gameId]);

  useEffect(() => { loadGame(); }, [loadGame]);

  useEffect(() => {
    const channel = supabase.channel(`game-nb-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        const d = payload.new as any;
        setBoard(d.board); setPlayerX(d.player_x); setPlayerO(d.player_o); setStatus(d.status); setWinner(d.winner);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  const handleAccept = async () => {
    await supabase.from("games").update({ player_o: currentUserId, status: "active", board: "-:-", updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const [p1Num, p2Num] = board.split(":");
  const isParticipant = currentUserId === playerX || currentUserId === playerO;
  const myNum = currentUserId === playerX ? p1Num : p2Num;
  const canAccept = status === "pending" && !isParticipant;

  const handlePick = async (num: number) => {
    if (status !== "active" || !isParticipant || myNum !== "-") return;
    const isP1 = currentUserId === playerX;
    const newP1 = isP1 ? String(num) : p1Num;
    const newP2 = isP1 ? p2Num : String(num);
    const newBoard = `${newP1}:${newP2}`;

    let gameWinner: string | null = null;
    let gameStatus = "active";

    if (newP1 !== "-" && newP2 !== "-") {
      gameStatus = "finished";
      const n1 = parseInt(newP1), n2 = parseInt(newP2);
      gameWinner = n1 > n2 ? playerX : n2 > n1 ? playerO : "draw";
    }

    await supabase.from("games").update({ board: newBoard, winner: gameWinner, status: gameStatus, updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const handleRematch = async () => {
    await supabase.from("games").update({ board: "-:-", player_x: playerO || currentUserId, player_o: playerX, status: "active", winner: null, updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const numbers = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];

  return (
    <div className="rounded-2xl p-3 sm:p-4 max-w-[280px] w-full animate-fade-in" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🔢</span>
        <span className="text-xs font-bold" style={{ color: "hsl(var(--foreground))" }}>معركة الأرقام</span>
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

      {status === "active" && isParticipant && myNum === "-" && (
        <div className="space-y-2">
          <p className="text-xs text-center" style={{ color: "hsl(var(--muted-foreground))" }}>اختر رقماً من 1 إلى 10 - الأعلى يفوز! 🎯</p>
          <div className="grid grid-cols-5 gap-1.5">
            {numbers.map(n => (
              <button key={n} onClick={() => handlePick(n)}
                className="aspect-square rounded-xl flex items-center justify-center text-sm font-bold transition-all hover:scale-110 active:scale-90"
                style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}>
                {n}
              </button>
            ))}
          </div>
        </div>
      )}

      {status === "active" && isParticipant && myNum !== "-" && (
        <div className="text-center py-4">
          <span className="text-3xl font-black mb-2 block" style={{ color: "hsl(var(--primary))" }}>{myNum}</span>
          <span className="text-xs animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>بانتظار الخصم... ⏳</span>
        </div>
      )}

      {status === "pending" && canAccept && (
        <button onClick={handleAccept} className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>قبول التحدي 🔢</button>
      )}
      {status === "pending" && playerX === currentUserId && (
        <div className="text-center py-2"><span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>بانتظار قبول الخصم... ⏳</span></div>
      )}

      {status === "finished" && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-4 py-2">
            <div className="text-center">
              <span className="text-2xl font-black block" style={{ color: "hsl(199, 89%, 55%)" }}>{p1Num}</span>
              <span className="text-xs" style={{ color: getUserColor(getProfile(playerX).username) }}>{playerX === currentUserId ? "أنت" : getProfile(playerX).username}</span>
            </div>
            <span className="text-xs font-bold" style={{ color: "hsl(var(--muted-foreground))" }}>ضد</span>
            <div className="text-center">
              <span className="text-2xl font-black block" style={{ color: "hsl(0, 72%, 60%)" }}>{p2Num}</span>
              <span className="text-xs" style={{ color: playerO ? getUserColor(getProfile(playerO).username) : "hsl(var(--muted-foreground))" }}>{playerO === currentUserId ? "أنت" : playerO ? getProfile(playerO).username : ""}</span>
            </div>
          </div>
          <div className="flex items-center justify-center gap-2 py-2 rounded-xl" style={{ background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.2)" }}>
            {winner === "draw" ? (
              <><Handshake className="w-4 h-4" style={{ color: "hsl(var(--chat-admin))" }} /><span className="text-sm font-bold" style={{ color: "hsl(var(--chat-admin))" }}>تعادل! 🤝</span></>
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

export default NumberBattle;
