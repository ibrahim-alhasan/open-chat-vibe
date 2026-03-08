import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw, Trophy, Handshake } from "lucide-react";

interface ConnectFourProps {
  gameId: string;
  currentUserId: string;
  profilesMap: Record<string, { username: string; avatar_url: string | null }>;
}

const ROWS = 6, COLS = 7;
const EMPTY_BOARD = "-".repeat(ROWS * COLS);

const getUserColor = (username: string) => {
  const colors = ["hsl(199, 89%, 55%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 55%)", "hsl(280, 65%, 60%)", "hsl(0, 72%, 60%)", "hsl(32, 98%, 55%)"];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const checkWin = (board: string, symbol: string): number[] | null => {
  const get = (r: number, c: number) => (r >= 0 && r < ROWS && c >= 0 && c < COLS) ? board[r * COLS + c] : null;
  const dirs = [[0,1],[1,0],[1,1],[1,-1]];
  for (let r = 0; r < ROWS; r++) {
    for (let c = 0; c < COLS; c++) {
      if (get(r, c) !== symbol) continue;
      for (const [dr, dc] of dirs) {
        const cells = [r * COLS + c];
        let ok = true;
        for (let k = 1; k < 4; k++) {
          if (get(r + dr * k, c + dc * k) !== symbol) { ok = false; break; }
          cells.push((r + dr * k) * COLS + (c + dc * k));
        }
        if (ok) return cells;
      }
    }
  }
  return null;
};

const ConnectFour = ({ gameId, currentUserId, profilesMap }: ConnectFourProps) => {
  const [board, setBoard] = useState(EMPTY_BOARD);
  const [playerX, setPlayerX] = useState("");
  const [playerO, setPlayerO] = useState<string | null>(null);
  const [currentTurn, setCurrentTurn] = useState("");
  const [status, setStatus] = useState("pending");
  const [winner, setWinner] = useState<string | null>(null);
  const [winCells, setWinCells] = useState<number[] | null>(null);

  const getProfile = (uid: string) => profilesMap[uid] || { username: uid.slice(0, 6), avatar_url: null };

  const loadGame = useCallback(async () => {
    const { data } = await supabase.from("games").select("*").eq("id", gameId).single();
    if (data) {
      setBoard(data.board.length === ROWS * COLS ? data.board : EMPTY_BOARD);
      setPlayerX(data.player_x); setPlayerO(data.player_o); setCurrentTurn(data.current_turn); setStatus(data.status); setWinner(data.winner);
      if (data.winner && data.winner !== "draw") {
        const sym = data.winner === data.player_x ? "X" : "O";
        setWinCells(checkWin(data.board, sym));
      }
    }
  }, [gameId]);

  useEffect(() => { loadGame(); }, [loadGame]);

  useEffect(() => {
    const channel = supabase.channel(`game-c4-${gameId}`)
      .on("postgres_changes", { event: "UPDATE", schema: "public", table: "games", filter: `id=eq.${gameId}` }, (payload) => {
        const d = payload.new as any;
        setBoard(d.board); setPlayerX(d.player_x); setPlayerO(d.player_o); setCurrentTurn(d.current_turn); setStatus(d.status); setWinner(d.winner);
        if (d.winner && d.winner !== "draw") {
          const sym = d.winner === d.player_x ? "X" : "O";
          setWinCells(checkWin(d.board, sym));
        } else setWinCells(null);
      }).subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  const handleAccept = async () => {
    await supabase.from("games").update({ player_o: currentUserId, status: "active", board: EMPTY_BOARD, updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const handleDrop = async (col: number) => {
    if (status !== "active" || currentTurn !== currentUserId) return;
    // Find lowest empty row in column
    let row = -1;
    for (let r = ROWS - 1; r >= 0; r--) {
      if (board[r * COLS + col] === "-") { row = r; break; }
    }
    if (row === -1) return;

    const mySymbol = currentUserId === playerX ? "X" : "O";
    const idx = row * COLS + col;
    const newBoard = board.slice(0, idx) + mySymbol + board.slice(idx + 1);
    const otherPlayer = currentUserId === playerX ? playerO : playerX;

    const winResult = checkWin(newBoard, mySymbol);
    let gameWinner: string | null = null;
    let gameStatus = "active";

    if (winResult) { gameWinner = currentUserId; gameStatus = "finished"; setWinCells(winResult); }
    else if (!newBoard.includes("-")) { gameWinner = "draw"; gameStatus = "finished"; }

    await supabase.from("games").update({ board: newBoard, current_turn: otherPlayer || "", winner: gameWinner, status: gameStatus, updated_at: new Date().toISOString() }).eq("id", gameId);
  };

  const handleRematch = async () => {
    await supabase.from("games").update({ board: EMPTY_BOARD, player_x: playerO || currentUserId, player_o: playerX, current_turn: playerO || currentUserId, status: "active", winner: null, updated_at: new Date().toISOString() }).eq("id", gameId);
    setWinCells(null);
  };

  const isMyTurn = currentTurn === currentUserId;
  const isParticipant = currentUserId === playerX || currentUserId === playerO;
  const canAccept = status === "pending" && !isParticipant;

  return (
    <div className="rounded-2xl p-3 sm:p-4 max-w-[300px] w-full animate-fade-in" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))", boxShadow: "var(--shadow-card)" }}>
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🔴</span>
          <span className="text-xs font-bold" style={{ color: "hsl(var(--foreground))" }}>أربعة في صف</span>
        </div>
        {status === "active" && isParticipant && (
          <span className="text-xs px-2 py-1 rounded-full font-medium animate-pulse" style={{ background: isMyTurn ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted))", color: isMyTurn ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))" }}>
            {isMyTurn ? "دورك ⚡" : "دور الخصم..."}
          </span>
        )}
      </div>

      <div className="flex items-center justify-between mb-2 px-1">
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ background: "hsl(199, 89%, 55%)" }} />
          <span className="text-xs font-medium truncate max-w-[60px]" style={{ color: getUserColor(getProfile(playerX).username) }}>
            {playerX === currentUserId ? "أنت" : getProfile(playerX).username}
          </span>
        </div>
        <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>ضد</span>
        <div className="flex items-center gap-1">
          <div className="w-3 h-3 rounded-full" style={{ background: "hsl(0, 72%, 60%)" }} />
          <span className="text-xs font-medium truncate max-w-[60px]" style={{ color: playerO ? getUserColor(getProfile(playerO).username) : "hsl(var(--muted-foreground))" }}>
            {!playerO ? "بانتظار..." : playerO === currentUserId ? "أنت" : getProfile(playerO).username}
          </span>
        </div>
      </div>

      {/* Board */}
      <div className="rounded-xl p-1.5 mb-3" style={{ background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--border))" }}>
        {/* Column buttons */}
        {status === "active" && isMyTurn && isParticipant && (
          <div className="grid grid-cols-7 gap-0.5 mb-1">
            {Array.from({ length: COLS }, (_, c) => (
              <button key={c} onClick={() => handleDrop(c)} disabled={board[c] !== "-"}
                className="text-xs py-0.5 rounded transition-all hover:scale-105 active:scale-95 disabled:opacity-20"
                style={{ background: "hsl(var(--primary) / 0.2)", color: "hsl(var(--primary))" }}>▼</button>
            ))}
          </div>
        )}
        <div className="grid grid-cols-7 gap-0.5">
          {Array.from({ length: ROWS * COLS }, (_, i) => {
            const cell = board[i];
            const isWin = winCells?.includes(i);
            return (
              <div key={i} className={`aspect-square rounded-full flex items-center justify-center ${isWin ? "animate-pulse" : ""}`}
                style={{
                  background: cell === "X" ? "hsl(199, 89%, 55%)" : cell === "O" ? "hsl(0, 72%, 60%)" : "hsl(var(--muted) / 0.5)",
                  border: isWin ? "2px solid hsl(var(--primary))" : "1px solid hsl(var(--border) / 0.3)",
                  width: "100%",
                }} />
            );
          })}
        </div>
      </div>

      {status === "pending" && canAccept && (
        <button onClick={handleAccept} className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95" style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}>قبول التحدي 🔴</button>
      )}
      {status === "pending" && playerX === currentUserId && (
        <div className="text-center py-2"><span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>بانتظار قبول الخصم... ⏳</span></div>
      )}
      {status === "finished" && (
        <div className="space-y-2">
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

export default ConnectFour;
