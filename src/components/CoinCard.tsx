import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Link } from "react-router-dom";
import { TrendingUp, Users, Activity, Zap } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";

interface CoinCardProps {
  coin: {
    _id: Id<"memeCoins">;
    name: string;
    symbol: string;
    initialSupply: number;
    canMint: boolean;
    canBurn: boolean;
    postQuantumSecurity: boolean;
    creatorId: Id<"users">;
    description?: string;
    logoUrl?: string;
    status: "pending" | "deployed" | "failed" | "graduated";
    _creationTime: number;
    deployment?: {
      _id?: Id<"deployments">;
      _creationTime?: number;
      coinId?: Id<"memeCoins">;
      blockchain: "ethereum" | "solana" | "bsc";
      contractAddress: string;
      transactionHash: string;
      deployedAt: number;
      gasUsed?: number;
      deploymentCost?: number;
    } | null;
    creatorName?: string;
    bondingCurve?: {
      isActive: boolean;
      currentPrice: number;
      marketCap: number;
      progress: number;
      totalVolume: number;
      holders: number;
    };
  };
  showAnalytics?: boolean;
}

export function CoinCard({ coin, showAnalytics = false }: CoinCardProps) {
  const [isDeploying, setIsDeploying] = useState(false);
  const deployBondingCurve = useMutation(api.bondingCurve.deployBondingCurveForToken);
  
  const analytics = useQuery(
    api.analytics.getCoinAnalytics,
    showAnalytics && coin.status === "deployed" ? { coinId: coin._id } : "skip"
  );

  const handleDeployBondingCurve = async () => {
    try {
      setIsDeploying(true);
      await deployBondingCurve({ coinId: coin._id });
      toast.success("Bonding curve deployment scheduled! This may take a few minutes.");
    } catch (error: any) {
      toast.error(error.message || "Failed to deploy bonding curve");
    } finally {
      setIsDeploying(false);
    }
  };

  const getStatusColor = (status: string) => {
    switch (status) {
      case "deployed":
        return "bg-green-100 text-green-800";
      case "pending":
        return "bg-yellow-100 text-yellow-800";
      case "failed":
        return "bg-red-100 text-red-800";
      case "graduated":
        return "bg-purple-100 text-purple-800";
      default:
        return "bg-gray-100 text-gray-800";
    }
  };

  const getStatusIcon = (status: string) => {
    switch (status) {
      case "deployed":
        return "✅";
      case "pending":
        return "⏳";
      case "failed":
        return "❌";
      case "graduated":
        return "🎓";
      default:
        return "❓";
    }
  };

  const getBlockchainIcon = (blockchain: string) => {
    switch (blockchain) {
      case "ethereum":
        return "🔷";
      case "solana":
        return "🟣";
      case "bsc":
        return "🟡";
      default:
        return "⚡";
    }
  };

  return (
    <div className="bg-white border border-gray-200 rounded-xl p-6 hover:shadow-lg transition-shadow">
      {/* Header */}
      <div className="flex items-start justify-between mb-4">
        <div className="flex items-center gap-3">
          <div className="w-12 h-12 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-lg">
            {coin.symbol.charAt(0)}
          </div>
          <div>
            <h4 className="font-bold text-gray-900">{coin.name}</h4>
            <p className="text-sm text-gray-500">{coin.symbol}</p>
          </div>
        </div>
        <span className={`px-2 py-1 rounded-full text-xs font-medium ${getStatusColor(coin.status)}`}>
          {getStatusIcon(coin.status)} {coin.status}
        </span>
      </div>

      {/* Description */}
      {coin.description && (
        <p className="text-sm text-gray-600 mb-4 line-clamp-2">{coin.description}</p>
      )}

      {/* Features */}
      <div className="flex flex-wrap gap-2 mb-4">
        {coin.canMint && (
          <span className="px-2 py-1 bg-blue-100 text-blue-700 text-xs rounded-full">
            🪙 Mintable
          </span>
        )}
        {coin.canBurn && (
          <span className="px-2 py-1 bg-orange-100 text-orange-700 text-xs rounded-full">
            🔥 Burnable
          </span>
        )}
        {coin.postQuantumSecurity && (
          <span className="px-2 py-1 bg-purple-100 text-purple-700 text-xs rounded-full">
            🔐 Post-Quantum
          </span>
        )}
      </div>

      {/* Deployment Info */}
      {coin.deployment && (
        <div className="bg-gray-50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700">
              {getBlockchainIcon(coin.deployment.blockchain)} {coin.deployment.blockchain}
            </span>
            <span className="text-xs text-gray-500">
              {new Date(coin.deployment.deployedAt).toLocaleDateString()}
            </span>
          </div>
          <div className="text-xs text-gray-600 font-mono">
            {coin.deployment.contractAddress.slice(0, 10)}...{coin.deployment.contractAddress.slice(-8)}
          </div>
        </div>
      )}

      {/* Bonding Curve Status */}
      {coin.bondingCurve && coin.bondingCurve.isActive && (
        <div className="bg-gradient-to-r from-indigo-50 to-purple-50 rounded-lg p-3 mb-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-medium text-gray-700 flex items-center gap-1">
              <Activity className="w-4 h-4" />
              Bonding Curve Active
            </span>
            <span className="text-xs text-indigo-600 font-medium">
              {coin.bondingCurve.progress.toFixed(1)}% to DEX
            </span>
          </div>
          <div className="grid grid-cols-3 gap-2 text-xs">
            <div className="text-center">
              <div className="text-gray-600">Price</div>
              <div className="font-mono font-medium">${coin.bondingCurve.currentPrice.toFixed(6)}</div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Market Cap</div>
              <div className="font-medium">${(coin.bondingCurve.marketCap / 1000).toFixed(1)}k</div>
            </div>
            <div className="text-center">
              <div className="text-gray-600">Holders</div>
              <div className="font-medium">{coin.bondingCurve.holders}</div>
            </div>
          </div>
          <div className="mt-2 bg-gray-200 rounded-full h-1.5">
            <div
              className="bg-gradient-to-r from-indigo-500 to-purple-500 h-1.5 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(coin.bondingCurve.progress, 100)}%` }}
            />
          </div>
        </div>
      )}

      {/* Analytics */}
      {showAnalytics && analytics?.latest && !coin.bondingCurve?.isActive && (
        <div className="bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg p-3 mb-4">
          <div className="grid grid-cols-2 gap-3 text-sm">
            <div>
              <div className="text-gray-600">Price</div>
              <div className="font-mono font-medium">${analytics.latest.price.toFixed(6)}</div>
            </div>
            <div>
              <div className="text-gray-600">24h Change</div>
              <div className={`font-medium ${
                analytics.latest.priceChange24h >= 0 ? "text-green-600" : "text-red-600"
              }`}>
                {analytics.latest.priceChange24h >= 0 ? "+" : ""}
                {analytics.latest.priceChange24h.toFixed(2)}%
              </div>
            </div>
            <div>
              <div className="text-gray-600">Holders</div>
              <div className="font-medium">{analytics.latest.holders.toLocaleString()}</div>
            </div>
            <div>
              <div className="text-gray-600">Volume 24h</div>
              <div className="font-mono font-medium">
                ${analytics.latest.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 })}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="text-sm text-gray-500">
          <span>Supply: {coin.initialSupply.toLocaleString()}</span>
        </div>
        <div className="flex gap-2">
          {/* Deploy Bonding Curve button */}
          {coin.status === "deployed" && coin.bondingCurve && !coin.bondingCurve.hasContract && (
            <button
              onClick={handleDeployBondingCurve}
              disabled={isDeploying}
              className="px-3 py-1 bg-gradient-to-r from-yellow-500 to-orange-500 text-white text-sm rounded-lg hover:from-yellow-600 hover:to-orange-600 transition-all flex items-center gap-1 disabled:opacity-50"
            >
              <Zap className="w-3 h-3" />
              {isDeploying ? "Deploying..." : "Deploy Trading"}
            </button>
          )}
          
          {coin.bondingCurve?.isActive && coin.bondingCurve?.hasContract && (
            <Link
              to={`/trade/${coin._id}`}
              className="px-3 py-1 bg-indigo-600 text-white text-sm rounded-lg hover:bg-indigo-700 transition-colors flex items-center gap-1"
            >
              <TrendingUp className="w-3 h-3" />
              Trade
            </Link>
          )}
          
          {coin.status === "deployed" && (
            <Link
              to={`/analytics/${coin._id}`}
              className="px-3 py-1 bg-purple-600 text-white text-sm rounded-lg hover:bg-purple-700 transition-colors flex items-center gap-1"
            >
              📊 Analytics
            </Link>
          )}
          
          {!coin.bondingCurve?.isActive && coin.status === "graduated" && (
            <span className="text-sm text-purple-600 font-medium">
              Trading on DEX
            </span>
          )}
        </div>
      </div>
    </div>
  );
}
