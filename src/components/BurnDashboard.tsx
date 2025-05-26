import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";
import { Flame, TrendingDown, Settings, AlertCircle } from "lucide-react";

interface BurnDashboardProps {
  tokenId: Id<"memeCoins">;
  token: any;
  isCreator: boolean;
}

export default function BurnDashboard({ tokenId, token, isCreator }: BurnDashboardProps) {
  const [showConfig, setShowConfig] = useState(false);
  const [burnAmount, setBurnAmount] = useState("");
  const [config, setConfig] = useState({
    autoBurnEnabled: false,
    burnFeePercent: 100, // 1%
    manualBurnEnabled: true,
    burnOnGraduation: true,
    graduationBurnPercent: 2000, // 20%
  });

  const burnStats = useQuery(api.tokenBurn.getBurnStats, { tokenId });
  const configureBurn = useMutation(api.tokenBurn.configureBurn);
  const burnTokens = useMutation(api.tokenBurn.burnTokens);

  const handleConfigSave = async () => {
    try {
      await configureBurn({
        tokenId,
        ...config,
      });
      setShowConfig(false);
    } catch (error) {
      console.error("Failed to save burn config:", error);
    }
  };

  const handleManualBurn = async () => {
    if (!burnAmount || parseFloat(burnAmount) <= 0) return;

    if (!confirm(`Are you sure you want to burn ${burnAmount} ${token.symbol}? This cannot be undone.`)) {
      return;
    }

    try {
      await burnTokens({
        tokenId,
        amount: parseFloat(burnAmount),
      });
      setBurnAmount("");
      alert("Tokens burned successfully!");
    } catch (error) {
      console.error("Failed to burn tokens:", error);
      alert("Failed to burn tokens");
    }
  };

  if (!burnStats) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-800 rounded-lg"></div>
      </div>
    );
  }

  // Update config state when data loads
  if (burnStats.configured && config.autoBurnEnabled !== burnStats.autoBurnEnabled) {
    setConfig({
      autoBurnEnabled: burnStats.autoBurnEnabled,
      burnFeePercent: burnStats.burnFeePercent,
      manualBurnEnabled: burnStats.manualBurnEnabled,
      burnOnGraduation: burnStats.burnOnGraduation,
      graduationBurnPercent: burnStats.graduationBurnPercent,
    });
  }

  return (
    <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Flame className="w-8 h-8 text-orange-500" />
          <h3 className="text-xl font-bold">Token Burn Mechanics</h3>
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

      {/* Burn Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-black/30 rounded-lg p-4">
          <div className="flex items-center gap-2 mb-2">
            <TrendingDown className="w-5 h-5 text-orange-500" />
            <p className="text-sm text-gray-400">Total Burned</p>
          </div>
          <p className="text-2xl font-bold">{burnStats.totalBurned.toLocaleString()}</p>
          <p className="text-xs text-gray-500 mt-1">
            {burnStats.burnPercentage.toFixed(2)}% of supply
          </p>
        </div>

        <div className="bg-black/30 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">Auto-Burn Rate</p>
          <p className="text-2xl font-bold">
            {burnStats.autoBurnEnabled ? `${burnStats.burnFeePercent / 100}%` : "Disabled"}
          </p>
          <p className="text-xs text-gray-500 mt-1">Per transaction</p>
        </div>

        <div className="bg-black/30 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">Graduation Burn</p>
          <p className="text-2xl font-bold">
            {burnStats.burnOnGraduation ? `${burnStats.graduationBurnPercent / 100}%` : "Disabled"}
          </p>
          <p className="text-xs text-gray-500 mt-1">On DEX listing</p>
        </div>

        <div className="bg-black/30 rounded-lg p-4">
          <p className="text-sm text-gray-400 mb-2">Burn Transactions</p>
          <p className="text-2xl font-bold">{burnStats.recentBurns.length}</p>
          <p className="text-xs text-gray-500 mt-1">Total burns</p>
        </div>
      </div>

      {/* Configuration Panel */}
      {showConfig && isCreator && (
        <div className="bg-black/30 rounded-lg p-6 mb-6 border border-gray-700">
          <h4 className="font-medium mb-4">Burn Configuration</h4>
          
          <div className="space-y-4">
            <label className="flex items-center justify-between">
              <span className="text-sm">Enable Auto-Burn</span>
              <input
                type="checkbox"
                checked={config.autoBurnEnabled}
                onChange={(e) => setConfig({ ...config, autoBurnEnabled: e.target.checked })}
                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            {config.autoBurnEnabled && (
              <div>
                <label className="text-sm text-gray-400">Burn Fee Percentage</label>
                <input
                  type="number"
                  value={config.burnFeePercent / 100}
                  onChange={(e) => setConfig({ ...config, burnFeePercent: Number(e.target.value) * 100 })}
                  step="0.1"
                  min="0"
                  max="5"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">% of each transaction to burn</p>
              </div>
            )}

            <label className="flex items-center justify-between">
              <span className="text-sm">Enable Manual Burn</span>
              <input
                type="checkbox"
                checked={config.manualBurnEnabled}
                onChange={(e) => setConfig({ ...config, manualBurnEnabled: e.target.checked })}
                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            <label className="flex items-center justify-between">
              <span className="text-sm">Burn on Graduation</span>
              <input
                type="checkbox"
                checked={config.burnOnGraduation}
                onChange={(e) => setConfig({ ...config, burnOnGraduation: e.target.checked })}
                className="w-4 h-4 text-orange-600 rounded focus:ring-orange-500"
              />
            </label>

            {config.burnOnGraduation && (
              <div>
                <label className="text-sm text-gray-400">Graduation Burn Percentage</label>
                <input
                  type="number"
                  value={config.graduationBurnPercent / 100}
                  onChange={(e) => setConfig({ ...config, graduationBurnPercent: Number(e.target.value) * 100 })}
                  step="1"
                  min="0"
                  max="50"
                  className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
                />
                <p className="text-xs text-gray-500 mt-1">% of supply to burn on DEX listing</p>
              </div>
            )}
          </div>

          <div className="flex gap-2 mt-6">
            <button
              onClick={handleConfigSave}
              className="px-4 py-2 bg-orange-600 hover:bg-orange-700 rounded-lg transition-colors"
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

      {/* Manual Burn */}
      {burnStats.manualBurnEnabled && (
        <div className="bg-black/30 rounded-lg p-6 mb-6">
          <h4 className="font-medium mb-4 flex items-center gap-2">
            <Flame className="w-5 h-5 text-orange-500" />
            Manual Token Burn
          </h4>
          
          <div className="flex items-center gap-3">
            <input
              type="number"
              placeholder="Amount to burn"
              value={burnAmount}
              onChange={(e) => setBurnAmount(e.target.value)}
              className="flex-1 px-4 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-orange-500"
            />
            <button
              onClick={handleManualBurn}
              disabled={!burnAmount || parseFloat(burnAmount) <= 0}
              className="px-6 py-2 bg-gradient-to-r from-orange-600 to-red-600 hover:from-orange-700 hover:to-red-700 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed transition-all"
            >
              Burn Tokens
            </button>
          </div>

          <div className="mt-3 p-3 bg-orange-500/10 border border-orange-500/20 rounded-lg flex items-start gap-2">
            <AlertCircle className="w-5 h-5 text-orange-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-orange-300">
              <p className="font-medium">Warning: This action is irreversible!</p>
              <p>Burned tokens are permanently removed from circulation.</p>
            </div>
          </div>
        </div>
      )}

      {/* Recent Burns */}
      {burnStats.recentBurns.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Recent Burns</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Burner</th>
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {burnStats.recentBurns.slice(0, 10).map((burn) => (
                  <tr key={burn._id} className="border-b border-gray-800/50">
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        burn.burnType === "manual"
                          ? "bg-orange-500/20 text-orange-300"
                          : burn.burnType === "trading_fee"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-purple-500/20 text-purple-300"
                      }`}>
                        {burn.burnType.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 font-medium">
                      {burn.amount.toLocaleString()} {token.symbol}
                    </td>
                    <td className="py-3 font-mono text-xs">
                      {burn.burnerDisplay}
                    </td>
                    <td className="py-3 text-gray-400">
                      {formatDistanceToNow(burn.timestamp, { addSuffix: true })}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        burn.status === "completed"
                          ? "bg-green-500/20 text-green-300"
                          : burn.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : burn.status === "scheduled"
                          ? "bg-blue-500/20 text-blue-300"
                          : "bg-red-500/20 text-red-300"
                      }`}>
                        {burn.status}
                      </span>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* Supply Impact Chart */}
      <div className="mt-6 p-4 bg-black/30 rounded-lg">
        <h4 className="font-medium mb-2">Supply Impact</h4>
        <div className="grid grid-cols-3 gap-4 text-sm">
          <div>
            <p className="text-gray-400">Original Supply</p>
            <p className="font-medium">{token.initialSupply.toLocaleString()}</p>
          </div>
          <div>
            <p className="text-gray-400">Circulating Supply</p>
            <p className="font-medium">
              {(token.initialSupply - burnStats.totalBurned).toLocaleString()}
            </p>
          </div>
          <div>
            <p className="text-gray-400">Deflationary Rate</p>
            <p className="font-medium text-orange-400">
              -{burnStats.burnPercentage.toFixed(2)}%
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}