import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { CoinCard } from "./CoinCard";

export function UserCoins() {
  const userCoins = useQuery(api.memeCoins.getUserMemeCoins);

  if (userCoins === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  const deployedCoins = userCoins.filter(coin => coin.status === "deployed");
  const pendingCoins = userCoins.filter(coin => coin.status === "pending");
  const failedCoins = userCoins.filter(coin => coin.status === "failed");

  return (
    <div className="space-y-8">
      {/* Stats Overview */}
      <div className="bg-white rounded-xl shadow-lg p-6">
        <h3 className="text-2xl font-bold text-gray-900 mb-6">💎 Your Portfolio</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-4 gap-6">
          <div className="text-center p-4 bg-gradient-to-br from-purple-50 to-purple-100 rounded-lg">
            <div className="text-2xl font-bold text-purple-600">{userCoins.length}</div>
            <div className="text-sm text-gray-600">Total Created</div>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-green-50 to-green-100 rounded-lg">
            <div className="text-2xl font-bold text-green-600">{deployedCoins.length}</div>
            <div className="text-sm text-gray-600">Successfully Deployed</div>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-yellow-50 to-yellow-100 rounded-lg">
            <div className="text-2xl font-bold text-yellow-600">{pendingCoins.length}</div>
            <div className="text-sm text-gray-600">Pending Deployment</div>
          </div>
          
          <div className="text-center p-4 bg-gradient-to-br from-red-50 to-red-100 rounded-lg">
            <div className="text-2xl font-bold text-red-600">{failedCoins.length}</div>
            <div className="text-sm text-gray-600">Failed Deployments</div>
          </div>
        </div>
      </div>

      {/* Coins by Status */}
      {deployedCoins.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">🚀 Deployed Coins</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {deployedCoins.map((coin) => (
              <CoinCard key={coin._id} coin={coin} showAnalytics />
            ))}
          </div>
        </div>
      )}

      {pendingCoins.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">⏳ Pending Deployment</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {pendingCoins.map((coin) => (
              <CoinCard key={coin._id} coin={coin} />
            ))}
          </div>
        </div>
      )}

      {failedCoins.length > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-xl font-bold text-gray-900 mb-6">❌ Failed Deployments</h3>
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {failedCoins.map((coin) => (
              <CoinCard key={coin._id} coin={coin} />
            ))}
          </div>
        </div>
      )}

      {userCoins.length === 0 && (
        <div className="bg-white rounded-xl shadow-lg p-12 text-center">
          <div className="text-6xl mb-4">🎯</div>
          <h3 className="text-2xl font-bold text-gray-900 mb-2">No coins created yet</h3>
          <p className="text-gray-600 mb-6">Start your meme coin empire today!</p>
          <button
            onClick={() => window.location.reload()}
            className="bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-3 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all"
          >
            Create Your First Coin
          </button>
        </div>
      )}
    </div>
  );
}
