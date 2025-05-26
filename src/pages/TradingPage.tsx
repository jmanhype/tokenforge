import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { BondingCurveChart } from "../components/BondingCurveChart";
import { TradingPanel } from "../components/TradingPanel";
import { TokenMetrics } from "../components/TokenMetrics";
import { TransactionHistory } from "../components/TransactionHistory";
import { ArrowLeft, Loader2 } from "lucide-react";
import { Link } from "react-router-dom";

export function TradingPage() {
  const { coinId } = useParams<{ coinId: string }>();
  
  if (!coinId) {
    return <div className="text-white">Invalid coin ID</div>;
  }

  const coin = useQuery(api.memeCoins.getCoin, { coinId: coinId as Id<"memeCoins"> });
  const curveData = useQuery(api.bondingCurveApi.getCurveData, { coinId: coinId as Id<"memeCoins"> });
  const userBalance = useQuery(api.bondingCurveApi.getUserBalance, { coinId: coinId as Id<"memeCoins"> });

  if (coin === undefined || curveData === undefined || userBalance === undefined) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="flex items-center gap-3 text-white">
          <Loader2 className="w-6 h-6 animate-spin" />
          <span className="text-lg">Loading trading data...</span>
        </div>
      </div>
    );
  }

  if (!coin) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Coin not found</h2>
          <Link
            to="/"
            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2 justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  if (!curveData || !curveData.isActive) {
    return (
      <div className="min-h-screen bg-gray-950 flex items-center justify-center">
        <div className="text-center">
          <h2 className="text-2xl font-bold text-white mb-4">Trading not available</h2>
          <p className="text-gray-400 mb-6">
            {coin.status === "graduated" 
              ? "This token has graduated to a DEX"
              : "Trading has not started for this token"
            }
          </p>
          <Link
            to="/"
            className="text-indigo-400 hover:text-indigo-300 flex items-center gap-2 justify-center"
          >
            <ArrowLeft className="w-4 h-4" />
            Back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-950">
      {/* Header */}
      <div className="bg-gray-900 border-b border-gray-800">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {coin.symbol.charAt(0)}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-white">{coin.name}</h1>
                  <p className="text-sm text-gray-400">{coin.symbol}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-400">
                {coin.deployment?.blockchain.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Chart & Metrics */}
          <div className="lg:col-span-2 space-y-8">
            <BondingCurveChart
              currentSupply={curveData.currentSupply}
              currentPrice={curveData.currentPrice}
              reserveBalance={curveData.reserveBalance}
              marketCap={curveData.marketCap}
              priceHistory={curveData.priceHistory}
            />
            
            <TokenMetrics
              marketCap={curveData.marketCap}
              price={curveData.currentPrice}
              priceChange24h={0} // TODO: Calculate from price history
              volume24h={curveData.totalVolume}
              holders={curveData.holders}
              totalSupply={coin.initialSupply}
              circulatingSupply={curveData.currentSupply}
              reserveBalance={curveData.reserveBalance}
              totalTransactions={curveData.totalTransactions}
              bondingCurveProgress={curveData.progress}
            />
            
            <TransactionHistory
              transactions={curveData.recentTransactions.map((tx: any) => ({
                _id: tx._id,
                type: tx.type,
                user: tx.user,
                amount: tx.amountIn || tx.amountOut || 0,
                tokens: tx.tokensOut || tx.tokensIn || 0,
                price: tx.price || 0,
                timestamp: tx.timestamp,
                txHash: tx.txHash,
              }))}
              blockchain={coin.deployment?.blockchain}
            />
          </div>

          {/* Right Column - Trading Panel */}
          <div className="lg:col-span-1">
            <div className="sticky top-8">
              <TradingPanel
                coinId={coin._id}
                currentPrice={curveData.currentPrice}
                reserveBalance={curveData.reserveBalance}
                totalSupply={curveData.currentSupply}
                userBalance={userBalance.usdBalance}
                userTokenBalance={userBalance.balance}
              />
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}