import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { Droplets, Settings, TrendingUp, AlertCircle } from "lucide-react";

interface AutoLiquidityDashboardProps {
  tokenId: Id<"memeCoins">;
  token: any;
  isCreator: boolean;
}

export default function AutoLiquidityDashboard({ tokenId, token, isCreator }: AutoLiquidityDashboardProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [manualAmount, setManualAmount] = useState({ tokens: "", eth: "" });
  const [config, setConfig] = useState({
    enabled: false,
    liquidityFeePercent: 200, // 2%
    minTokensBeforeSwap: token.initialSupply * 0.001,
    targetLiquidityPercent: 1000, // 10%
  });

  const liquidityStats = useQuery(api.autoLiquidity.getAutoLiquidityStats, { tokenId });
  const configureLiquidity = useMutation(api.autoLiquidity.configureAutoLiquidity);
  const manualAddLiquidity = useMutation(api.autoLiquidity.manualAddLiquidity);

  const handleConfigSave = async () => {
    try {
      await configureLiquidity({
        tokenId,
        ...config,
      });
      setShowConfig(false);
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  };

  const handleManualAdd = async () => {
    if (!manualAmount.tokens || !manualAmount.eth) return;

    try {
      await manualAddLiquidity({
        tokenId,
        tokenAmount: parseFloat(manualAmount.tokens),
        ethAmount: parseFloat(manualAmount.eth),
      });
      setManualAmount({ tokens: "", eth: "" });
      alert("Liquidity added successfully!");
    } catch (error) {
      console.error("Failed to add liquidity:", error);
      alert("Failed to add liquidity");
    }
  };

  if (!liquidityStats) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-800 rounded-lg"></div>
      </div>
    );
  }

  // Update config state when data loads
  if (liquidityStats.configured && liquidityStats.stats && config.enabled !== liquidityStats.enabled) {
    setConfig({
      enabled: liquidityStats.enabled,
      liquidityFeePercent: liquidityStats.stats.liquidityFeePercent,
      minTokensBeforeSwap: liquidityStats.stats.minTokensBeforeSwap,
      targetLiquidityPercent: liquidityStats.stats.targetLiquidityPercent,
    });
  }

  return (
    <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Droplets className="w-8 h-8 text-blue-500" />
          <h3 className="text-xl font-bold">Auto-Liquidity Generation</h3>
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

      {/* Liquidity Statistics */}
      {liquidityStats.stats && (
        <>
          <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
            <div className="bg-black/30 rounded-lg p-4">
              <div className="flex items-center gap-2 mb-2">
                <Droplets className="w-5 h-5 text-blue-500" />
                <p className="text-sm text-gray-400">Total Liquidity</p>
              </div>
              <p className="text-2xl font-bold">{liquidityStats.stats.totalETHInLiquidity.toFixed(4)} ETH</p>
              <p className="text-xs text-gray-500 mt-1">
                {liquidityStats.stats.totalTokensInLiquidity.toLocaleString()} {token.symbol}
              </p>
            </div>

            <div className="bg-black/30 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">Collection Rate</p>
              <p className="text-2xl font-bold">
                {liquidityStats.enabled ? `${liquidityStats.stats.liquidityFeePercent / 100}%` : "Disabled"}
              </p>
              <p className="text-xs text-gray-500 mt-1">Per transaction</p>
            </div>

            <div className="bg-black/30 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">Progress to Target</p>
              <p className="text-2xl font-bold">{liquidityStats.stats.liquidityProgress.toFixed(1)}%</p>
              <div className="w-full bg-gray-700 rounded-full h-2 mt-2">
                <div 
                  className="bg-blue-500 h-2 rounded-full transition-all"
                  style={{ width: `${Math.min(100, liquidityStats.stats.liquidityProgress)}%` }}
                />
              </div>
            </div>

            <div className="bg-black/30 rounded-lg p-4">
              <p className="text-sm text-gray-400 mb-2">Provisions</p>
              <p className="text-2xl font-bold">{liquidityStats.stats.provisionCount}</p>
              <p className="text-xs text-gray-500 mt-1">Total additions</p>
            </div>
          </div>

          {/* Pending Collection */}
          {liquidityStats.stats.collectedTokens > 0 && (
            <div className="bg-blue-500/10 border border-blue-500/20 rounded-lg p-4 mb-6">
              <div className="flex items-center justify-between">
                <div>
                  <p className="text-sm text-blue-300 font-medium">Pending Collection</p>
                  <p className="text-xs text-blue-200 mt-1">
                    {liquidityStats.stats.collectedTokens.toLocaleString()} {token.symbol} / {liquidityStats.stats.collectedETH.toFixed(4)} ETH
                  </p>
                </div>
                <div className="text-right">
                  <p className="text-xs text-blue-200">
                    {((liquidityStats.stats.collectedTokens / liquidityStats.stats.minTokensBeforeSwap) * 100).toFixed(1)}% to auto-add
                  </p>
                </div>
              </div>
            </div>
          )}
        </>
      )}

      {/* Configuration Panel */}
      {showConfig && isCreator && (
        <div className="bg-black/30 rounded-lg p-6 mb-6 border border-gray-700">
          <h4 className="font-medium mb-4">Auto-Liquidity Configuration</h4>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm">Enable Auto-Liquidity</span>
              <input
                type="checkbox"
                checked={config.enabled}
                onChange={(e) => setConfig({ ...config, enabled: e.target.checked })}
                className="w-4 h-4 text-blue-600 rounded focus:ring-blue-500"
              />
            </label>

            {config.enabled && (
              <>
                <div>
                  <label className="text-sm text-gray-400">Liquidity Fee Percentage</label>
                  <input
                    type="number"
                    value={config.liquidityFeePercent / 100}
                    onChange={(e) => setConfig({ ...config, liquidityFeePercent: Number(e.target.value) * 100 })}
                    step="0.1"
                    min="0"
                    max="5"
                    className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">% of each transaction for liquidity</p>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Min Tokens Before Auto-Add</label>
                  <input
                    type="number"
                    value={config.minTokensBeforeSwap}
                    onChange={(e) => setConfig({ ...config, minTokensBeforeSwap: Number(e.target.value) })}
                    className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Tokens collected before adding to pool</p>
                </div>

                <div>
                  <label className="text-sm text-gray-400">Target Liquidity %</label>
                  <input
                    type="number"
                    value={config.targetLiquidityPercent / 100}
                    onChange={(e) => setConfig({ ...config, targetLiquidityPercent: Number(e.target.value) * 100 })}
                    step="1"
                    min="5"
                    max="50"
                    className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                  />
                  <p className="text-xs text-gray-500 mt-1">Target % of supply in liquidity pool</p>
                </div>
              </>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={handleConfigSave}
              className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
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

      {/* Manual Liquidity Addition */}
      {isCreator && (
        <div className="bg-black/30 rounded-lg p-6 mb-6">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <TrendingUp className="w-5 h-5 text-blue-500" />
            Manual Liquidity Addition
          </h4>
          
          <div className="grid grid-cols-2 gap-3 mb-3">
            <div>
              <label className="text-sm text-gray-400">Token Amount</label>
              <input
                type="number"
                placeholder="0"
                value={manualAmount.tokens}
                onChange={(e) => setManualAmount({ ...manualAmount, tokens: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
              />
            </div>
            <div>
              <label className="text-sm text-gray-400">ETH Amount</label>
              <input
                type="number"
                placeholder="0"
                value={manualAmount.eth}
                onChange={(e) => setManualAmount({ ...manualAmount, eth: e.target.value })}
                className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
              />
            </div>
          </div>
          
          <button
            onClick={handleManualAdd}
            disabled={!manualAmount.tokens || !manualAmount.eth}
            className="w-full px-4 py-2 bg-gradient-to-r from-blue-600 to-cyan-600 hover:from-blue-700 hover:to-cyan-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
          >
            Add Liquidity
          </button>

          <div className="mt-3 p-3 bg-blue-500/10 border border-blue-500/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-blue-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-blue-300">
              <p className="font-medium">Liquidity Lock Notice</p>
              <p>Added liquidity is locked for 6 months to ensure stability.</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Events */}
      {liquidityStats.stats && liquidityStats.stats.recentEvents.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Recent Liquidity Events</h4>
          <div className="space-y-2">
            {liquidityStats.stats.recentEvents.slice(0, 10).map((event, index) => (
              <div key={event._id} className="flex items-center justify-between bg-black/30 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className={`px-2 py-1 rounded text-xs font-medium ${
                    event.type === "addition"
                      ? "bg-green-500/20 text-green-300"
                      : event.type === "collection"
                      ? "bg-blue-500/20 text-blue-300"
                      : event.type === "manual_addition"
                      ? "bg-purple-500/20 text-purple-300"
                      : "bg-red-500/20 text-red-300"
                  }`}>
                    {event.type.replace(/_/g, " ").toUpperCase()}
                  </span>
                  <div>
                    <p className="text-sm">
                      {event.tokenAmount.toLocaleString()} {token.symbol} / {event.ethAmount.toFixed(4)} ETH
                    </p>
                    <p className="text-xs text-gray-400">
                      {formatDistanceToNow(event.timestamp, { addSuffix: true })}
                    </p>
                  </div>
                </div>
                {event.metadata?.lpTokensReceived && (
                  <p className="text-xs text-gray-400">
                    +{event.metadata.lpTokensReceived.toFixed(2)} LP
                  </p>
                )}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Impact Summary */}
      {liquidityStats.stats && (
        <div className="mt-6 p-4 bg-black/30 rounded-lg">
          <h4 className="font-medium mb-2">Liquidity Impact</h4>
          <div className="grid grid-cols-2 gap-4 text-sm">
            <div>
              <p className="text-gray-400">Price Stability</p>
              <p className="font-medium text-green-400">
                +{Math.min(50, liquidityStats.stats.liquidityProgress / 2).toFixed(0)}% improved
              </p>
            </div>
            <div>
              <p className="text-gray-400">Slippage Reduction</p>
              <p className="font-medium text-blue-400">
                -{Math.min(80, liquidityStats.stats.liquidityProgress * 0.8).toFixed(0)}% on trades
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}