import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { useState, useMemo } from "react";
import {
  LineChart,
  Line,
  AreaChart,
  Area,
  BarChart,
  Bar,
  PieChart,
  Pie,
  Cell,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
  RadarChart,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  Radar,
} from "recharts";
import {
  TrendingUp,
  TrendingDown,
  Users,
  DollarSign,
  Activity,
  BarChart2,
  PieChart as PieChartIcon,
  Clock,
  Zap,
  Target,
  AlertCircle,
  ExternalLink,
} from "lucide-react";
import { formatDistanceToNow } from "date-fns";

interface TokenAnalyticsProps {
  tokenId: Id<"memeCoins">;
}

export default function TokenAnalytics({ tokenId }: TokenAnalyticsProps) {
  const [timeRange, setTimeRange] = useState<"24h" | "7d" | "30d" | "all">("7d");
  const [chartType, setChartType] = useState<"price" | "volume" | "holders">("price");
  
  const token = useQuery(api.memeCoins.getCoinDetails, { coinId: tokenId });
  const analytics = useQuery(api.analytics.getTokenAnalytics, { 
    tokenId,
    timeRange,
  });
  const bondingCurve = useQuery(api.bondingCurveApi.getBondingCurve, { coinId: tokenId });
  const tradeHistory = useQuery(api.analytics.getTradeHistory, { 
    tokenId,
    limit: 100,
  });
  const holderDistribution = useQuery(api.analytics.getHolderDistribution, { tokenId });
  const socialMetrics = useQuery(api.analytics.getSocialMetrics, { tokenId });

  // Calculate metrics
  const metrics = useMemo(() => {
    if (!analytics || !token) return null;

    // Use the metrics directly from the analytics response
    const analyticsMetrics = analytics.metrics;
    if (!analyticsMetrics) return null;
    
    return {
      currentPrice: analyticsMetrics.price || 0,
      priceChange: analyticsMetrics.priceChange24h || 0,
      marketCap: analyticsMetrics.marketCap || 0,
      volume24h: analyticsMetrics.volume24h || 0,
      volumeTotal: analyticsMetrics.volume24h || 0, // Use 24h volume as total for now
      holders: analyticsMetrics.holders || 0,
      transactions: analyticsMetrics.transactions24h || 0,
      avgTransactionSize: (analyticsMetrics.volume24h || 0) / (analyticsMetrics.transactions24h || 1),
    };
  }, [analytics, token]);

  if (!token || !analytics || !metrics) {
    return (
      <div className="flex items-center justify-center h-96">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-indigo-600"></div>
      </div>
    );
  }

  const chartData = analytics.charts?.price?.map((d: any) => ({
    time: new Date(d.timestamp).toLocaleDateString(),
    price: d.price,
    volume: analytics.charts?.volume?.find((v: any) => v.timestamp === d.timestamp)?.volume || 0,
    holders: analytics.charts?.holders?.find((h: any) => h.timestamp === d.timestamp)?.holders || 0,
    marketCap: d.price * (analytics.metrics?.totalSupply || 1000000000),
  })) || [];

  const pieData = holderDistribution ? [
    { name: "Top 10", value: holderDistribution.top10Percentage, color: "#8884d8" },
    { name: "Top 11-50", value: holderDistribution.top50Percentage - holderDistribution.top10Percentage, color: "#82ca9d" },
    { name: "Others", value: 100 - holderDistribution.top50Percentage, color: "#ffc658" },
  ] : [];

  const radarData = socialMetrics ? [
    {
      metric: "Twitter",
      value: socialMetrics.twitterScore || 0,
      fullMark: 100,
    },
    {
      metric: "Discord",
      value: socialMetrics.discordScore || 0,
      fullMark: 100,
    },
    {
      metric: "Telegram",
      value: socialMetrics.telegramScore || 0,
      fullMark: 100,
    },
    {
      metric: "Holders",
      value: Math.min((metrics.holders / 1000) * 100, 100),
      fullMark: 100,
    },
    {
      metric: "Volume",
      value: Math.min((metrics.volume24h / 10000) * 100, 100),
      fullMark: 100,
    },
  ] : [];

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-4">
            <h2 className="text-2xl font-bold text-gray-900">
              {token.name} Analytics
            </h2>
            <span className="px-3 py-1 text-sm font-medium bg-gray-100 rounded-full">
              {token.symbol}
            </span>
          </div>
          
          <div className="flex gap-2">
            {(["24h", "7d", "30d", "all"] as const).map((range) => (
              <button
                key={range}
                onClick={() => setTimeRange(range)}
                className={`px-4 py-2 text-sm font-medium rounded-lg transition-colors ${
                  timeRange === range
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-100 text-gray-700 hover:bg-gray-200"
                }`}
              >
                {range === "all" ? "All Time" : range}
              </button>
            ))}
          </div>
        </div>

        {/* Key Metrics */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          <MetricCard
            title="Price"
            value={`$${metrics.currentPrice.toFixed(6)}`}
            change={metrics.priceChange}
            icon={<DollarSign className="w-5 h-5" />}
          />
          <MetricCard
            title="Market Cap"
            value={`$${formatNumber(metrics.marketCap)}`}
            icon={<TrendingUp className="w-5 h-5" />}
          />
          <MetricCard
            title="24h Volume"
            value={`$${formatNumber(metrics.volume24h)}`}
            icon={<Activity className="w-5 h-5" />}
          />
          <MetricCard
            title="Holders"
            value={metrics.holders.toLocaleString()}
            icon={<Users className="w-5 h-5" />}
          />
        </div>
      </div>

      {/* Main Chart */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-lg font-semibold text-gray-900">Price & Volume Chart</h3>
          <div className="flex gap-2">
            {(["price", "volume", "holders"] as const).map((type) => (
              <button
                key={type}
                onClick={() => setChartType(type)}
                className={`px-3 py-1 text-sm font-medium rounded-md transition-colors ${
                  chartType === type
                    ? "bg-indigo-100 text-indigo-700"
                    : "text-gray-600 hover:text-gray-900"
                }`}
              >
                {type.charAt(0).toUpperCase() + type.slice(1)}
              </button>
            ))}
          </div>
        </div>

        <ResponsiveContainer width="100%" height={400}>
          {chartType === "price" ? (
            <AreaChart data={chartData}>
              <defs>
                <linearGradient id="colorPrice" x1="0" y1="0" x2="0" y2="1">
                  <stop offset="5%" stopColor="#8884d8" stopOpacity={0.8}/>
                  <stop offset="95%" stopColor="#8884d8" stopOpacity={0}/>
                </linearGradient>
              </defs>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Area 
                type="monotone" 
                dataKey="price" 
                stroke="#8884d8" 
                fillOpacity={1} 
                fill="url(#colorPrice)" 
              />
            </AreaChart>
          ) : chartType === "volume" ? (
            <BarChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Bar dataKey="volume" fill="#82ca9d" />
            </BarChart>
          ) : (
            <LineChart data={chartData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="time" />
              <YAxis />
              <Tooltip />
              <Line type="monotone" dataKey="holders" stroke="#ffc658" strokeWidth={2} />
            </LineChart>
          )}
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Holder Distribution */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Holder Distribution</h3>
          {holderDistribution ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie
                    data={pieData}
                    cx="50%"
                    cy="50%"
                    labelLine={false}
                    label={({ name, percent }) => `${name} ${(percent * 100).toFixed(0)}%`}
                    outerRadius={100}
                    fill="#8884d8"
                    dataKey="value"
                  >
                    {pieData.map((entry, index) => (
                      <Cell key={`cell-${index}`} fill={entry.color} />
                    ))}
                  </Pie>
                  <Tooltip />
                </PieChart>
              </ResponsiveContainer>
              <div className="mt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Largest Holder</span>
                  <span className="font-medium">{(holderDistribution.largestHolder || 0).toFixed(2)}%</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-gray-600">Gini Coefficient</span>
                  <span className="font-medium">{(holderDistribution.giniCoefficient || 0).toFixed(3)}</span>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No holder data available
            </div>
          )}
        </div>

        {/* Social Metrics */}
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Social Metrics</h3>
          {socialMetrics ? (
            <>
              <ResponsiveContainer width="100%" height={300}>
                <RadarChart data={radarData}>
                  <PolarGrid />
                  <PolarAngleAxis dataKey="metric" />
                  <PolarRadiusAxis angle={90} domain={[0, 100]} />
                  <Radar 
                    name="Score" 
                    dataKey="value" 
                    stroke="#8884d8" 
                    fill="#8884d8" 
                    fillOpacity={0.6} 
                  />
                </RadarChart>
              </ResponsiveContainer>
              <div className="mt-4 grid grid-cols-2 gap-2">
                <div className="text-center">
                  <p className="text-2xl font-bold text-indigo-600">
                    {socialMetrics.totalShares}
                  </p>
                  <p className="text-sm text-gray-600">Total Shares</p>
                </div>
                <div className="text-center">
                  <p className="text-2xl font-bold text-green-600">
                    {(socialMetrics.sentimentScore || 0).toFixed(0)}%
                  </p>
                  <p className="text-sm text-gray-600">Positive Sentiment</p>
                </div>
              </div>
            </>
          ) : (
            <div className="flex items-center justify-center h-64 text-gray-500">
              No social data available
            </div>
          )}
        </div>
      </div>

      {/* Trading Activity */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Recent Trading Activity</h3>
        {tradeHistory && tradeHistory.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead>
                <tr>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Type
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Amount
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Price
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Total
                  </th>
                  <th className="px-4 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                    Time
                  </th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {tradeHistory.slice(0, 10).map((trade, index) => (
                  <tr key={index} className="hover:bg-gray-50">
                    <td className="px-4 py-3 whitespace-nowrap">
                      <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium ${
                        trade.type === "buy" ? "bg-green-100 text-green-800" : "bg-red-100 text-red-800"
                      }`}>
                        {trade.type.toUpperCase()}
                      </span>
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      {formatNumber(trade.tokenAmount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      ${(trade.price || 0).toFixed(6)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-900">
                      ${formatNumber(trade.ethAmount)}
                    </td>
                    <td className="px-4 py-3 whitespace-nowrap text-sm text-gray-500">
                      {formatDistanceToNow(new Date(trade.timestamp), { addSuffix: true })}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-8 text-gray-500">
            No trading activity yet
          </div>
        )}
      </div>

      {/* Bonding Curve Status */}
      {bondingCurve && (
        <div className="bg-white rounded-lg shadow-sm p-6">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Bonding Curve Status</h3>
          <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
            <div>
              <p className="text-sm text-gray-600 mb-1">Progress to DEX</p>
              <div className="w-full bg-gray-200 rounded-full h-2.5 mb-2">
                <div 
                  className="bg-indigo-600 h-2.5 rounded-full" 
                  style={{ width: `${Math.min(((bondingCurve.currentSupply || 0) / 800000000) * 100, 100)}%` }}
                ></div>
              </div>
              <p className="text-xs text-gray-500">
                {(((bondingCurve.currentSupply || 0) / 800000000) * 100).toFixed(1)}% Complete
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Reserve Balance</p>
              <p className="text-2xl font-bold text-gray-900">
                {(bondingCurve.reserveBalance || 0).toFixed(4)} ETH
              </p>
            </div>
            
            <div className="text-center">
              <p className="text-sm text-gray-600 mb-1">Current Price</p>
              <p className="text-2xl font-bold text-indigo-600">
                ${(bondingCurve.currentPrice || 0).toFixed(6)}
              </p>
            </div>
          </div>
          
          {bondingCurve.isActive && (bondingCurve.currentSupply || 0) >= 800000000 * 0.9 && (
            <div className="mt-4 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-center gap-2">
                <AlertCircle className="w-5 h-5 text-yellow-600" />
                <p className="text-sm text-yellow-800">
                  This token is close to graduating to Uniswap V3! 
                  Only {formatNumber(800000000 - bondingCurve.currentSupply)} tokens left.
                </p>
              </div>
            </div>
          )}
        </div>
      )}

      {/* Links */}
      <div className="bg-white rounded-lg shadow-sm p-6">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">External Links</h3>
        <div className="flex flex-wrap gap-4">
          {token.deployment && (
            <>
              <a
                href={getExplorerUrl(token.deployment.blockchain, token.deployment.contractAddress)}
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex items-center gap-2 px-4 py-2 bg-gray-100 text-gray-700 rounded-lg hover:bg-gray-200 transition-colors"
              >
                <ExternalLink className="w-4 h-4" />
                {token.deployment.blockchain === "ethereum" ? "Etherscan" : 
                 token.deployment.blockchain === "bsc" ? "BSCScan" : "Solscan"}
              </a>
              
              {bondingCurve?.dexPoolAddress && (
                <a
                  href={getDexUrl(token.deployment.blockchain, bondingCurve.dexPoolAddress)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 px-4 py-2 bg-indigo-100 text-indigo-700 rounded-lg hover:bg-indigo-200 transition-colors"
                >
                  <ExternalLink className="w-4 h-4" />
                  View on DEX
                </a>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
}

// Helper Components
interface MetricCardProps {
  title: string;
  value: string;
  change?: number;
  icon: React.ReactNode;
}

function MetricCard({ title, value, change, icon }: MetricCardProps) {
  return (
    <div className="bg-gray-50 rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm text-gray-600">{title}</span>
        <span className="text-gray-400">{icon}</span>
      </div>
      <p className="text-xl font-bold text-gray-900">{value}</p>
      {change !== undefined && (
        <div className={`flex items-center gap-1 mt-1 text-sm ${
          change >= 0 ? "text-green-600" : "text-red-600"
        }`}>
          {change >= 0 ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
          <span>{Math.abs(change).toFixed(2)}%</span>
        </div>
      )}
    </div>
  );
}

// Utility functions
function formatNumber(num: number): string {
  if (num >= 1e9) return (num / 1e9).toFixed(2) + "B";
  if (num >= 1e6) return (num / 1e6).toFixed(2) + "M";
  if (num >= 1e3) return (num / 1e3).toFixed(2) + "K";
  return num.toFixed(2);
}

function getExplorerUrl(blockchain: string, address: string): string {
  switch (blockchain) {
    case "ethereum":
      return `https://etherscan.io/address/${address}`;
    case "bsc":
      return `https://bscscan.com/address/${address}`;
    case "solana":
      return `https://solscan.io/account/${address}`;
    default:
      return "#";
  }
}

function getDexUrl(blockchain: string, poolAddress: string): string {
  switch (blockchain) {
    case "ethereum":
      return `https://app.uniswap.org/#/pool/${poolAddress}`;
    case "bsc":
      return `https://pancakeswap.finance/info/pool/${poolAddress}`;
    default:
      return "#";
  }
}