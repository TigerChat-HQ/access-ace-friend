import angryTiger from "@/assets/angry-tiger-bg.png";

export const TigerChatBackground = () => (
  <div className="absolute inset-0 pointer-events-none overflow-hidden z-0 bg-gradient-to-b from-transparent via-primary/[0.01] to-transparent">
    {/* Subtle animated tiger watermark */}
    <div className="absolute inset-0 flex items-center justify-center">
      <img
        src={angryTiger}
        alt="Tanzanian Draft Game Logo Watermark"
        className="w-72 h-72 opacity-[0.04] animate-tiger-breathe select-none"
        width={512}
        height={512}
        loading="lazy"
        draggable={false}
      />
    </div>
    {/* Floating particle effects */}
    <div className="absolute top-1/4 left-1/4 w-1 h-1 bg-primary/10 rounded-full animate-float-1" />
    <div className="absolute top-1/3 right-1/3 w-1.5 h-1.5 bg-primary/8 rounded-full animate-float-2" />
    <div className="absolute bottom-1/4 left-1/3 w-1 h-1 bg-accent/10 rounded-full animate-float-3" />
    <div className="absolute top-1/2 right-1/4 w-2 h-2 bg-primary/5 rounded-full animate-pulse blur-sm" />
  </div>
);
