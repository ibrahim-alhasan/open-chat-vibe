import { useState } from "react";
import { X, Plus, BarChart3, Send } from "lucide-react";

interface PollCreatorProps {
  onCreatePoll: (question: string, options: string[]) => void;
  onClose: () => void;
}

const PollCreator = ({ onCreatePoll, onClose }: PollCreatorProps) => {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState(["", ""]);

  const addOption = () => {
    if (options.length < 6) setOptions([...options, ""]);
  };

  const removeOption = (index: number) => {
    if (options.length > 2) setOptions(options.filter((_, i) => i !== index));
  };

  const handleSubmit = () => {
    const q = question.trim();
    const opts = options.map(o => o.trim()).filter(o => o);
    if (!q || opts.length < 2) return;
    onCreatePoll(q, opts);
  };

  const isValid = question.trim() && options.filter(o => o.trim()).length >= 2;

  return (
    <div className="rounded-xl p-3 space-y-3 animate-fade-in" style={{ background: "hsl(var(--card))", border: "1px solid hsl(var(--border))" }}>
      <div className="flex items-center justify-between">
        <button onClick={onClose} className="p-1 rounded-full hover:opacity-70">
          <X className="w-4 h-4" style={{ color: "hsl(var(--muted-foreground))" }} />
        </button>
        <div className="flex items-center gap-1.5">
          <BarChart3 className="w-4 h-4" style={{ color: "hsl(var(--primary))" }} />
          <span className="text-[13px] font-semibold" style={{ color: "hsl(var(--foreground))" }}>إنشاء استطلاع رأي</span>
        </div>
      </div>

      <input
        type="text"
        value={question}
        onChange={e => setQuestion(e.target.value)}
        placeholder="اكتب سؤالك..."
        maxLength={200}
        className="w-full px-3 py-2 rounded-lg text-[13px] outline-none text-right"
        style={{ background: "hsl(var(--secondary))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
        autoFocus
      />

      <div className="space-y-1.5">
        {options.map((opt, i) => (
          <div key={i} className="flex items-center gap-1.5">
            {options.length > 2 && (
              <button onClick={() => removeOption(i)} className="p-0.5 rounded hover:opacity-70">
                <X className="w-3.5 h-3.5" style={{ color: "hsl(var(--destructive))" }} />
              </button>
            )}
            <input
              type="text"
              value={opt}
              onChange={e => {
                const newOpts = [...options];
                newOpts[i] = e.target.value;
                setOptions(newOpts);
              }}
              placeholder={`الخيار ${i + 1}`}
              maxLength={100}
              className="flex-1 px-3 py-1.5 rounded-lg text-[12px] outline-none text-right"
              style={{ background: "hsl(var(--input))", border: "1px solid hsl(var(--border))", color: "hsl(var(--foreground))" }}
            />
          </div>
        ))}
      </div>

      <div className="flex items-center justify-between">
        {options.length < 6 && (
          <button onClick={addOption} className="flex items-center gap-1 text-[11px] px-2 py-1 rounded-lg hover:opacity-80"
            style={{ color: "hsl(var(--primary))", background: "hsl(var(--primary) / 0.1)" }}>
            <Plus className="w-3 h-3" />
            إضافة خيار
          </button>
        )}
        <button
          onClick={handleSubmit}
          disabled={!isValid}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[12px] font-medium transition-all active:scale-95 disabled:opacity-40"
          style={{ background: "hsl(var(--primary))", color: "hsl(var(--primary-foreground))" }}>
          <Send className="w-3.5 h-3.5" />
          إرسال
        </button>
      </div>
    </div>
  );
};

export default PollCreator;
