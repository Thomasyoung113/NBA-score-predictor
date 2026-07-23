import type { MarketPredictions } from "@/lib/predict";

export type Game = {
  id: number;
  date: string;
  home: string;
  away: string;
  prediction: MarketPredictions;
  source: string;
};

export default function GameCard({ game }: { game: Game }) {
  const { prediction: p } = game;
  const homeFavored = p.winner.pick === "home";
  const tipoff = new Date(game.date).toLocaleString("en-US", {
    weekday: "short",
    month: "short",
    day: "numeric",
    hour: "numeric",
    minute: "2-digit",
  });

  return (
    <div className="border border-line rounded-none bg-hardwood/60 hover:border-parquet transition-colors">
      <div className="flex items-center justify-between px-4 py-2 border-b border-line text-xs tracking-widest uppercase text-chalk/60">
        <span>{tipoff}</span>
        <span className="text-amber">Model Picks</span>
      </div>

      <div className="grid grid-cols-[1fr_auto_1fr] items-center px-4 py-5 gap-3">
        <TeamRow
          name={game.away}
          score={p.awayScore}
          winProb={p.winner.awayWinProbability}
          favored={!homeFavored}
        />
        <span className="font-display text-2xl text-chalk/40 justify-self-center">@</span>
        <TeamRow
          name={game.home}
          score={p.homeScore}
          winProb={p.winner.homeWinProbability}
          favored={homeFavored}
          alignRight
        />
      </div>

      <div className="grid grid-cols-3 gap-px bg-line border-t border-line">
        <MarketCell
          label="Winner"
          value={homeFavored ? game.home : game.away}
          sub={`${Math.round(Math.max(p.winner.homeWinProbability, p.winner.awayWinProbability) * 100)}% model confidence`}
        />
        <MarketCell
          label="Total (O/U)"
          value={p.total.line.toString()}
          sub={`Projected total: ${p.total.projectedTotal}`}
        />
        <MarketCell
          label="Handicap"
          value={`${p.handicap.favorite === "home" ? game.home : game.away} -${p.handicap.line}`}
          sub="Projected margin"
        />
      </div>

      <div className="flex items-center justify-between px-4 py-2 border-t border-line text-[11px] text-chalk/50">
        <span>Model margin of error: ±{p.marginOfError} pts</span>
        <span>{game.source === "mock" ? "Sample data" : "balldontlie stats"}</span>
      </div>
    </div>
  );
}

function TeamRow({
  name,
  score,
  winProb,
  favored,
  alignRight,
}: {
  name: string;
  score: number;
  winProb: number;
  favored: boolean;
  alignRight?: boolean;
}) {
  return (
    <div className={alignRight ? "text-right" : "text-left"}>
      <div className="font-body text-sm text-chalk/80">{name}</div>
      <div
        className="flex items-baseline gap-2"
        style={{ justifyContent: alignRight ? "flex-end" : "flex-start" }}
      >
        <span className={`font-display text-4xl ${favored ? "text-buzzer" : "text-chalk"}`}>
          {score}
        </span>
        <span className="text-xs text-parquet">{Math.round(winProb * 100)}%</span>
      </div>
    </div>
  );
}

function MarketCell({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="bg-court px-3 py-3">
      <div className="text-[10px] uppercase tracking-widest text-chalk/50">{label}</div>
      <div className="font-display text-lg text-amber leading-tight mt-1">{value}</div>
      <div className="text-[11px] text-chalk/50 mt-0.5">{sub}</div>
    </div>
  );
}
