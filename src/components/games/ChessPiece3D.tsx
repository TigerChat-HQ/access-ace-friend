import type { Color, PieceSymbol } from "chess.js";

const shapes: Record<PieceSymbol, string> = {
  k: "M50 9v17 M41 17h18 M31 82h38l-5-10H36z M36 70h28l-4-12H40z M40 57c-8-8-7-17 0-23 6-5 14-5 20 0 7 6 8 15 0 23z",
  q: "M28 77h44l-5-10H33z M34 66h32l-4-12H38z M38 53l-14-27 17 14 9-23 9 23 17-14-14 27z",
  r: "M30 79h40l-5-11H35z M35 68h30V39H35z M31 39V23h9v8h7v-8h7v8h7v-8h8v16z",
  b: "M30 80h40l-5-11H35z M35 69h30l-5-13H40z M50 18c-16 13-17 26 0 39 17-13 16-26 0-39z M46 29l8 10",
  n: "M29 79h43l-5-11H34z M35 68h31l-3-13H39z M38 55l-8-15 9-20 20 8 7 19-10 8z M49 34l6 2",
  p: "M32 80h36l-5-10H37z M37 70h26l-4-13H41z M50 20c-10 0-15 8-12 17 2 7 8 10 12 10s10-3 12-10c3-9-2-17-12-17z",
};

export function ChessPiece3D({ color, type, className = "" }: { color: Color; type: PieceSymbol; className?: string }) {
  const light = color === "w";
  const id = `chess-${color}-${type}`;
  return (
    <svg viewBox="0 0 100 100" role="img" aria-label={`${light ? "White" : "Black"} ${type}`} className={`h-[88%] w-[88%] overflow-visible select-none ${className}`} aria-hidden="false">
      <defs>
        <linearGradient id={`${id}-body`} x1="0" y1="0" x2="1" y2="1">
          {light ? <><stop offset="0" stopColor="#ffffff"/><stop offset=".28" stopColor="#f8edcf"/><stop offset=".62" stopColor="#c7a96b"/><stop offset="1" stopColor="#76562d"/></> : <><stop offset="0" stopColor="#8796a8"/><stop offset=".22" stopColor="#303b4b"/><stop offset=".62" stopColor="#111923"/><stop offset="1" stopColor="#02060c"/></>}
        </linearGradient>
        <linearGradient id={`${id}-edge`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={light ? "#fff9e8" : "#aab7c8"}/>
          <stop offset="1" stopColor={light ? "#8d6b37" : "#05080d"}/>
        </linearGradient>
        <radialGradient id={`${id}-shine`} cx=".28" cy=".18" r=".8">
          <stop offset="0" stopColor="#fff" stopOpacity=".82"/>
          <stop offset=".34" stopColor="#fff" stopOpacity=".16"/>
          <stop offset="1" stopColor="#fff" stopOpacity="0"/>
        </radialGradient>
        <filter id={`${id}-shadow`} x="-40%" y="-30%" width="180%" height="190%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="3" result="blur"/>
          <feOffset dy="4" dx="1" result="offset"/>
          <feComponentTransfer><feFuncA type="linear" slope=".58"/></feComponentTransfer>
          <feMerge><feMergeNode/><feMergeNode in="SourceGraphic"/></feMerge>
        </filter>
      </defs>
      <ellipse cx="51" cy="87" rx="27" ry="5" fill="#000" opacity=".36"/>
      <g filter={`url(#${id}-shadow)`}>
        <path d={shapes[type]} fill={`url(#${id}-body)`} stroke={`url(#${id}-edge)`} strokeWidth="2.5" strokeLinejoin="round"/>
        <path d={shapes[type]} fill={`url(#${id}-shine)`} opacity=".82"/>
        <path d="M34 80h32" stroke={light ? "#fff8dc" : "#b7c4d5"} strokeOpacity=".7" strokeWidth="1.4" strokeLinecap="round"/>
      </g>
    </svg>
  );
}
