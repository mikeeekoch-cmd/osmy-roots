export type SavedConnection = {
  key: string;
  personId: string;
  personName: string;
  sourceLabel: string;
};

/** A short visual receipt for a saved review, never a simulated discovery. */
export function SourceConnection({
  connection,
  target,
}: {
  connection: SavedConnection;
  target: { x: number; y: number };
}) {
  return (
    <div className="saved-source-connection" key={connection.key}>
      <svg aria-hidden="true" className="saved-source-path">
        <path
          pathLength="1"
          d={`M 30 58 Q 30 ${target.y} ${target.x} ${target.y}`}
        />
        <circle cx={target.x} cy={target.y} r="6" />
      </svg>
      <div className="saved-source-receipt" role="status">
        <strong>Source linked to {connection.personName}</strong>
        <span>{connection.sourceLabel}</span>
      </div>
    </div>
  );
}
