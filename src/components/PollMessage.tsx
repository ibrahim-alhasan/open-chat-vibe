import { useState, useEffect } from "react";
import { supabase } from "@/integrations/supabase/client";
import { BarChart3, Check } from "lucide-react";

interface PollMessageProps {
  pollId: string;
  question: string;
  options: string[];
  currentUserId: string;
  isActive: boolean;
}

const PollMessage = ({ pollId, question, options, currentUserId, isActive }: PollMessageProps) => {
  const [votes, setVotes] = useState<{ user_id: string; option_index: number }[]>([]);
  const [myVote, setMyVote] = useState<number | null>(null);
  const [voting, setVoting] = useState(false);

  useEffect(() => {
    const fetchVotes = async () => {
      const { data } = await supabase.from("poll_votes").select("user_id, option_index").eq("poll_id", pollId);
      if (data) {
        setVotes(data);
        const mine = data.find((v: any) => v.user_id === currentUserId);
        if (mine) setMyVote(mine.option_index);
      }
    };
    fetchVotes();

    const channel = supabase.channel(`poll-${pollId}`)
      .on("postgres_changes", { event: "*", schema: "public", table: "poll_votes", filter: `poll_id=eq.${pollId}` }, () => {
        fetchVotes();
      })
      .subscribe();

    return () => { supabase.removeChannel(channel); };
  }, [pollId, currentUserId]);

  const handleVote = async (index: number) => {
    if (!isActive || voting) return;
    setVoting(true);

    if (myVote !== null) {
      // Change vote
      await supabase.from("poll_votes").delete().eq("poll_id", pollId).eq("user_id", currentUserId);
    }

    if (myVote === index) {
      // Remove vote
      setMyVote(null);
      setVotes(prev => prev.filter(v => v.user_id !== currentUserId));
    } else {
      await supabase.from("poll_votes").insert({ poll_id: pollId, user_id: currentUserId, option_index: index });
      setMyVote(index);
    }
    setVoting(false);
  };

  const totalVotes = votes.length;
  const hasVoted = myVote !== null;

  return (
    <div className="w-full max-w-[300px] rounded-xl overflow-hidden" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
      <div className="px-3 py-2 flex items-center gap-2" style={{ background: "hsl(var(--primary) / 0.1)", borderBottom: "1px solid hsl(var(--border))" }}>
        <BarChart3 className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
        <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))", direction: "rtl" }}>{question}</span>
      </div>
      <div className="p-2 space-y-1.5">
        {options.map((option, i) => {
          const count = votes.filter(v => v.option_index === i).length;
          const pct = totalVotes > 0 ? Math.round((count / totalVotes) * 100) : 0;
          const isMyVote = myVote === i;

          return (
            <button
              key={i}
              onClick={() => handleVote(i)}
              disabled={!isActive || voting}
              className="w-full relative rounded-lg px-3 py-2 text-right transition-all hover:opacity-90 active:scale-[0.98] overflow-hidden disabled:cursor-not-allowed"
              style={{ 
                background: isMyVote ? "hsl(var(--primary) / 0.15)" : "hsl(var(--secondary))",
                border: isMyVote ? "1px solid hsl(var(--primary) / 0.4)" : "1px solid hsl(var(--border))",
              }}
            >
              {/* Progress bar */}
              {hasVoted && (
                <div 
                  className="absolute top-0 left-0 h-full transition-all duration-500 rounded-lg"
                  style={{ 
                    width: `${pct}%`, 
                    background: isMyVote ? "hsl(var(--primary) / 0.2)" : "hsl(var(--muted-foreground) / 0.1)" 
                  }} 
                />
              )}
              <div className="relative flex items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {hasVoted && <span className="text-[11px] font-medium" style={{ color: "hsl(var(--muted-foreground))" }}>{pct}%</span>}
                  {isMyVote && <Check className="w-3.5 h-3.5" style={{ color: "hsl(var(--primary))" }} />}
                </div>
                <span className="text-[12px] font-medium" style={{ color: "hsl(var(--foreground))", direction: "rtl" }}>{option}</span>
              </div>
            </button>
          );
        })}
      </div>
      <div className="px-3 py-1.5 text-center" style={{ borderTop: "1px solid hsl(var(--border))" }}>
        <span className="text-[10px]" style={{ color: "hsl(var(--muted-foreground))" }}>
          {totalVotes} صوت {!isActive && "• انتهى التصويت"}
        </span>
      </div>
    </div>
  );
};

export default PollMessage;
