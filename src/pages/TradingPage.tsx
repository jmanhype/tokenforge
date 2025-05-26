import { useParams } from "react-router-dom";
import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import TradingInterface from "../components/TradingInterface";
import CommentSection from "../components/social/CommentSection";
import ReactionButtons from "../components/social/ReactionButtons";
import { BondingCurveChart } from "../components/BondingCurveChart";
import { TradingPanel } from "../components/TradingPanel";
import { TokenMetrics } from "../components/TokenMetrics";
import { TransactionHistory } from "../components/TransactionHistory";
import { ArrowLeft, Loader2, MessageCircle } from "lucide-react";
import { Link } from "react-router-dom";
import { useState } from "react";

export function TradingPage() {
  const { coinId } = useParams<{ coinId: string }>();
  const [showComments, setShowComments] = useState(false);
  
  if (!coinId) {
    return <div className="text-white">Invalid coin ID</div>;
  }

  const coin = useQuery(api.memeCoins.getCoin, { coinId: coinId as Id<"memeCoins"> });
  const curveData = useQuery(api.bondingCurveApi.getCurveData, { coinId: coinId as Id<"memeCoins"> });
  const userBalance = useQuery(api.bondingCurveApi.getUserBalance, { coinId: coinId as Id<"memeCoins"> });
  const commentCount = useQuery(api.social.comments.getCommentCount, { tokenId: coinId as Id<"memeCoins"> });

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
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      {/* Header */}
      <div className="bg-white/90 backdrop-blur-sm shadow-sm sticky top-0 z-10">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Link
                to="/"
                className="p-2 text-gray-600 hover:text-gray-900 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <ArrowLeft className="w-5 h-5" />
              </Link>
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
                  {coin.symbol.charAt(0)}
                </div>
                <div>
                  <h1 className="text-xl font-bold text-gray-900">{coin.name}</h1>
                  <p className="text-sm text-gray-600">{coin.symbol}</p>
                </div>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <span className="text-sm text-gray-600 bg-gray-100 px-3 py-1 rounded-full">
                {coin.deployment?.blockchain.toUpperCase()}
              </span>
            </div>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="container mx-auto px-4 py-8 space-y-8">
        {/* Reactions Section */}
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold mb-4">Community Sentiment</h3>
          <ReactionButtons tokenId={coin._id} size="lg" />
        </div>

        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Trading Interface */}
          <div className="lg:col-span-2 space-y-8">
            <TradingInterface coinId={coin._id} />
            
            {/* Comments Section */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <div className="flex items-center justify-between mb-6">
                <h3 className="text-lg font-bold flex items-center gap-2">
                  <MessageCircle className="w-5 h-5" />
                  Comments
                  {commentCount !== undefined && (
                    <span className="text-sm font-normal text-gray-600">({commentCount})</span>
                  )}
                </h3>
                <button
                  onClick={() => setShowComments(!showComments)}
                  className="text-sm text-purple-600 hover:text-purple-700"
                >
                  {showComments ? "Hide" : "Show"} Comments
                </button>
              </div>
              {showComments && <CommentSection tokenId={coin._id} />}
            </div>
          </div>

          {/* Right Column - Additional Info */}
          <div className="lg:col-span-1 space-y-6">
            {/* Recent Transactions */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold mb-4">Recent Trades</h3>
              <div className="space-y-3">
                {curveData.recentTransactions.slice(0, 10).map((tx: any) => (
                  <div key={tx._id} className="flex justify-between items-center text-sm">
                    <div className="flex items-center gap-2">
                      <span className={`font-medium ${tx.type === 'buy' ? 'text-green-600' : 'text-red-600'}`}>
                        {tx.type.toUpperCase()}
                      </span>
                      <span className="text-gray-600">
                        {tx.type === 'buy' ? tx.tokensOut?.toLocaleString() : tx.tokensIn?.toLocaleString()} {coin.symbol}
                      </span>
                    </div>
                    <span className="text-gray-500">
                      {new Date(tx.timestamp).toLocaleTimeString()}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Bonding Curve Info */}
            <div className="bg-white rounded-xl shadow-lg p-6">
              <h3 className="text-lg font-bold mb-4">Bonding Curve Info</h3>
              <div className="space-y-3">
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Curve Formula</span>
                  <span className="font-mono text-sm">x^1.5</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Trading Fee</span>
                  <span className="text-sm font-medium">1%</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">Graduation Target</span>
                  <span className="text-sm font-medium">$100,000</span>
                </div>
                <div className="flex justify-between items-center">
                  <span className="text-sm text-gray-600">DEX Liquidity</span>
                  <span className="text-sm font-medium">17% of reserves</span>
                </div>
              </div>
            </div>

            {/* Token Info */}
            {coin.description && (
              <div className="bg-white rounded-xl shadow-lg p-6">
                <h3 className="text-lg font-bold mb-4">About {coin.name}</h3>
                <p className="text-sm text-gray-600">{coin.description}</p>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}