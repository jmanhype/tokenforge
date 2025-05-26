import { formatCurrency, formatNumber, formatPercentage } from "../lib/utils";
import { TrendingUp, TrendingDown, Users, Activity, DollarSign, Coins } from "lucide-react";

interface TokenMetricsProps {
  marketCap: number;
  price: number;
  priceChange24h: number;
  volume24h: number;
  holders: number;
  totalSupply: number;
  circulatingSupply: number;
  reserveBalance: number;
  totalTransactions: number;
  bondingCurveProgress: number;
}

export function TokenMetrics({
  marketCap,
  price,
  priceChange24h,
  volume24h,
  holders,
  totalSupply,
  circulatingSupply,
  reserveBalance,
  totalTransactions,
  bondingCurveProgress,
}: TokenMetricsProps) {
  const metrics = [
    {
      label: "Market Cap",
      value: formatCurrency(marketCap),
      icon: DollarSign,
      color: "text-green-400",
    },
    {
      label: "Price",
      value: formatCurrency(price),
      subValue: (
        <span className={priceChange24h >= 0 ? "text-green-400" : "text-red-400"}>
          {priceChange24h >= 0 ? "+" : ""}{formatPercentage(priceChange24h)}
        </span>
      ),
      icon: priceChange24h >= 0 ? TrendingUp : TrendingDown,
      color: priceChange24h >= 0 ? "text-green-400" : "text-red-400",
    },
    {
      label: "24h Volume",
      value: formatCurrency(volume24h),
      icon: Activity,
      color: "text-blue-400",
    },
    {
      label: "Holders",
      value: formatNumber(holders),
      icon: Users,
      color: "text-purple-400",
    },
    {
      label: "Total Supply",
      value: formatNumber(totalSupply),
      subValue: `${formatNumber(circulatingSupply)} circulating`,
      icon: Coins,
      color: "text-yellow-400",
    },
    {
      label: "Reserve",
      value: formatCurrency(reserveBalance),
      icon: DollarSign,
      color: "text-indigo-400",
    },
  ];

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
        {metrics.map((metric) => {
          const Icon = metric.icon;
          return (
            <div
              key={metric.label}
              className="bg-gray-900 rounded-lg p-4 border border-gray-800 hover:border-gray-700 transition-colors"
            >
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <p className="text-sm text-gray-400 mb-1">{metric.label}</p>
                  <p className="text-xl font-bold text-white">{metric.value}</p>
                  {metric.subValue && (
                    <p className="text-sm mt-1">{metric.subValue}</p>
                  )}
                </div>
                <div className={`p-2 bg-gray-800 rounded-lg ${metric.color}`}>
                  <Icon className="w-5 h-5" />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      <div className="bg-gray-900 rounded-lg p-6 border border-gray-800">
        <h3 className="text-lg font-semibold text-white mb-4">Bonding Curve Status</h3>
        
        <div className="space-y-4">
          <div>
            <div className="flex justify-between text-sm mb-2">
              <span className="text-gray-400">Progress to Graduation</span>
              <span className="text-white font-medium">{bondingCurveProgress.toFixed(1)}%</span>
            </div>
            <div className="bg-gray-800 rounded-full h-4 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-indigo-500 to-pink-500 transition-all duration-500 relative"
                style={{ width: `${Math.min(bondingCurveProgress, 100)}%` }}
              >
                <div className="absolute inset-0 bg-white/20 animate-pulse" />
              </div>
            </div>
            <p className="text-sm text-gray-400 mt-2">
              {bondingCurveProgress < 100 
                ? `${formatCurrency(100000 - marketCap)} until DEX listing`
                : "🎉 Graduated to DEX!"
              }
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4 pt-4 border-t border-gray-800">
            <div>
              <p className="text-sm text-gray-400">Total Transactions</p>
              <p className="text-lg font-semibold text-white">{formatNumber(totalTransactions)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-400">Liquidity Ratio</p>
              <p className="text-lg font-semibold text-white">
                {((reserveBalance / marketCap) * 100).toFixed(1)}%
              </p>
            </div>
          </div>
        </div>
      </div>

      <div className="bg-gradient-to-r from-indigo-900/20 to-purple-900/20 rounded-lg p-4 border border-indigo-800/50">
        <div className="flex items-center gap-3">
          <div className="p-2 bg-indigo-600/20 rounded-lg">
            <Activity className="w-5 h-5 text-indigo-400" />
          </div>
          <div>
            <p className="text-sm text-gray-300">
              Trading is live on the bonding curve. Once the market cap reaches $100k, 
              this token will automatically graduate to a decentralized exchange.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}