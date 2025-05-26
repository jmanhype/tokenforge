import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";

interface FairLaunchConfigProps {
  tokenId: Id<"memeCoins">;
  totalSupply: number;
}

export default function FairLaunchConfig({ tokenId, totalSupply }: FairLaunchConfigProps) {
  const [isEditing, setIsEditing] = useState(false);
  const [config, setConfig] = useState({
    maxBuyPerWallet: totalSupply * 0.01,      // 1% default
    maxBuyPerTx: totalSupply * 0.005,         // 0.5% default
    cooldownPeriod: 300,                      // 5 minutes
    antiSnipeBlocks: 3,                       // 3 blocks
    enabled: true,
  });

  const fairLaunchStats = useQuery(api.fairLaunch.getFairLaunchStats, { tokenId });
  const checkPurchase = useQuery(api.fairLaunch.checkPurchaseAllowed, {
    tokenId,
    buyer: "0x0000000000000000000000000000000000000000", // Placeholder
    amount: 0,
  });
  
  const configureFairLaunch = useMutation(api.fairLaunch.configureFairLaunch);
  const enableTrading = useMutation(api.fairLaunch.enableTrading);
  const setBlacklist = useMutation(api.fairLaunch.setBlacklist);

  const handleSaveConfig = async () => {
    try {
      await configureFairLaunch({
        tokenId,
        config,
      });
      setIsEditing(false);
    } catch (error) {
      console.error("Failed to save config:", error);
    }
  };

  const handleEnableTrading = async () => {
    if (!confirm("Are you sure you want to enable trading? This cannot be undone.")) return;
    
    try {
      await enableTrading({ tokenId });
      alert("Trading enabled successfully!");
    } catch (error) {
      console.error("Failed to enable trading:", error);
      alert("Failed to enable trading");
    }
  };

  if (!fairLaunchStats) {
    return (
      <div className="animate-pulse">
        <div className="h-64 bg-gray-800 rounded-lg"></div>
      </div>
    );
  }

  return (
    <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-xl font-bold">⚡ Fair Launch Configuration</h3>
        {!fairLaunchStats.tradingEnabled && (
          <button
            onClick={() => setIsEditing(!isEditing)}
            className="px-4 py-2 bg-purple-600 hover:bg-purple-700 rounded-lg transition-colors"
          >
            {isEditing ? "Cancel" : "Edit Config"}
          </button>
        )}
      </div>

      {/* Configuration Settings */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mb-6">
        <div className="bg-black/30 rounded-lg p-4">
          <label className="text-sm text-gray-400">Max Buy Per Wallet</label>
          {isEditing ? (
            <input
              type="number"
              value={config.maxBuyPerWallet}
              onChange={(e) => setConfig({ ...config, maxBuyPerWallet: Number(e.target.value) })}
              className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
            />
          ) : (
            <p className="text-lg font-medium mt-1">
              {fairLaunchStats.config.maxBuyPerWallet.toLocaleString()} tokens
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {((fairLaunchStats.config.maxBuyPerWallet / totalSupply) * 100).toFixed(2)}% of supply
          </p>
        </div>

        <div className="bg-black/30 rounded-lg p-4">
          <label className="text-sm text-gray-400">Max Buy Per Transaction</label>
          {isEditing ? (
            <input
              type="number"
              value={config.maxBuyPerTx}
              onChange={(e) => setConfig({ ...config, maxBuyPerTx: Number(e.target.value) })}
              className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
            />
          ) : (
            <p className="text-lg font-medium mt-1">
              {fairLaunchStats.config.maxBuyPerTx.toLocaleString()} tokens
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            {((fairLaunchStats.config.maxBuyPerTx / totalSupply) * 100).toFixed(2)}% of supply
          </p>
        </div>

        <div className="bg-black/30 rounded-lg p-4">
          <label className="text-sm text-gray-400">Cooldown Period</label>
          {isEditing ? (
            <input
              type="number"
              value={config.cooldownPeriod}
              onChange={(e) => setConfig({ ...config, cooldownPeriod: Number(e.target.value) })}
              className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
            />
          ) : (
            <p className="text-lg font-medium mt-1">
              {fairLaunchStats.config.cooldownPeriod} seconds
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            Between purchases per wallet
          </p>
        </div>

        <div className="bg-black/30 rounded-lg p-4">
          <label className="text-sm text-gray-400">Anti-Snipe Blocks</label>
          {isEditing ? (
            <input
              type="number"
              value={config.antiSnipeBlocks}
              onChange={(e) => setConfig({ ...config, antiSnipeBlocks: Number(e.target.value) })}
              className="w-full mt-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg"
            />
          ) : (
            <p className="text-lg font-medium mt-1">
              {fairLaunchStats.config.antiSnipeBlocks} blocks
            </p>
          )}
          <p className="text-xs text-gray-500 mt-1">
            ~{fairLaunchStats.config.antiSnipeBlocks * 15} seconds protection
          </p>
        </div>
      </div>

      {isEditing && (
        <div className="flex gap-2 mb-6">
          <button
            onClick={handleSaveConfig}
            className="px-4 py-2 bg-green-600 hover:bg-green-700 rounded-lg transition-colors"
          >
            Save Configuration
          </button>
          <button
            onClick={() => setIsEditing(false)}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors"
          >
            Cancel
          </button>
        </div>
      )}

      {/* Trading Status */}
      <div className="bg-black/30 rounded-lg p-4 mb-6">
        <div className="flex items-center justify-between">
          <div>
            <h4 className="font-medium">Trading Status</h4>
            <p className="text-sm text-gray-400 mt-1">
              {fairLaunchStats.tradingEnabled ? (
                <>Trading enabled {formatDistanceToNow(fairLaunchStats.launchTime)} ago</>
              ) : (
                "Trading not yet enabled"
              )}
            </p>
          </div>
          {!fairLaunchStats.tradingEnabled && (
            <button
              onClick={handleEnableTrading}
              className="px-6 py-3 bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-700 hover:to-emerald-700 rounded-lg font-medium transition-all"
            >
              🚀 Enable Trading
            </button>
          )}
        </div>

        {fairLaunchStats.timeUntilFullLaunch && fairLaunchStats.timeUntilFullLaunch > 0 && (
          <div className="mt-4 p-3 bg-yellow-500/10 border border-yellow-500/20 rounded-lg">
            <p className="text-sm text-yellow-400">
              ⚠️ Anti-snipe protection active for {Math.ceil(fairLaunchStats.timeUntilFullLaunch / 1000)} more seconds
            </p>
          </div>
        )}
      </div>

      {/* Launch Statistics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
        <div className="bg-black/30 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{fairLaunchStats.totalParticipants}</p>
          <p className="text-sm text-gray-400">Participants</p>
        </div>
        <div className="bg-black/30 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{fairLaunchStats.totalRaised.toFixed(4)} ETH</p>
          <p className="text-sm text-gray-400">Total Raised</p>
        </div>
        <div className="bg-black/30 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">{fairLaunchStats.recentTransactions.length}</p>
          <p className="text-sm text-gray-400">Transactions</p>
        </div>
        <div className="bg-black/30 rounded-lg p-4 text-center">
          <p className="text-2xl font-bold">
            {fairLaunchStats.config.enabled ? "Active" : "Inactive"}
          </p>
          <p className="text-sm text-gray-400">Fair Launch</p>
        </div>
      </div>

      {/* Top Holders */}
      {fairLaunchStats.topHolders.length > 0 && (
        <div className="mb-6">
          <h4 className="font-medium mb-3">Top Holders</h4>
          <div className="space-y-2">
            {fairLaunchStats.topHolders.map((holder, index) => (
              <div key={index} className="flex items-center justify-between bg-black/30 rounded-lg p-3">
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">#{index + 1}</span>
                  <span className="font-mono text-sm">{holder.address}</span>
                </div>
                <div className="text-right">
                  <p className="font-medium">{holder.amount.toLocaleString()} tokens</p>
                  <p className="text-xs text-gray-400">{holder.percentage.toFixed(1)}% of max</p>
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Recent Transactions */}
      {fairLaunchStats.recentTransactions.length > 0 && (
        <div>
          <h4 className="font-medium mb-3">Recent Transactions</h4>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-gray-400 border-b border-gray-800">
                  <th className="pb-2">Buyer</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">ETH</th>
                  <th className="pb-2">Time</th>
                </tr>
              </thead>
              <tbody>
                {fairLaunchStats.recentTransactions.slice(0, 5).map((tx) => (
                  <tr key={tx._id} className="border-b border-gray-800/50">
                    <td className="py-2 font-mono text-xs">
                      {tx.buyer.slice(0, 6)}...{tx.buyer.slice(-4)}
                    </td>
                    <td className="py-2">{tx.tokenAmount.toLocaleString()}</td>
                    <td className="py-2">{tx.ethAmount.toFixed(4)}</td>
                    <td className="py-2 text-gray-400">
                      {formatDistanceToNow(tx.timestamp, { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}