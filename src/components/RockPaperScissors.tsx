import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw, Trophy, Handshake } from "lucide-react";

interface RPSProps {
  gameId: string;
  currentUserId: string;
  profilesMap: Record<string, { username: string; avatar_url: string | null }>;
}

const CHOICES = [
  { id: "rock", emoji: "🪨", label: "حجر" },
  { id: "paper", emoji: "📄", label: "ورقة" },
  { id: "scissors", emoji: "✂️", label: "مقص" },
];

const getWinner = (c1: string, c2: string): "p1" | "p2" | "draw" => {
  if (c1 === c2) return "draw";
  if ((c1 === "rock" && c2 === "scissors") || (c1 === "scissors" && c2 === "paper") || (c1 === "paper" && c2 === "rock")) return "p1";
  return "p2";
};

const getUserColor = (username: string) => {
  const colors = ["hsl(199, 89%, 55%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 55%)", "hsl(280, 65%, 60%)", "hsl(0, 72%, 60%)", "hsl(32, 98%, 55%)"];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const RockPaperScissors = ({ gameId, currentUserId, profilesMap }: RPSProps) => {
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
    const channel = supabase.channel(`game-rps-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        const d = payload.new as any;
        setBoard(d.board); setPlayerX(d.player_x); setPlayerO(d.player_o); setStatus(d.status); setWinner(d.winner);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  const handleAccept = async () => {
    await supabase.from("games").update({ player_o: currentUserId, status: "active", updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const [p1Choice, p2Choice] = board.split(":");
  const myChoice = currentUserId === playerX ? p1Choice : p2Choice;
  const isParticipant = currentUserId === playerX || currentUserId === playerO;
  const canAccept = status === "pending" && !isParticipant;

  const handleChoice = async (choice: string) => {
    if (status !== "active" || !isParticipant || myChoice !== "-") return;
    const isP1 = currentUserId === playerX;
    const newP1 = isP1 ? choice : p1Choice;
    const newP2 = isP1 ? p2Choice : choice;
    const newBoard = `${newP1}:${newP2}`;

    let gameWinner: string | null = null;
    let gameStatus = "active";

    if (newP1 !== "-" && newP2 !== "-") {
      const result = getWinner(newP1, newP2);
      gameStatus = "finished";
      gameWinner = result === "draw" ? "draw" : result === "p1" ? playerX : playerO;
    }

    await supabase.from("games").update({ board: newBoard, winner: gameWinner, status: gameStatus, updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const handleRematch = async () => {
    await supabase.from("games").update({ board: "-:-", player_x: playerO || currentUserId, player_o: playerX, status: "active", winner: null, updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const choiceEmoji = (c: string) => CHOICES.find(ch => ch.id === c)?.emoji || "❓";

  return (
    <div className="rounded-2xl p-3 sm:p-4 max-w-[280px] w-full animate-fade-in" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">✊</span>
        <span className="text-xs font-bold" style={{ color: "hsl(var(--foreground))" }}>حجر ورقة مقص</span>
      </div>

      {/* Players */}
      <div className="flex items-center justify-between mb-3 px-1">
        <span className="text-xs font-medium truncate max-w-[80px]" style={{ color: getUserColor(getProfile(playerX).username) }}>
          {playerX === currentUserId ? "أنت" : getProfile(playerX).username}
        </span>
        <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>ضد</span>
        <span className="text-xs font-medium truncate max-w-[80px]" style={{ color: playerO ? getUserColor(getProfile(playerO).username) : "hsl(var(--muted-foreground))" }}>
          {!playerO ? "بانتظار..." : playerO === currentUserId ? "أنت" : getProfile(playerO).username}
        </span>
      </div>

      {status === "active" && isParticipant && myChoice === "-" && (
        <div className="space-y-2">
          <p className="text-xs text-center mb-2" style={{ color: "hsl(var(--muted-foreground))" }}>اختر سلاحك! ⚡</p>
          <div className="flex gap-2 justify-center">
            {CHOICES.map(c => (
              <button key={c.id} onClick={() => handleChoice(c.id)}
                className="flex flex-col items-center gap-1 p-3 rounded-xl transition-all hover:scale-110 active:scale-90"
                style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
                <span className="text-2xl">{c.emoji}</span>
                <span className="text-xs" style={{ color: "hsl(var(--foreground))" }}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {status === "active" && isParticipant && myChoice !== "-" && (
        <div className="text-center py-4">
          <span className="text-3xl mb-2 block">{choiceEmoji(myChoice)}</span>
          <span className="text-xs animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>بانتظار الخصم... ⏳</span>
        </div>
      )}

      {status === "pending" && canAccept && (
        <button onClick={handleAccept} className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>
          قبول التحدي ✊
        </button>
      )}

      {status === "pending" && playerX === currentUserId && (
        <div className="text-center py-2"><span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>بانتظار قبول الخصم... ⏳</span></div>
      )}

      {status === "finished" && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-4 py-2">
            <span className="text-3xl">{choiceEmoji(p1Choice)}</span>
            <span className="text-xs font-bold" style={{ color: "hsl(var(--muted-foreground))" }}>ضد</span>
            <span className="text-3xl">{choiceEmoji(p2Choice)}</span>
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

export default RockPaperScissors;
