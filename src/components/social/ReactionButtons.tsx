import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Id } from "../../../convex/_generated/dataModel";
import { toast } from "sonner";

interface ReactionButtonsProps {
  tokenId: Id<"memeCoins">;
  size?: "sm" | "md" | "lg";
  showCounts?: boolean;
}

const REACTIONS = [
  { type: "rocket" as const, emoji: "🚀", label: "To the moon!" },
  { type: "fire" as const, emoji: "🔥", label: "Hot!" },
  { type: "diamond" as const, emoji: "💎", label: "Diamond hands!" },
  { type: "trash" as const, emoji: "🗑️", label: "Trash" },
  { type: "moon" as const, emoji: "🌙", label: "Moon soon" },
  { type: "bear" as const, emoji: "🐻", label: "Bearish" },
];

export default function ReactionButtons({ 
  tokenId, 
  size = "md", 
  showCounts = true 
}: ReactionButtonsProps) {
  const [hoveredReaction, setHoveredReaction] = useState<string | null>(null);
  const [animatingReaction, setAnimatingReaction] = useState<string | null>(null);

  // Get reactions data
  const reactions = useQuery(api.social.reactions.getReactions, { tokenId });
  const user = useQuery(api.auth.loggedInUser);
  const addReaction = useMutation(api.social.reactions.addReaction);

  const handleReaction = async (type: typeof REACTIONS[number]["type"]) => {
    if (!user) {
      toast.error("Please sign in to react");
      return;
    }

    try {
      setAnimatingReaction(type);
      const result = await addReaction({ tokenId, type });
      
      if (result.action === "added") {
        toast(
          <div className="flex items-center gap-2">
            <span className="text-2xl">{REACTIONS.find(r => r.type === type)?.emoji}</span>
            <span>Reaction added!</span>
          </div>
        );
      } else if (result.action === "removed") {
        toast("Reaction removed");
      }
    } catch (error: any) {
      toast.error(error.message);
    } finally {
      setTimeout(() => setAnimatingReaction(null), 500);
    }
  };

  const getSizeClasses = () => {
    switch (size) {
      case "sm":
        return "text-xl p-1.5";
      case "lg":
        return "text-3xl p-3";
      default:
        return "text-2xl p-2";
    }
  };

  if (!reactions) {
    return (
      <div className="flex gap-2">
        {REACTIONS.map((r) => (
          <div
            key={r.type}
            className={`${getSizeClasses()} bg-gray-100 rounded-lg animate-pulse`}
          />
        ))}
      </div>
    );
  }

  return (
    <div className="flex flex-wrap gap-2">
      {REACTIONS.map((reaction) => {
        const count = reactions.counts[reaction.type] || 0;
        const isActive = reactions.userReaction === reaction.type;

        return (
          <button
            key={reaction.type}
            onClick={() => handleReaction(reaction.type)}
            onMouseEnter={() => setHoveredReaction(reaction.type)}
            onMouseLeave={() => setHoveredReaction(null)}
            className={`
              relative flex items-center gap-1 rounded-lg transition-all hover:scale-105 active:scale-95
              ${getSizeClasses()}
              ${
                isActive
                  ? "bg-purple-100 border-2 border-purple-500"
                  : "bg-gray-100 hover:bg-gray-200 border-2 border-transparent"
              }
              ${!user ? "cursor-not-allowed opacity-60" : "cursor-pointer"}
            `}
          >
            <span
              className={`
                transition-transform
                ${animatingReaction === reaction.type ? "animate-bounce" : ""}
              `}
            >
              {reaction.emoji}
            </span>
            
            {showCounts && count > 0 && (
              <span
                className={`
                  text-sm font-medium
                  ${isActive ? "text-purple-700" : "text-gray-700"}
                `}
              >
                {count}
              </span>
            )}

            {/* Tooltip */}
            {hoveredReaction === reaction.type && (
              <div className="absolute bottom-full left-1/2 -translate-x-1/2 mb-2 px-2 py-1 bg-gray-800 text-white text-xs rounded whitespace-nowrap z-10 animate-fade-in">
                {reaction.label}
                <div className="absolute top-full left-1/2 -translate-x-1/2 -mt-1 w-2 h-2 bg-gray-800 rotate-45" />
              </div>
            )}
          </button>
        );
      })}

      {/* Total reactions count */}
      {showCounts && reactions.total > 0 && (
        <div className="flex items-center px-3 text-sm text-gray-600">
          <span className="font-medium">{reactions.total}</span>
          <span className="ml-1">reaction{reactions.total !== 1 ? "s" : ""}</span>
        </div>
      )}
    </div>
  );
}

// Compact version for use in lists
export function ReactionBadges({ tokenId }: { tokenId: Id<"memeCoins"> }) {
  const reactions = useQuery(api.social.reactions.getReactions, { tokenId });

  if (!reactions || reactions.total === 0) return null;

  // Get top 3 reactions
  const topReactions = Object.entries(reactions.counts)
    .filter(([_, count]) => count > 0)
    .sort((a, b) => b[1] - a[1])
    .slice(0, 3);

  return (
    <div className="flex items-center gap-1">
      {topReactions.map(([type, count]) => {
        const reaction = REACTIONS.find(r => r.type === type);
        if (!reaction) return null;

        return (
          <div
            key={type}
            className="flex items-center gap-0.5 bg-gray-100 rounded-full px-2 py-0.5"
          >
            <span className="text-sm">{reaction.emoji}</span>
            <span className="text-xs text-gray-600">{count}</span>
          </div>
        );
      })}
      {reactions.total > 3 && (
        <span className="text-xs text-gray-500 ml-1">
          +{reactions.total - topReactions.reduce((sum, [_, count]) => sum + count, 0)}
        </span>
      )}
    </div>
  );
}