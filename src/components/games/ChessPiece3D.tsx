import { useId } from "react";
import type { Color, PieceSymbol } from "chess.js";

export function ChessPiece3D({
  color,
  type,
  className = "",
}: {
  color: Color;
  type: PieceSymbol;
  className?: string;
}) {
  const gold = color === "w";
  const uid = useId().replace(/:/g, "");
  const id = `piece-${uid}`;
  const metal = gold
    ? ["#fff6c9", "#e7bd55", "#a66a17", "#fff0a0", "#70420c"]
    : ["#ffffff", "#cbd3dc", "#7b8794", "#eef3f8", "#48525e"];
  const body = `${id}-body`;
  const edge = `${id}-edge`;
  const shine = `${id}-shine`;
  const shadow = `${id}-shadow`;

  return (
    <svg
      viewBox="0 0 100 112"
      role="img"
      aria-label={`${gold ? "Gold" : "Silver"} ${({ k: "king", q: "queen", r: "rook", b: "bishop", n: "knight", p: "pawn" })[type]}`}
      className={`h-[92%] w-[92%] select-none overflow-visible ${className}`}
      xmlns="http://www.w3.org/2000/svg"
    >
      <defs>
        <linearGradient id={body} x1="0" y1="0" x2="1" y2="0.2">
          <stop offset="0" stopColor={metal[0]} />
          <stop offset=".18" stopColor={metal[1]} />
          <stop offset=".43" stopColor={metal[2]} />
          <stop offset=".68" stopColor={metal[3]} />
          <stop offset="1" stopColor={metal[4]} />
        </linearGradient>
        <linearGradient id={edge} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0" stopColor={metal[0]} />
          <stop offset=".45" stopColor={metal[2]} />
          <stop offset="1" stopColor={metal[4]} />
        </linearGradient>
        <radialGradient id={shine} cx=".24" cy=".12" r=".82">
          <stop offset="0" stopColor="#fff" stopOpacity=".95" />
          <stop offset=".24" stopColor="#fff" stopOpacity=".38" />
          <stop offset=".72" stopColor="#fff" stopOpacity=".04" />
          <stop offset="1" stopColor="#fff" stopOpacity="0" />
        </radialGradient>
        <filter id={shadow} x="-35%" y="-25%" width="170%" height="175%">
          <feGaussianBlur in="SourceAlpha" stdDeviation="2.2" />
          <feOffset dx="1.2" dy="3.2" />
          <feComponentTransfer><feFuncA type="linear" slope=".48" /></feComponentTransfer>
          <feMerge><feMergeNode /><feMergeNode in="SourceGraphic" /></feMerge>
        </filter>
      </defs>

      <ellipse cx="51" cy="105" rx="25" ry="4.5" fill="#000" opacity=".36" />
      <g filter={`url(#${shadow})`} strokeLinejoin="round">
        {/* Turned, stepped pedestal shared by all six pieces */}
        <path d="M24 98 Q25 94 31 93 L69 93 Q75 94 76 98 L73 103 Q50 109 27 103Z" fill={`url(#${edge})`} stroke={metal[4]} strokeWidth="1.2" />
        <path d="M28 93 Q29 88 35 87 L65 87 Q71 88 72 93 L68 97 Q50 101 32 97Z" fill={`url(#${body})`} stroke={metal[4]} strokeWidth="1" />
        <path d="M34 86 Q36 82 41 81 L59 81 Q64 82 66 86 L63 90 Q50 94 37 90Z" fill={`url(#${edge})`} stroke={metal[4]} strokeWidth=".8" />

        {type === "k" && <>
          <path d="M39 81 Q40 73 43 66 L43 49 Q38 44 39 36 Q40 28 48 25 L48 12 L44 12 L44 8 L48 8 L48 3 L52 3 L52 8 L56 8 L56 12 L52 12 L52 25 Q61 28 62 36 Q63 44 57 49 L57 66 Q60 73 61 81Z" fill={`url(#${body})`} stroke={metal[4]} strokeWidth="1.4" />
          <path d="M43 65 Q50 69 57 65 M42 49 Q50 54 58 49 M41 38 Q50 44 59 38" fill="none" stroke={metal[0]} strokeOpacity=".78" strokeWidth="1.5" />
          <path d="M50 17 V24 M44 34 Q50 30 56 34" fill="none" stroke={metal[0]} strokeWidth="1.3" />
        </>}
        {type === "q" && <>
          <path d="M39 81 Q41 72 43 65 L38 49 L30 31 L43 42 L50 19 L57 42 L70 31 L62 50 L57 65 Q59 73 61 81Z" fill={`url(#${body})`} stroke={metal[4]} strokeWidth="1.4" />
          <path d="M30 31 Q25 25 29 21 Q34 18 37 25 L43 42 L47 18 Q43 11 50 8 Q57 11 53 18 L57 42 L64 25 Q68 18 72 22 Q76 27 70 31" fill={`url(#${edge})`} stroke={metal[4]} strokeWidth="1.2" />
          <circle cx="29" cy="21" r="3.3" fill={metal[0]} stroke={metal[4]} />
          <circle cx="50" cy="8" r="3.3" fill={metal[0]} stroke={metal[4]} />
          <circle cx="72" cy="22" r="3.3" fill={metal[0]} stroke={metal[4]} />
          <path d="M41 58 Q50 63 59 58 M44 47 L50 53 L56 47" fill="none" stroke={metal[0]} strokeWidth="1.2" />
        </>}
        {type === "r" && <>
          <path d="M37 81 L39 67 L39 38 L34 34 L34 18 L42 18 L42 25 L47 25 L47 18 L53 18 L53 25 L58 25 L58 18 L66 18 L66 34 L61 38 L61 67 L63 81Z" fill={`url(#${body})`} stroke={metal[4]} strokeWidth="1.4" />
          <path d="M36 35 H64 M40 43 H60 M40 67 H60 M37 76 H63" fill="none" stroke={metal[0]} strokeOpacity=".8" strokeWidth="1.5" />
          <path d="M43 39 V63 M50 39 V64 M57 39 V63" stroke={metal[4]} strokeOpacity=".55" strokeWidth="1" />
        </>}
        {type === "b" && <>
          <path d="M39 81 Q42 71 43 63 Q31 50 39 35 Q44 25 50 19 Q56 25 61 35 Q69 50 57 63 Q58 72 61 81Z" fill={`url(#${body})`} stroke={metal[4]} strokeWidth="1.4" />
          <path d="M50 20 Q58 35 51 48 Q46 57 50 63 Q36 50 41 36Z" fill={`url(#${shine})`} />
          <path d="M44 35 L56 49 M42 61 Q50 67 58 61" fill="none" stroke={metal[0]} strokeWidth="1.4" />
          <path d="M47 18 Q50 13 53 18" fill="none" stroke={metal[0]} strokeWidth="2" />
        </>}
        {type === "n" && <>
          <path d="M38 82 Q40 72 42 66 L34 54 Q29 45 35 34 L43 19 Q47 14 54 19 L67 29 Q72 35 68 43 L61 55 L60 68 Q62 74 63 82Z" fill={`url(#${body})`} stroke={metal[4]} strokeWidth="1.5" />
          <path d="M42 22 Q49 19 55 26 L64 34 Q68 39 62 45 L54 52 L45 49 L39 40Z" fill={`url(#${shine})`} />
          <path d="M43 32 Q50 28 57 35 L62 40 M47 48 Q53 53 60 48 M41 62 Q51 68 61 62" fill="none" stroke={metal[0]} strokeWidth="1.4" />
          <circle cx="56" cy="32" r="2.2" fill={metal[4]} />
          <path d="M34 53 Q43 58 53 55" fill="none" stroke={metal[4]} strokeWidth="1.4" />
        </>}
        {type === "p" && <>
          <path d="M40 81 Q43 72 44 65 L44 54 Q34 47 37 35 Q39 24 50 22 Q61 24 63 35 Q66 47 56 54 L56 65 Q57 73 60 81Z" fill={`url(#${body})`} stroke={metal[4]} strokeWidth="1.4" />
          <circle cx="50" cy="35" r="11" fill={`url(#${shine})`} />
          <path d="M43 55 Q50 60 57 55 M42 66 Q50 71 58 66 M40 77 Q50 82 60 77" fill="none" stroke={metal[0]} strokeOpacity=".8" strokeWidth="1.4" />
        </>}
        {/* Polished front-facing glint */}
        <path d="M31 96 Q49 101 69 96" fill="none" stroke={metal[0]} strokeOpacity=".9" strokeWidth="1.4" />
      </g>
    </svg>
  );
}
