import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { Id } from "../../convex/_generated/dataModel";
import { formatDistanceToNow } from "date-fns";

export default function CreatorDashboard() {
  const [selectedToken, setSelectedToken] = useState<Id<"memeCoins"> | null>(null);
  const [withdrawAmount, setWithdrawAmount] = useState("");
  const [withdrawing, setWithdrawing] = useState(false);

  const creatorStats = useQuery(api.revenue.creatorRevenue.getCreatorStats);
  const tokenRevenues = useQuery(api.revenue.creatorRevenue.getTokenRevenues);
  const revenueHistory = useQuery(api.revenue.creatorRevenue.getRevenueHistory, 
    selectedToken ? { tokenId: selectedToken } : "skip"
  );
  
  const withdraw = useMutation(api.revenue.creatorRevenue.withdraw);

  const handleWithdraw = async (tokenId: Id<"memeCoins">, blockchain: string) => {
    if (!withdrawAmount || parseFloat(withdrawAmount) <= 0) return;
    
    setWithdrawing(true);
    try {
      await withdraw({
        tokenId,
        amount: parseFloat(withdrawAmount),
        blockchain,
      });
      setWithdrawAmount("");
      alert("Withdrawal initiated successfully!");
    } catch (error) {
      console.error("Withdrawal failed:", error);
      alert("Withdrawal failed. Please try again.");
    } finally {
      setWithdrawing(false);
    }
  };

  if (!creatorStats || !tokenRevenues) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-500"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      {/* Overview Stats */}
      <div className="bg-gradient-to-r from-purple-900/20 to-pink-900/20 rounded-xl p-6 border border-purple-500/20">
        <h2 className="text-2xl font-bold mb-4 text-transparent bg-clip-text bg-gradient-to-r from-purple-400 to-pink-400">
          Creator Revenue Dashboard
        </h2>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4 mt-6">
          <div className="bg-black/30 rounded-lg p-4 border border-purple-500/10">
            <p className="text-gray-400 text-sm">Total Earnings</p>
            <p className="text-2xl font-bold mt-1">${creatorStats.totalEarnings.toFixed(2)}</p>
          </div>
          
          <div className="bg-black/30 rounded-lg p-4 border border-purple-500/10">
            <p className="text-gray-400 text-sm">Available to Withdraw</p>
            <p className="text-2xl font-bold mt-1">${creatorStats.availableBalance.toFixed(2)}</p>
          </div>
          
          <div className="bg-black/30 rounded-lg p-4 border border-purple-500/10">
            <p className="text-gray-400 text-sm">Total Volume Generated</p>
            <p className="text-2xl font-bold mt-1">${creatorStats.totalVolume.toFixed(2)}</p>
          </div>
          
          <div className="bg-black/30 rounded-lg p-4 border border-purple-500/10">
            <p className="text-gray-400 text-sm">Active Tokens</p>
            <p className="text-2xl font-bold mt-1">{creatorStats.activeTokens}</p>
          </div>
        </div>
      </div>

      {/* Token Revenue Details */}
      <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
        <h3 className="text-xl font-bold mb-4">Revenue by Token</h3>
        
        <div className="space-y-4">
          {tokenRevenues.map((tokenRevenue) => (
            <div
              key={tokenRevenue._id}
              className={`bg-black/30 rounded-lg p-4 border transition-all cursor-pointer ${
                selectedToken === tokenRevenue.tokenId
                  ? "border-purple-500 shadow-lg shadow-purple-500/20"
                  : "border-gray-800 hover:border-gray-700"
              }`}
              onClick={() => setSelectedToken(tokenRevenue.tokenId)}
            >
              <div className="flex items-center justify-between">
                <div className="flex-1">
                  <h4 className="font-semibold">{tokenRevenue.tokenName}</h4>
                  <p className="text-sm text-gray-400">{tokenRevenue.tokenSymbol}</p>
                </div>
                
                <div className="text-right">
                  <p className="font-semibold">${tokenRevenue.totalEarnings.toFixed(2)}</p>
                  <p className="text-sm text-gray-400">Available: ${tokenRevenue.availableBalance.toFixed(2)}</p>
                </div>
              </div>
              
              <div className="mt-4 grid grid-cols-3 gap-4 text-sm">
                <div>
                  <p className="text-gray-400">Bonding Curve Fees</p>
                  <p className="font-medium">${tokenRevenue.bondingCurveFees.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-400">Trading Fees</p>
                  <p className="font-medium">${tokenRevenue.tradingFees.toFixed(2)}</p>
                </div>
                <div>
                  <p className="text-gray-400">DEX Fees</p>
                  <p className="font-medium">${tokenRevenue.dexFees.toFixed(2)}</p>
                </div>
              </div>
              
              {selectedToken === tokenRevenue.tokenId && (
                <div className="mt-4 flex items-center gap-2">
                  <input
                    type="number"
                    placeholder="Amount to withdraw"
                    value={withdrawAmount}
                    onChange={(e) => setWithdrawAmount(e.target.value)}
                    max={tokenRevenue.availableBalance}
                    className="flex-1 px-3 py-2 bg-gray-800 border border-gray-700 rounded-lg focus:outline-none focus:border-purple-500"
                  />
                  <button
                    onClick={() => handleWithdraw(tokenRevenue.tokenId, tokenRevenue.blockchain)}
                    disabled={withdrawing || !withdrawAmount || parseFloat(withdrawAmount) > tokenRevenue.availableBalance}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-pink-600 rounded-lg font-medium disabled:opacity-50 disabled:cursor-not-allowed hover:from-purple-700 hover:to-pink-700 transition-all"
                  >
                    {withdrawing ? "Processing..." : "Withdraw"}
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Revenue History */}
      {selectedToken && revenueHistory && (
        <div className="bg-gray-900/50 rounded-xl p-6 border border-gray-800">
          <h3 className="text-xl font-bold mb-4">Revenue History</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="text-left text-sm text-gray-400 border-b border-gray-800">
                  <th className="pb-2">Type</th>
                  <th className="pb-2">Amount</th>
                  <th className="pb-2">Fee %</th>
                  <th className="pb-2">Time</th>
                  <th className="pb-2">Status</th>
                </tr>
              </thead>
              <tbody>
                {revenueHistory.map((transaction) => (
                  <tr key={transaction._id} className="border-b border-gray-800/50">
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        transaction.type === "bonding_curve_fee"
                          ? "bg-purple-500/20 text-purple-300"
                          : transaction.type === "trading_fee"
                          ? "bg-blue-500/20 text-blue-300"
                          : transaction.type === "dex_fee"
                          ? "bg-green-500/20 text-green-300"
                          : "bg-red-500/20 text-red-300"
                      }`}>
                        {transaction.type.replace(/_/g, " ").toUpperCase()}
                      </span>
                    </td>
                    <td className="py-3 font-medium">
                      {transaction.type === "withdrawal" ? "-" : "+"}${transaction.amount.toFixed(4)}
                    </td>
                    <td className="py-3 text-gray-400">
                      {transaction.feePercentage ? `${transaction.feePercentage}%` : "-"}
                    </td>
                    <td className="py-3 text-gray-400">
                      {formatDistanceToNow(new Date(transaction._creationTime), { addSuffix: true })}
                    </td>
                    <td className="py-3">
                      <span className={`px-2 py-1 rounded text-xs font-medium ${
                        transaction.status === "completed"
                          ? "bg-green-500/20 text-green-300"
                          : transaction.status === "pending"
                          ? "bg-yellow-500/20 text-yellow-300"
                          : "bg-red-500/20 text-red-300"
                      }`}>
                        {transaction.status}
                      </span>
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