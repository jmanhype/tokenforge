import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CoinCard } from "./CoinCard";

export function Dashboard() {
  const allCoins = useQuery(api.memeCoins.listMemeCoins, { limit: 50 });
  const analyticsData = useQuery(api.analytics.getAllCoinsAnalytics);

  if (allCoins === undefined || analyticsData === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const deployedCoins = allCoins.filter(coin => coin.status === "deployed");
  const totalMarketCap = analyticsData.reduce((sum, item) => sum + (item.analytics?.marketCap || 0), 0);
  const totalVolume = analyticsData.reduce((sum, item) => sum + (item.analytics?.volume24h || 0), 0);

  return (
    <div className="space-y-8">
      {/* Market Overview */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">📊 Market Overview</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{allCoins.length}</div>
            <div className="text-sm text-gray-600">Total Coins</div>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{deployedCoins.length}</div>
            <div className="text-sm text-gray-600">Deployed</div>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-blue-50 to-blue-100 rounded-lg">
            <div className="text-2xl font-bold text-blue-600">
              ${totalMarketCap.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm text-gray-600">Total Market Cap</div>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-orange-50 to-orange-100 rounded-lg">
            <div className="text-2xl font-bold text-orange-600">
              ${totalVolume.toLocaleString(undefined, { maximumFractionDigits: 0 })}
            </div>
            <div className="text-sm text-gray-600">24h Volume</div>
          </div>
        </div>
      </div>

      {/* Top Performers */}
      {analyticsData.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-4">🔥 Top Performers</h3>
          
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200">
                  <th className="text-left py-3 px-4 font-medium text-gray-700">Coin</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Price</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">24h Change</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Market Cap</th>
                  <th className="text-right py-3 px-4 font-medium text-gray-700">Volume</th>
                </tr>
              </thead>
              <tbody>
                {analyticsData
                  .sort((a, b) => (b.analytics?.priceChange24h || 0) - (a.analytics?.priceChange24h || 0))
                  .slice(0, 10)
                  .map((item) => (
                    <tr key={item.coin._id} className="border-b border-gray-100 hover:bg-gray-50">
                      <td className="py-3 px-4">
                        <div className="flex items-center gap-3">
                          <div className="w-8 h-8 bg-gradient-to-br from-purple-400 to-blue-400 rounded-full flex items-center justify-center text-white font-bold text-sm">
                            {item.coin.symbol.charAt(0)}
                          </div>
                          <div>
                            <div className="font-medium text-gray-900">{item.coin.name}</div>
                            <div className="text-sm text-gray-500">{item.coin.symbol}</div>
                          </div>
                        </div>
                      </td>
                      <td className="text-right py-3 px-4 font-mono">
                        ${item.analytics?.price.toFixed(6) || "0.000000"}
                      </td>
                      <td className="text-right py-3 px-4">
                        <span className={`font-medium ${
                          (item.analytics?.priceChange24h || 0) >= 0 ? "text-green-600" : "text-red-600"
                        }`}>
                          {(item.analytics?.priceChange24h || 0) >= 0 ? "+" : ""}
                          {(item.analytics?.priceChange24h || 0).toFixed(2)}%
                        </span>
                      </td>
                      <td className="text-right py-3 px-4 font-mono">
                        ${item.analytics?.marketCap.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
                      </td>
                      <td className="text-right py-3 px-4 font-mono">
                        ${item.analytics?.volume24h.toLocaleString(undefined, { maximumFractionDigits: 0 }) || "0"}
                      </td>
                    </tr>
                  ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* All Coins Grid */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-xl font-bold text-gray-900 mb-6">🪙 All Meme Coins</h3>
        
        {allCoins.length === 0 ? (
          <div className="text-center py-12">
            <div className="text-6xl mb-4">🚀</div>
            <h4 className="text-xl font-medium text-gray-900 mb-2">No coins yet!</h4>
            <p className="text-gray-600">Be the first to create a viral meme coin.</p>
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {allCoins.map((coin) => (
              <CoinCard key={coin._id} coin={coin} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
