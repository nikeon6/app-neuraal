"use client";

interface TopicsLaneEmptyStateProps {
  readonly hasTopics: boolean;
}

const GHOST_NEURONS = [
  { size: 52, x: "15%", y: "22%", delay: 0 },
  { size: 36, x: "55%", y: "18%", delay: 0.3 },
  { size: 64, x: "38%", y: "48%", delay: 0.15 },
  { size: 28, x: "72%", y: "60%", delay: 0.45 },
  { size: 44, x: "22%", y: "70%", delay: 0.6 },
  { size: 32, x: "65%", y: "35%", delay: 0.25 },
] as const;

export function TopicsLaneEmptyState({ hasTopics }: TopicsLaneEmptyStateProps) {
  return (
    <div className="absolute inset-3 lg:inset-4 flex items-center justify-center">
      <div className="relative w-full h-full rounded-2xl border-2 border-dashed border-white/10 overflow-hidden flex items-center justify-center">
        {/* Ghost neuron circles */}
        {GHOST_NEURONS.map((neuron) => (
          <div
            key={`${neuron.x}-${neuron.y}`}
            className="absolute rounded-full border border-dashed border-white/[0.07] animate-pulse"
            style={{
              width: neuron.size,
              height: neuron.size,
              left: neuron.x,
              top: neuron.y,
              animationDelay: `${neuron.delay}s`,
              animationDuration: "3s",
              transform: "translate(-50%, -50%)",
            }}
          />
        ))}

        {/* Ghost connection lines (SVG) */}
        <svg
          className="absolute inset-0 w-full h-full pointer-events-none"
          preserveAspectRatio="none"
        >
          <line
            x1="15%"
            y1="22%"
            x2="38%"
            y2="48%"
            stroke="currentColor"
            className="text-white/[0.04]"
            strokeWidth="1"
            strokeDasharray="4 8"
          />
          <line
            x1="55%"
            y1="18%"
            x2="38%"
            y2="48%"
            stroke="currentColor"
            className="text-white/[0.04]"
            strokeWidth="1"
            strokeDasharray="4 8"
          />
          <line
            x1="38%"
            y1="48%"
            x2="72%"
            y2="60%"
            stroke="currentColor"
            className="text-white/[0.04]"
            strokeWidth="1"
            strokeDasharray="4 8"
          />
          <line
            x1="22%"
            y1="70%"
            x2="38%"
            y2="48%"
            stroke="currentColor"
            className="text-white/[0.04]"
            strokeWidth="1"
            strokeDasharray="4 8"
          />
        </svg>

        {/* Text overlay */}
        <div className="relative z-10 text-center px-4 max-w-[220px]">
          <div className="w-10 h-10 mx-auto mb-3 rounded-full border-2 border-dashed border-white/15 flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="w-5 h-5 text-white/30"
            >
              {hasTopics ? (
                <>
                  <circle cx="12" cy="12" r="3" />
                  <path d="M12 2v4M12 18v4M4.93 4.93l2.83 2.83M16.24 16.24l2.83 2.83M2 12h4M18 12h4M4.93 19.07l2.83-2.83M16.24 7.76l2.83-2.83" />
                </>
              ) : (
                <>
                  <circle cx="12" cy="12" r="10" />
                  <line x1="12" y1="8" x2="12" y2="12" />
                  <line x1="12" y1="16" x2="12.01" y2="16" />
                </>
              )}
            </svg>
          </div>
          <p className="text-[13px] leading-snug text-white/35 font-medium">
            {hasTopics
              ? "Assign a topic to an entry to visualize your first neuron"
              : "Create your first topics to see neurons appear here"}
          </p>
        </div>
      </div>
    </div>
  );
}
