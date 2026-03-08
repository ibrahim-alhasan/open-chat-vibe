import { useState, useEffect, useCallback } from "react";
import { supabase } from "@/integrations/supabase/client";
import { RotateCcw, Trophy, Handshake } from "lucide-react";

interface TicTacToeProps {
  gameId: string;
  currentUserId: string;
  profilesMap: Record<string, { username: string; avatar_url: string | null }>;
}

const getUserColor = (username: string) => {
  const colors = [
    "hsl(199, 89%, 55%)", "hsl(142, 71%, 45%)", "hsl(38, 92%, 55%)",
    "hsl(280, 65%, 60%)", "hsl(0, 72%, 60%)", "hsl(32, 98%, 55%)",
  ];
  let hash = 0;
  for (let i = 0; i < username.length; i++) hash = username.charCodeAt(i) + ((hash << 5) - hash);
  return colors[Math.abs(hash) % colors.length];
};

const WINNING_LINES = [
  [0,1,2],[3,4,5],[6,7,8],
  [0,3,6],[1,4,7],[2,5,8],
  [0,4,8],[2,4,6],
];

const TicTacToe = ({ gameId, currentUserId, profilesMap }: TicTacToeProps) => {
  const [board, setBoard] = useState<string>("---------");
  const [playerX, setPlayerX] = useState<string>("");
  const [playerO, setPlayerO] = useState<string | null>(null);
  const [currentTurn, setCurrentTurn] = useState<string>("");
  const [status, setStatus] = useState<string>("pending");
  const [winner, setWinner] = useState<string | null>(null);
  const [winLine, setWinLine] = useState<number[] | null>(null);

  const getProfile = (uid: string) => profilesMap[uid] || { username: uid.slice(0, 6), avatar_url: null };

  const loadGame = useCallback(async () => {
    const { data } = await supabase.from("games").select("*").eq("id", gameId).single();
    if (data) {
      setBoard(data.board);
      setPlayerX(data.player_x);
      setPlayerO(data.player_o);
      setCurrentTurn(data.current_turn);
      setStatus(data.status);
      setWinner(data.winner);
      
      // Check winning line
      if (data.winner && data.winner !== "draw") {
        const symbol = data.winner === data.player_x ? "X" : "O";
        for (const line of WINNING_LINES) {
          if (line.every(i => data.board[i] === symbol)) {
            setWinLine(line);
            break;
          }
        }
      }
    }
  }, [gameId]);

  useEffect(() => {
    loadGame();
  }, [loadGame]);

  // Realtime subscription
  useEffect(() => {
    const channel = supabase
      .channel(`game-${gameId}`)
      .on("postgres_changes", {
        event: "UPDATE",
        schema: "public",
        table: "games",
        filter: `id=eq.${gameId}`,
      }, (payload) => {
        const data = payload.new as any;
        setBoard(data.board);
        setPlayerX(data.player_x);
        setPlayerO(data.player_o);
        setCurrentTurn(data.current_turn);
        setStatus(data.status);
        setWinner(data.winner);
        
        if (data.winner && data.winner !== "draw") {
          const symbol = data.winner === data.player_x ? "X" : "O";
          for (const line of WINNING_LINES) {
            if (line.every(i => data.board[i] === symbol)) {
              setWinLine(line);
              break;
            }
          }
        } else {
          setWinLine(null);
        }
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [gameId]);

  const handleAccept = async () => {
    await supabase.from("games").update({
      player_o: currentUserId,
      status: "active",
      updated_at: new Date().toISOString(),
    }).eq("id", gameId);
  };

  const handleCellClick = async (index: number) => {
    if (status !== "active") return;
    if (currentTurn !== currentUserId) return;
    if (board[index] !== "-") return;

    const mySymbol = currentUserId === playerX ? "X" : "O";
    const newBoard = board.slice(0, index) + mySymbol + board.slice(index + 1);
    const otherPlayer = currentUserId === playerX ? playerO : playerX;

    // Check winner
    let gameWinner: string | null = null;
    let gameStatus = "active";
    
    for (const line of WINNING_LINES) {
      if (line.every(i => newBoard[i] === mySymbol)) {
        gameWinner = currentUserId;
        gameStatus = "finished";
        setWinLine(line);
        break;
      }
    }

    if (!gameWinner && !newBoard.includes("-")) {
      gameWinner = "draw";
      gameStatus = "finished";
    }

    await supabase.from("games").update({
      board: newBoard,
      current_turn: otherPlayer || "",
      winner: gameWinner,
      status: gameStatus,
      updated_at: new Date().toISOString(),
    }).eq("id", gameId);
  };

  const handleRematch = async () => {
    // Create a new game with swapped roles
    const newPlayerX = playerO || currentUserId;
    const newPlayerO = playerX;
    
    await supabase.from("games").update({
      board: "---------",
      player_x: newPlayerX,
      player_o: newPlayerO,
      current_turn: newPlayerX,
      status: "active",
      winner: null,
      updated_at: new Date().toISOString(),
    }).eq("id", gameId);
    setWinLine(null);
  };

  const isMyTurn = currentTurn === currentUserId;
  const amPlayerX = currentUserId === playerX;
  const amPlayerO = currentUserId === playerO;
  const isParticipant = amPlayerX || amPlayerO;
  const canAccept = status === "pending" && !isParticipant && playerX !== currentUserId;

  const playerXProfile = getProfile(playerX);
  const playerOProfile = playerO ? getProfile(playerO) : null;

  const renderCell = (index: number) => {
    const cell = board[index];
    const isWinCell = winLine?.includes(index);
    
    return (
      <button
        key={index}
        onClick={() => handleCellClick(index)}
        disabled={cell !== "-" || status !== "active" || !isMyTurn || !isParticipant}
        className={`w-full aspect-square rounded-xl flex items-center justify-center text-2xl sm:text-3xl font-black transition-all
          ${cell === "-" && status === "active" && isMyTurn && isParticipant ? "hover:scale-105 active:scale-95 cursor-pointer" : "cursor-default"}
          ${isWinCell ? "animate-pulse" : ""}
        `}
        style={{
          background: isWinCell 
            ? "hsl(var(--primary) / 0.25)" 
            : cell !== "-" 
              ? "hsl(var(--secondary) / 0.8)" 
              : "hsl(var(--muted) / 0.5)",
          border: isWinCell 
            ? "2px solid hsl(var(--primary) / 0.6)" 
            : "1px solid hsl(var(--border))",
          color: cell === "X" ? "hsl(199, 89%, 55%)" : cell === "O" ? "hsl(0, 72%, 60%)" : "transparent",
        }}
      >
        {cell !== "-" ? cell : "·"}
      </button>
    );
  };

  return (
    <div 
      className="rounded-2xl p-3 sm:p-4 max-w-[280px] w-full animate-fade-in"
      style={{ 
        background: "hsl(var(--card))", 
        border: "1px solid hsl(var(--border))",
        boxShadow: "var(--shadow-card)",
      }}
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-3">
        <div className="flex items-center gap-2">
          <span className="text-lg">🎮</span>
          <span className="text-xs font-bold" style={{ color: "hsl(var(--foreground))" }}>
            إكس أو
          </span>
        </div>
        {status === "active" && isParticipant && (
          <span 
            className="text-xs px-2 py-1 rounded-full font-medium animate-pulse"
            style={{ 
              background: isMyTurn ? "hsl(var(--primary) / 0.15)" : "hsl(var(--muted))",
              color: isMyTurn ? "hsl(var(--primary))" : "hsl(var(--muted-foreground))",
            }}
          >
            {isMyTurn ? "دورك ⚡" : "دور الخصم..."}
          </span>
        )}
      </div>

      {/* Players */}
      <div className="flex items-center justify-between mb-3 px-1">
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-black" style={{ color: "hsl(199, 89%, 55%)" }}>X</span>
          <span className="text-xs font-medium truncate max-w-[60px]" style={{ color: getUserColor(playerXProfile.username) }}>
            {playerX === currentUserId ? "أنت" : playerXProfile.username}
          </span>
        </div>
        <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>ضد</span>
        <div className="flex items-center gap-1.5">
          <span className="text-sm font-black" style={{ color: "hsl(0, 72%, 60%)" }}>O</span>
          <span className="text-xs font-medium truncate max-w-[60px]" style={{ color: playerOProfile ? getUserColor(playerOProfile.username) : "hsl(var(--muted-foreground))" }}>
            {!playerO ? "بانتظار..." : playerO === currentUserId ? "أنت" : playerOProfile?.username}
          </span>
        </div>
      </div>

      {/* Board */}
      <div className="grid grid-cols-3 gap-1.5 mb-3">
        {Array.from({ length: 9 }, (_, i) => renderCell(i))}
      </div>

      {/* Status */}
      {status === "pending" && canAccept && (
        <button
          onClick={handleAccept}
          className="w-full py-2.5 rounded-xl text-sm font-bold transition-all hover:scale-[1.02] active:scale-95"
          style={{ background: "var(--gradient-primary)", color: "hsl(var(--primary-foreground))" }}
        >
          قبول التحدي 🎯
        </button>
      )}

      {status === "pending" && playerX === currentUserId && (
        <div className="text-center py-2">
          <span className="text-xs" style={{ color: "hsl(var(--muted-foreground))" }}>
            بانتظار قبول الخصم... ⏳
          </span>
        </div>
      )}

      {status === "finished" && (
        <div className="space-y-2">
          <div className="flex items-center justify-center gap-2 py-2 rounded-xl"
            style={{ background: "hsl(var(--primary) / 0.1)", border: "1px solid hsl(var(--primary) / 0.2)" }}>
            {winner === "draw" ? (
              <>
                <Handshake className="w-4 h-4" style={{ color: "hsl(var(--chat-admin))" }} />
                <span className="text-sm font-bold" style={{ color: "hsl(var(--chat-admin))" }}>تعادل! 🤝</span>
              </>
            ) : winner === currentUserId ? (
              <>
                <Trophy className="w-4 h-4" style={{ color: "hsl(var(--chat-admin))" }} />
                <span className="text-sm font-bold" style={{ color: "hsl(var(--chat-admin))" }}>فزت! 🎉</span>
              </>
            ) : (
              <>
                <span className="text-sm font-bold" style={{ color: "hsl(var(--destructive))" }}>
                  خسرت 😔 - فاز {winner ? getProfile(winner).username : ""}
                </span>
              </>
            )}
          </div>
          
          {isParticipant && (
            <button
              onClick={handleRematch}
              className="w-full py-2 rounded-xl text-xs font-bold flex items-center justify-center gap-2 transition-all hover:scale-[1.02] active:scale-95"
              style={{ background: "hsl(var(--secondary))", color: "hsl(var(--foreground))", border: "1px solid hsl(var(--border))" }}
            >
              <RotateCcw className="w-3.5 h-3.5" />
              إعادة اللعب
            </button>
          )}
        </div>
      )}
    </div>
  );
};

export default TicTacToe;
