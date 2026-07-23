import type { AccuracyStats } from "@/lib/store";

export default function AccuracyPanel({
  stats,
  recentForm,
}: {
  stats: AccuracyStats;
  recentForm: boolean[];
}) {
  if (stats.gamesEvaluated === 0) {
    return (
      <div className="border border-line px-4 py-3 mb-8 text-xs text-chalk/50">
        No graded games yet — your win rate appears here once the daily
        evaluation job has scored its first finished games.
      </div>
    );
  }

  const winRatePct = Math.round(stats.winnerAccuracy * 100);

  return (
    <div className="border border-line mb-8">
      <div className="flex items-baseline justify-between px-4 py-4 border-b border-line">
        <div>
          <div className="text-[11px] uppercase tracking-widest text-chalk/50">
            App win rate
          </div>
          <div className="font-display text-5xl text-buzzer leading-none mt-1">
            {winRatePct}%
          </div>
          <div className="text-[11px] text-chalk/50 mt-1">
            {stats.gamesEvaluated} picks graded
          </div>
        </div>
        {recentForm.length > 0 && (
          <div className="text-right">
            <div className="text-[11px] uppercase tracking-widest text-chalk/50 mb-2">
              Last {recentForm.length}
            </div>
            <div className="flex gap-1 justify-end">
              {recentForm.map((won, i) => (
                <span
                  key={i}
                  className={`w-5 h-5 flex items-center justify-center text-[10px] font-display ${
                    won ? "bg-parquet text-hardwood" : "bg-buzzer/30 text-chalk/70"
                  }`}
                >
                  {won ? "W" : "L"}
                </span>
              ))}
            </div>
          </div>
        )}
      </div>

      <div className="grid grid-cols-2 gap-px bg-line">
        <Stat label="Avg total error" value={`±${stats.avgTotalError} pts`} />
        <Stat label="Avg margin error" value={`±${stats.avgMarginError} pts`} />
      </div>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="bg-court px-4 py-3">
      <div className="font-display text-xl text-amber">{value}</div>
      <div className="text-[11px] text-chalk/50 mt-1">{label}</div>
    </div>
  );
}
