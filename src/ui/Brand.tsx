export function RootsMark() {
  return (
    <svg
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
      className="roots-mark"
    >
      <g
        stroke="currentColor"
        strokeWidth="2.8"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <circle cx="32" cy="14" r="5" />
        <circle cx="16" cy="22" r="4" />
        <circle cx="48" cy="22" r="4" />
        <path d="M24 33v-5a8 8 0 0 1 16 0v5M9 35v-3a7 7 0 0 1 14 0M41 32a7 7 0 0 1 14 0v3M16 35l16 7 16-7M32 34v23M32 45l-13 9M32 45l13 9M23 51l-7-1M41 51l7-1" />
      </g>
    </svg>
  );
}
export function Brand() {
  return (
    <div className="brand" aria-label="Osmy Roots">
      <RootsMark />
      <span>Osmy Roots</span>
    </div>
  );
}
