import { Languages, RotateCcw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { CHAT_LANGUAGES } from "@/lib/chat-translation";

interface Props { language: string; onChange: (value: string) => void; loading: boolean; error: string; onRetry: () => void }

export function ChatTranslationControls({ language, onChange, loading, error, onRetry }: Props) {
  return <div className="border-b border-border/50 bg-card/70 px-4 py-2 space-y-1">
    <div className="flex items-center gap-2">
      <Languages className="h-4 w-4 shrink-0 text-primary" />
      <span className="text-xs text-muted-foreground shrink-0">Auto-translate</span>
      <Select value={language} onValueChange={value => {
        if (value !== "off" && language === "off" && !window.confirm("Translate incoming messages with Tiger AI? Message text will be sent to the app's AI translation service. Original messages stay unchanged.")) return;
        onChange(value);
      }}>
        <SelectTrigger aria-label="Translation language" className="h-8 min-w-0 flex-1 max-w-48 text-xs"><SelectValue /></SelectTrigger>
        <SelectContent><SelectItem value="off">Off</SelectItem>{CHAT_LANGUAGES.map(item => <SelectItem key={item.code} value={item.code}>{item.label}</SelectItem>)}</SelectContent>
      </Select>
      {loading && <span role="status" aria-label="Translating" className="h-3 w-3 shrink-0 rounded-full border-2 border-primary border-t-transparent animate-spin" />}
    </div>
    {error && <div className="flex items-center gap-2"><p role="alert" className="text-xs text-destructive flex-1">{error}</p><Button size="icon" variant="ghost" aria-label="Retry translation" title="Retry translation" onClick={onRetry}><RotateCcw className="h-4 w-4" /></Button></div>}
  </div>;
}