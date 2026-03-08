import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw, Trophy } from "lucide-react";

interface ColorGuessProps {
  gameId: string;
  currentUserId: string;
  profilesMap: Record<string, { username: string; avatar_url: string | null }>;
}

const COLORS = [
  { id: "red", emoji: "🔴", label: "أحمر" },
  { id: "blue", emoji: "🔵", label: "أزرق" },
  { id: "green", emoji: "🟢", label: "أخضر" },
  { id: "yellow", emoji: "🟡", label: "أصفر" },
  { id: "purple", emoji: "🟣", label: "بنفسجي" },
  { id: "orange", emoji: "🟠", label: "برتقالي" },
];

const getUserColor = (username: string) => {
  const colors = ["hsl(199, 89%, 55%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 55%)", "hsl(280, 65%, 60%)", "hsl(0, 72%, 60%)", "hsl(32, 98%, 55%)"];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

// Board format: "chosen_color:guess" - player_x picks color, player_o guesses
const ColorGuess = ({ gameId, currentUserId, profilesMap }: ColorGuessProps) => {
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
    const channel = supabase.channel(`game-cg-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        const d = payload.new as any;
        setBoard(d.board); setPlayerX(d.player_x); setPlayerO(d.player_o); setStatus(d.status); setWinner(d.winner);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  const handleAccept = async () => {
    await supabase.from("games").update({ player_o: currentUserId, status: "active", board: "-:-", updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const [chosenColor, guess] = board.split(":");
  const isParticipant = currentUserId === playerX || currentUserId === playerO;
  const canAccept = status === "pending" && !isParticipant;
  const isPicker = currentUserId === playerX;
  const isGuesser = currentUserId === playerO;

  const handlePickColor = async (colorId: string) => {
    if (status !== "active" || !isPicker || chosenColor !== "-") return;
    await supabase.from("games").update({ board: `${colorId}:-`, updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const handleGuess = async (colorId: string) => {
    if (status !== "active" || !isGuesser || guess !== "-" || chosenColor === "-") return;
    const correct = colorId === chosenColor;
    const gameWinner = correct ? playerO : playerX;
    await supabase.from("games").update({ board: `${chosenColor}:${colorId}`, winner: gameWinner, status: "finished", updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const handleRematch = async () => {
    // Swap roles
    await supabase.from("games").update({ board: "-:-", player_x: playerO || currentUserId, player_o: playerX, status: "active", winner: null, updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const getColorEmoji = (id: string) => COLORS.find(c => c.id === id)?.emoji || "❓";
  const getColorLabel = (id: string) => COLORS.find(c => c.id === id)?.label || id;

  return (
    <div className="rounded-2xl p-3 sm:p-4 max-w-[280px] w-full animate-fade-in" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🎨</span>
        <span className="text-xs font-bold" style={{ color: "hsl(var(--foreground))" }}>تخمين اللون</span>
      </div>

      <div className="flex items-center justify-between mb-2 px-1">
        <div className="text-center">
          <span className="text-xs font-medium truncate block max-w-[80px]" style={{ color: getUserColor(getProfile(playerX).username) }}>
            {playerX === currentUserId ? "أنت" : getProfile(playerX).username}
          </span>
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>يختار</span>
        </div>
        <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>ضد</span>
        <div className="text-center">
          <span className="text-xs font-medium truncate block max-w-[80px]" style={{ color: playerO ? getUserColor(getProfile(playerO).username) : "hsl(var(--muted-foreground))" }}>
            {!playerO ? "بانتظار..." : playerO === currentUserId ? "أنت" : getProfile(playerO).username}
          </span>
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>يخمّن</span>
        </div>
      </div>

      {/* Picker chooses */}
      {status === "active" && isPicker && chosenColor === "-" && (
        <div className="space-y-2">
          <p className="text-xs text-center" style={{ color: "hsl(var(--muted-foreground))" }}>اختر لوناً سرياً! 🤫</p>
          <div className="grid grid-cols-3 gap-2">
            {COLORS.map(c => (
              <button key={c.id} onClick={() => handlePickColor(c.id)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:scale-110 active:scale-90"
                style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
                <span className="text-xl">{c.emoji}</span>
                <span className="text-xs" style={{ color: "hsl(var(--foreground))" }}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Picker waiting for guesser */}
      {status === "active" && isPicker && chosenColor !== "-" && (
        <div className="text-center py-4">
          <span className="text-3xl mb-2 block">{getColorEmoji(chosenColor)}</span>
          <span className="text-xs" style={{ color: "hsl(var(--foreground))" }}>اخترت: {getColorLabel(chosenColor)}</span>
          <p className="text-xs animate-pulse mt-1" style={{ color: "hsl(var(--muted-foreground))" }}>بانتظار التخمين... ⏳</p>
        </div>
      )}

      {/* Guesser waiting for picker */}
      {status === "active" && isGuesser && chosenColor === "-" && (
        <div className="text-center py-4">
          <span className="text-3xl mb-2 block animate-pulse">🤔</span>
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>الخصم يختار لوناً... ⏳</span>
        </div>
      )}

      {/* Guesser guesses */}
      {status === "active" && isGuesser && chosenColor !== "-" && guess === "-" && (
        <div className="space-y-2">
          <p className="text-xs text-center" style={{ color: "hsl(var(--muted-foreground))" }}>خمّن اللون الذي اختاره الخصم! 🎯</p>
          <div className="grid grid-cols-3 gap-2">
            {COLORS.map(c => (
              <button key={c.id} onClick={() => handleGuess(c.id)}
                className="flex flex-col items-center gap-1 p-2 rounded-xl transition-all hover:scale-110 active:scale-90"
                style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))" }}>
                <span className="text-xl">{c.emoji}</span>
                <span className="text-xs" style={{ color: "hsl(var(--foreground))" }}>{c.label}</span>
              </button>
            ))}
          </div>
        </div>
      )}

      {status === "pending" && canAccept && (
        <button onClick={handleAccept} className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>قبول التحدي 🎨</button>
      )}
      {status === "pending" && playerX === currentUserId && (
        <div className="text-center py-2"><span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>بانتظار قبول الخصم... ⏳</span></div>
      )}

      {status === "finished" && (
        <div className="space-y-2">
          <div className="text-center py-2">
            <p className="text-xs mb-1" style={{ color: "hsl(var(--muted-foreground))" }}>اللون المختار: {getColorEmoji(chosenColor)} {getColorLabel(chosenColor)}</p>
            <p className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>التخمين: {getColorEmoji(guess)} {getColorLabel(guess)}</p>
          </div>
          <div className="flex items-center justify-center gap-2 py-2 rounded-xl" style={{ background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.2)" }}>
            {winner === currentUserId ? (
              <><Trophy className="w-4 h-4" style={{ color: "hsl(var(--chat-admin))" }} /><span className="text-sm font-bold" style={{ color: "hsl(var(--chat-admin))" }}>{isGuesser ? "أصبت! 🎉" : "لم يصب! فزت 🎉"}</span></>
            ) : (
              <span className="text-sm font-bold" style={{ color: "hsl(var(--destructive))" }}>{isGuesser ? "خطأ! 😔" : "أصاب التخمين! 😔"}</span>
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

export default ColorGuess;
