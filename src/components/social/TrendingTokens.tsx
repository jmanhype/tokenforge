import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { Link } from "react-router-dom";
import { TrendingUp, TrendingDown, Flame, Users, DollarSign } from "lucide-react";
import { ReactionBadges } from "./ReactionButtons";

export default function TrendingTokens() {
  const trending = useQuery(api.social.trending.getTrendingTokens, { limit: 10 });
  const gainers = useQuery(api.social.trending.getTrendingChanges, { type: "gainers", limit: 5 });
  const losers = useQuery(api.social.trending.getTrendingChanges, { type: "losers", limit: 5 });

  if (!trending) {
    return (
      <div className="animate-pulse">
        <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
        <div className="space-y-3">
          {[1, 2, 3, 4, 5].map((i) => (
            <div key={i} className="h-20 bg-gray-200 rounded-lg"></div>
          ))}
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-8">
      {/* Trending Tokens */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        <div className="bg-gradient-to-r from-orange-500 to-red-500 text-white p-6">
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <Flame className="w-6 h-6" />
            Trending Tokens
          </h2>
          <p className="text-orange-100 mt-1">Based on volume, social engagement, and price action</p>
        </div>

        <div className="divide-y divide-gray-200">
          {trending.map((item, index) => (
            <Link
              key={item.tokenId}
              to={`/trade/${item.tokenId}`}
              className="block hover:bg-gray-50 transition-colors"
            >
              <div className="p-4">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-4">
                    {/* Rank */}
                    <div className="text-2xl font-bold text-gray-400 w-8">
                      #{item.rank}
                    </div>

                    {/* Token Info */}
                    <div className="flex items-center gap-3">
                      <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold">
                        {item.token.symbol.charAt(0)}
                      </div>
                      <div>
                        <h3 className="font-bold text-gray-900">{item.token.name}</h3>
                        <p className="text-sm text-gray-600">{item.token.symbol}</p>
                      </div>
                    </div>
                  </div>

                  {/* Metrics */}
                  <div className="flex items-center gap-6">
                    {/* Price Change */}
                    {item.analytics && (
                      <div className="text-right">
                        <p className="text-sm text-gray-600">24h Change</p>
                        <p className={`font-bold ${
                          item.analytics.priceChange24h >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {item.analytics.priceChange24h >= 0 ? "+" : ""}
                          {item.analytics.priceChange24h.toFixed(2)}%
                        </p>
                      </div>
                    )}

                    {/* Volume */}
                    {item.analytics && (
                      <div className="text-right">
                        <p className="text-sm text-gray-600">Volume 24h</p>
                        <p className="font-bold text-gray-900">
                          ${(item.analytics.volume24h / 1000).toFixed(1)}k
                        </p>
                      </div>
                    )}

                    {/* Trending Score */}
                    <div className="text-right">
                      <p className="text-sm text-gray-600">Score</p>
                      <div className="flex items-center gap-1">
                        <Flame className="w-4 h-4 text-orange-500" />
                        <span className="font-bold text-gray-900">{item.score.toFixed(0)}</span>
                      </div>
                    </div>
                  </div>
                </div>

                {/* Score Breakdown */}
                <div className="mt-3 flex items-center gap-4">
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">Volume Score</span>
                      <span className="text-xs font-medium">{item.volumeScore.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-blue-500 to-blue-600"
                        style={{ width: `${item.volumeScore}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">Social Score</span>
                      <span className="text-xs font-medium">{item.socialScore.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-purple-500 to-purple-600"
                        style={{ width: `${item.socialScore}%` }}
                      />
                    </div>
                  </div>
                  <div className="flex-1">
                    <div className="flex justify-between items-center mb-1">
                      <span className="text-xs text-gray-600">Price Score</span>
                      <span className="text-xs font-medium">{item.priceScore.toFixed(0)}</span>
                    </div>
                    <div className="h-1.5 bg-gray-200 rounded-full overflow-hidden">
                      <div
                        className="h-full bg-gradient-to-r from-green-500 to-green-600"
                        style={{ width: `${item.priceScore}%` }}
                      />
                    </div>
                  </div>
                </div>

                {/* Reactions */}
                <div className="mt-3">
                  <ReactionBadges tokenId={item.tokenId} />
                </div>
              </div>
            </Link>
          ))}
        </div>
      </div>

      {/* Gainers & Losers */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Top Gainers */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-green-600" />
            Top Gainers
          </h3>
          <div className="space-y-3">
            {gainers?.map((token) => (
              <Link
                key={token.tokenId}
                to={`/trade/${token.tokenId}`}
                className="flex items-center justify-between hover:bg-gray-50 p-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-500">#{token.rank}</span>
                  <div>
                    <p className="font-medium text-gray-900">{token.tokenName}</p>
                    <p className="text-xs text-gray-600">{token.tokenSymbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-green-600">
                    +{token.scoreChangePercent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-600">Score: {token.score.toFixed(0)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Top Losers */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold text-gray-900 mb-4 flex items-center gap-2">
            <TrendingDown className="w-5 h-5 text-red-600" />
            Top Losers
          </h3>
          <div className="space-y-3">
            {losers?.map((token) => (
              <Link
                key={token.tokenId}
                to={`/trade/${token.tokenId}`}
                className="flex items-center justify-between hover:bg-gray-50 p-2 rounded-lg transition-colors"
              >
                <div className="flex items-center gap-3">
                  <span className="text-sm font-bold text-gray-500">#{token.rank}</span>
                  <div>
                    <p className="font-medium text-gray-900">{token.tokenName}</p>
                    <p className="text-xs text-gray-600">{token.tokenSymbol}</p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-bold text-red-600">
                    {token.scoreChangePercent.toFixed(1)}%
                  </p>
                  <p className="text-xs text-gray-600">Score: {token.score.toFixed(0)}</p>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}