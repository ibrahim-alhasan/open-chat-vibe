import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw, Trophy, Handshake } from "lucide-react";

interface MathChallengeProps {
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

// Board: "num1+num2=answer:p1ans:p2ans:p1time:p2time"
const generateProblem = () => {
  const ops = ["+", "-", "×"];
  const op = ops[Math.floor(Math.random() * ops.length)];
  let a: number, b: number, answer: number;
  if (op === "+") { a = Math.floor(Math.random() * 50) + 10; b = Math.floor(Math.random() * 50) + 10; answer = a + b; }
  else if (op === "-") { a = Math.floor(Math.random() * 50) + 30; b = Math.floor(Math.random() * 30) + 1; answer = a - b; }
  else { a = Math.floor(Math.random() * 12) + 2; b = Math.floor(Math.random() * 12) + 2; answer = a * b; }
  return { question: `${a} ${op} ${b}`, answer };
};

const MathChallenge = ({ gameId, currentUserId, profilesMap }: MathChallengeProps) => {
  const [playerX, setPlayerX] = useState("");
  const [playerO, setPlayerO] = useState<string | null>(null);
  const [board, setBoard] = useState("");
  const [status, setStatus] = useState("pending");
  const [winner, setWinner] = useState<string | null>(null);
  const [inputVal, setInputVal] = useState("");
  const [startTime] = useState(Date.now());

  const getProfile = (uid: string) => profilesMap[uid] || { username: uid.slice(0, 6), avatar_url: null };

  const loadGame = useCallback(async () => {
    const { data } = await supabase.from("games").select("*").eq("id", gameId).single();
    if (data) { setBoard(data.board); setPlayerX(data.player_x); setPlayerO(data.player_o); setStatus(data.status); setWinner(data.winner); }
  }, [gameId]);

  useEffect(() => { loadGame(); }, [loadGame]);

  useEffect(() => {
    const channel = supabase.channel(`game-mc-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        const d = payload.new as any;
        setBoard(d.board); setPlayerX(d.player_x); setPlayerO(d.player_o); setStatus(d.status); setWinner(d.winner);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  const handleAccept = async () => {
    // Generate a math problem when accepting
    const { question, answer } = generateProblem();
    const newBoard = `${question}=${answer}:-:-:-:-`;
    await supabase.from("games").update({ player_o: currentUserId, status: "active", board: newBoard, updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  // Parse board
  const boardParts = board.split(":");
  const problemPart = boardParts[0] || "";
  const p1Ans = boardParts[1] || "-";
  const p2Ans = boardParts[2] || "-";
  const p1Time = boardParts[3] || "-";
  const p2Time = boardParts[4] || "-";

  const [questionStr, correctAnsStr] = problemPart.split("=");
  const correctAnswer = parseInt(correctAnsStr);

  const isParticipant = currentUserId === playerX || currentUserId === playerO;
  const myAns = currentUserId === playerX ? p1Ans : p2Ans;
  const canAccept = status === "pending" && !isParticipant;

  const handleSubmit = async () => {
    if (status !== "active" || !isParticipant || myAns !== "-" || !inputVal.trim()) return;
    const elapsed = ((Date.now() - startTime) / 1000).toFixed(1);
    const isP1 = currentUserId === playerX;
    const newP1Ans = isP1 ? inputVal : p1Ans;
    const newP2Ans = isP1 ? p2Ans : inputVal;
    const newP1Time = isP1 ? elapsed : p1Time;
    const newP2Time = isP1 ? p2Time : elapsed;

    let gameWinner: string | null = null;
    let gameStatus = "active";

    if (newP1Ans !== "-" && newP2Ans !== "-") {
      gameStatus = "finished";
      const p1Correct = parseInt(newP1Ans) === correctAnswer;
      const p2Correct = parseInt(newP2Ans) === correctAnswer;
      if (p1Correct && p2Correct) {
        // Both correct - faster wins
        gameWinner = parseFloat(newP1Time) <= parseFloat(newP2Time) ? playerX : playerO;
      } else if (p1Correct) gameWinner = playerX;
      else if (p2Correct) gameWinner = playerO;
      else gameWinner = "draw"; // both wrong
    }

    const newBoard = `${problemPart}:${newP1Ans}:${newP2Ans}:${newP1Time}:${newP2Time}`;
    await supabase.from("games").update({ board: newBoard, winner: gameWinner, status: gameStatus, updated_at: new Date().toISOString() }).eq("id", gameId);
    setInputVal("");
  };

  const handleRematch = async () => {
    const { question, answer } = generateProblem();
    const newBoard = `${question}=${answer}:-:-:-:-`;
    await supabase.from("games").update({ board: newBoard, player_x: playerO || currentUserId, player_o: playerX, status: "active", winner: null, updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  return (
    <div className="rounded-2xl p-3 sm:p-4 max-w-[280px] w-full animate-fade-in" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center gap-2 mb-3">
        <span className="text-lg">🧮</span>
        <span className="text-xs font-bold" style={{ color: "hsl(var(--foreground))" }}>تحدي الرياضيات</span>
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

      {status === "active" && questionStr && (
        <div className="text-center mb-3 py-3 rounded-xl" style={{ background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.2)" }}>
          <span className="text-2xl font-black" style={{ color: "hsl(var(--foreground))" }}>{questionStr} = ?</span>
        </div>
      )}

      {status === "active" && isParticipant && myAns === "-" && (
        <div className="flex gap-2">
          <input type="number" value={inputVal} onChange={e => setInputVal(e.target.value)}
            onKeyDown={e => e.key === "Enter" && handleSubmit()}
            placeholder="الجواب..."
            className="flex-1 px-3 py-2 rounded-xl text-sm text-center outline-none"
            style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
            autoFocus />
          <button onClick={handleSubmit} className="px-4 py-2 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95"
            style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>إرسال</button>
        </div>
      )}

      {status === "active" && isParticipant && myAns !== "-" && (
        <div className="text-center py-3">
          <span className="text-xl font-bold block" style={{ color: "hsl(var(--primary))" }}>{myAns}</span>
          <span className="text-xs animate-pulse" style={{ color: "hsl(var(--muted-foreground))" }}>بانتظار الخصم... ⏳</span>
        </div>
      )}

      {status === "pending" && canAccept && (
        <button onClick={handleAccept} className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>قبول التحدي 🧮</button>
      )}
      {status === "pending" && playerX === currentUserId && (
        <div className="text-center py-2"><span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>بانتظار قبول الخصم... ⏳</span></div>
      )}

      {status === "finished" && (
        <div className="space-y-2">
          {questionStr && (
            <div className="text-center py-1">
              <span className="text-sm" style={{ color: "hsl(var(--muted-foreground))" }}>{questionStr} = <strong style={{ color: "hsl(var(--primary))" }}>{correctAnsStr}</strong></span>
            </div>
          )}
          <div className="flex items-center justify-around py-2">
            <div className="text-center">
              <span className="text-xs block" style={{ color: getUserColor(getProfile(playerX).username) }}>{playerX === currentUserId ? "أنت" : getProfile(playerX).username}</span>
              <span className={`text-lg font-bold block ${parseInt(p1Ans) === correctAnswer ? "" : "line-through"}`}
                style={{ color: parseInt(p1Ans) === correctAnswer ? "hsl(142, 71%, 45%)" : "hsl(var(--destructive))" }}>{p1Ans}</span>
              {p1Time !== "-" && <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{p1Time}ث</span>}
            </div>
            <div className="text-center">
              <span className="text-xs block" style={{ color: playerO ? getUserColor(getProfile(playerO).username) : "hsl(var(--muted-foreground))" }}>{playerO === currentUserId ? "أنت" : playerO ? getProfile(playerO).username : ""}</span>
              <span className={`text-lg font-bold block ${parseInt(p2Ans) === correctAnswer ? "" : "line-through"}`}
                style={{ color: parseInt(p2Ans) === correctAnswer ? "hsl(142, 71%, 45%)" : "hsl(var(--destructive))" }}>{p2Ans}</span>
              {p2Time !== "-" && <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>{p2Time}ث</span>}
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

export default MathChallenge;
