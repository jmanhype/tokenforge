import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { Sparkles, Gift, TrendingUp, Users, Settings } from "lucide-react";

interface ReflectionsDashboardProps {
  tokenId: Id<"memeCoins">;
  token: any;
  isCreator: boolean;
}

export default function ReflectionsDashboard({ tokenId, token, isCreator }: ReflectionsDashboardProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [config, setConfig] = useState({
    enabled: false,
    reflectionFeePercent: 200, // 2%
    minHoldingForRewards: token.initialSupply * 0.0001,
  });

  const reflectionStats = useQuery(api.reflections.getReflectionStats, { tokenId });
  const userReflections = useQuery(api.reflections.getUserReflections, { tokenId });
  const topEarners = useQuery(api.reflections.getTopEarners, { tokenId, limit: 5 });
  
  const configureReflections = useMutation(api.reflections.configureReflections);
  const claimReflections = useMutation(api.reflections.claimReflections);

  const handleConfigSave = async () => {
    try {
      await configureReflections({
        tokenId,
        ...config,
      });
      setShowConfig(false);
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  };

  const handleClaim = async () => {
    try {
      const result = await claimReflections({ tokenId });
      alert(`Successfully claimed ${result.claimedAmount.toFixed(4)} ${token.symbol}!`);
    } catch (error) {
      console.error("Failed to claim rewards:", error);
      alert("Failed to claim rewards");
    }
  };

  if (!reflectionStats) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-800 rounded-lg"></div>
      </div>
    );
  }

  // Update config state when data loads
  if (reflectionStats.configured && reflectionStats.stats && config.enabled !== reflectionStats.enabled) {
    setConfig({
      enabled: reflectionStats.enabled,
      reflectionFeePercent: reflectionStats.stats.reflectionFeePercent,
      minHoldingForRewards: reflectionStats.stats.minHoldingForRewards,
    });
  }

  return (
    <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Sparkles className="w-8 h-8 text-yellow-500" />
          <h3 className="text-xl font-bold">Reflection Rewards System</h3>
        </div>
        {isCreator && (
          <button
            onClick={() => setShowConfig(!showConfig)}
            className="flex items-center gap-2 px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
          >
            <Settings className="w-4 h-4" />
            Configure
          </button>
        )}
      </div>

      {/* User Rewards Card */}
      {userReflections && (
        <div className="bg-gradient-to-r from-yellow-900/20 to-amber-900/20 rounded-xl p-6 border border-yellow-500/20 mb-6">
          <div className="flex items-center justify-between mb-4">
            <div>
              <h4 className="text-lg font-semibold flex items-center gap-2">
                <Gift className="w-5 h-5 text-yellow-500" />
                Your Rewards
              </h4>
              <p className="text-sm text-gray-400 mt-1">
                {userReflections.isEligible 
                  ? "You're eligible for reflection rewards!"
                  : `Hold at least ${config.minHoldingForRewards.toLocaleString()} ${token.symbol} to earn rewards`
                }
              </p>
            </div>
            {userReflections.pendingRewards > 0 && (
              <button
                onClick={handleClaim}
                className="px-6 py-3 bg-gradient-to-r from-yellow-600 to-amber-600 hover:from-yellow-700 hover:to-amber-700 rounded-lg font-medium transition-all"
              >
                Claim {userReflections.pendingRewards.toFixed(4)} {token.symbol}
              </button>
            )}
          </div>

          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-sm text-gray-400">Your Balance</p>
              <p className="text-lg font-medium">{userReflections.tokenBalance.toLocaleString()}</p>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-sm text-gray-400">Total Earned</p>
              <p className="text-lg font-medium text-yellow-400">
                +{userReflections.totalReceived.toFixed(4)}
              </p>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-sm text-gray-400">Pending</p>
              <p className="text-lg font-medium text-green-400">
                {userReflections.pendingRewards.toFixed(4)}
              </p>
            </div>
            <div className="bg-black/30 rounded-lg p-3">
              <p className="text-sm text-gray-400">Claimed</p>
              <p className="text-lg font-medium">{userReflections.claimedRewards.toFixed(4)}</p>
            </div>
          </div>
        </div>
      )}

      {/* Reflection Statistics */}
      {reflectionStats.stats && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
          <div className="bg-black/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="w-5 h-5 text-yellow-500" />
              <p className="text-sm text-gray-400">Total Reflected</p>
            </div>
            <p className="text-2xl font-bold">{reflectionStats.stats.totalReflected.toLocaleString()}</p>
            <p className="text-xs text-gray-500 mt-1">{token.symbol}</p>
          </div>

          <div className="bg-black/30 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-2">Reflection Rate</p>
            <p className="text-2xl font-bold">
              {reflectionStats.enabled ? `${reflectionStats.stats.reflectionFeePercent / 100}%` : "Disabled"}
            </p>
            <p className="text-xs text-gray-500 mt-1">Per transaction</p>
          </div>

          <div className="bg-black/30 rounded-lg p-4">
            <div className="flex items-center gap-2 mb-2">
              <Users className="w-5 h-5 text-yellow-500" />
              <p className="text-sm text-gray-400">Eligible Holders</p>
            </div>
            <p className="text-2xl font-bold">{reflectionStats.stats.eligibleHolders}</p>
            <p className="text-xs text-gray-500 mt-1">of {reflectionStats.stats.totalHolders} total</p>
          </div>

          <div className="bg-black/30 rounded-lg p-4">
            <p className="text-sm text-gray-400 mb-2">Avg Distribution</p>
            <p className="text-2xl font-bold">
              {reflectionStats.stats.averageDistribution.toFixed(2)}
            </p>
            <p className="text-xs text-gray-500 mt-1">{token.symbol} per event</p>
          </div>
        </div>
      )}

      {/* Configuration Panel */}
      {showConfig && isCreator && (
        <div className="bg-black/30 rounded-lg p-6 mb-6 border border-gray-700">
          <h4 className="font-medium mb-4">Reflection Configuration</h4>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm">Enable Reflections</span>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-4 h-4 text-yellow-600 rounded focus:ring-yellow-500"
              />
            </label>

            {config.enabled && (
              <>
                <div>
                  <label className="text-sm text-gray-400">Reflection Fee Percentage</label>
                  <input
                    type="number"
                    value={config.reflectionFeePercent / 100}
                    onChange={(e) => setConfig({ ...config, reflectionFeePercent: Number(e.target.value) * 100 })}
                    step="0.1"
                    min="0"
                    max="5"
                    className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">% of each transaction distributed to holders</p>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Minimum Holding for Rewards</label>
                  <input
                    type="number"
                    value={config.minHoldingForRewards}
                    onChange={(e) => setConfig({ ...config, minHoldingForRewards: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Minimum tokens to receive reflections</p>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={handleConfigSave}
              className="px-4 py-2 bg-yellow-600 hover:bg-yellow-700 rounded-lg transition-colors"
            >
              Save Configuration
            </button>
            <button
              onClick={() => setShowConfig(false)}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
            >
              Cancel
            </button>
          </div>
        </div>
      )}

      {/* Top Earners */}
      {topEarners && topEarners.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium mb-3 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-yellow-500" />
            Top Reflection Earners
          </h4>
          <div className="space-y-2">
            {topEarners.map((earner, index) => (
              <div key={index} className="flex items-center justify-between bg-black/30 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className={`text-lg font-bold ${
                    index === 0 ? "text-yellow-400" :
                    index === 1 ? "text-gray-300" :
                    index === 2 ? "text-orange-400" :
                    "text-gray-500"
                  }`}>
                    #{earner.rank}
                  </span>
                  <div>
                    <p className="font-mono text-sm">{earner.address}</p>
                    <p className="text-xs text-gray-400">
                      {earner.tokenBalance.toLocaleString()} {token.symbol}
                    </p>
                  </div>
                </div>
                <div className="text-right">
                  <p className="font-medium text-yellow-400">
                    +{earner.totalReceived.toFixed(4)}
                  </p>
                  <p className="text-xs text-gray-400">
                    {earner.pendingRewards > 0 && `${earner.pendingRewards.toFixed(4)} pending`}
                  </p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Distributions */}
      {reflectionStats.stats && reflectionStats.stats.recentDistributions.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Recent Distributions</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Recipients</th>
                  <th className="pb-2">Avg/Holder</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {reflectionStats.stats.recentDistributions.slice(0, 5).map((dist) => (
                  <tr key={dist._id} className="border-b border-gray-800/50">
                    <td className="py-3 font-medium">
                      {dist.totalAmount.toFixed(4)} {token.symbol}
                    </td>
                    <td className="py-3">{dist.recipientCount}</td>
                    <td className="py-3">{dist.averageAmount.toFixed(6)}</td>
                    <td className="py-3 text-gray-400">
                      {formatDistanceToNow(dist.timestamp, { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Info Box */}
      <div className="mt-6 p-4 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
        <h4 className="font-medium mb-2 flex items-center gap-2">
          <Sparkles className="w-4 h-4 text-yellow-400" />
          How Reflections Work
        </h4>
        <ul className="text-sm text-gray-300 space-y-1">
          <li>• {reflectionStats.stats?.reflectionFeePercent / 100 || 2}% of every transaction is distributed to holders</li>
          <li>• Rewards are proportional to your share of total supply</li>
          <li>• Minimum {config.minHoldingForRewards.toLocaleString()} {token.symbol} required</li>
          <li>• Claim anytime - no time limit on rewards</li>
          <li>• Excluded: Contract addresses, burn wallet, liquidity pools</li>
        </ul>
      </div>
    </div>
  );
}