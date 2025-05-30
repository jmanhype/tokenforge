import { useState } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { toast } from "sonner";

export function CoinGenerator() {
  const [formData, setFormData] = useState({
    name: "",
    symbol: "",
    initialSupply: 1000000000,
    canMint: true,
    canBurn: false,
    postQuantumSecurity: false,
    description: "",
    blockchain: "ethereum" as "ethereum" | "solana" | "bsc",
  });
  
  const [showRevenueInfo, setShowRevenueInfo] = useState(false);
  const [showFairLaunchInfo, setShowFairLaunchInfo] = useState(false);

  const createCoin = useAction(api.memeCoins.createMemeCoin);
  const rateLimit = useQuery(api.memeCoins.checkRateLimit);
  const [showFeeInfo, setShowFeeInfo] = useState(false);
  const [isCreating, setIsCreating] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    
    if (!rateLimit?.canCreate) {
      toast.error("Rate limit exceeded. You can only create 3 coins per day.");
      return;
    }

    setIsCreating(true);
    
    try {
      const result = await createCoin(formData);
      
      if (result.fee > 0) {
        toast.info(`Fee: ${result.fee} ETH collected`);
      }
      
      toast.success(`🚀 ${formData.name} (${formData.symbol}) is being deployed!`);
      
      // Reset form
      setFormData({
        name: "",
        symbol: "",
        initialSupply: 1000000000,
        canMint: true,
        canBurn: false,
        postQuantumSecurity: false,
        description: "",
        blockchain: "ethereum",
      });
    } catch (error) {
      toast.error(error instanceof Error ? error.message : "Failed to create coin");
    } finally {
      setIsCreating(false);
    }
  };

  const handleInputChange = (field: string, value: any) => {
    setFormData(prev => ({ ...prev, [field]: value }));
  };

  return (
    <div className="max-w-2xl mx-auto">
      <div className="bg-white rounded-xl shadow-lg p-8">
        <div className="text-center mb-8">
          <h3 className="text-2xl font-bold text-gray-900 mb-2">
            🎯 Meme Coin Generator
          </h3>
          <p className="text-gray-600">
            Create your viral meme coin in just a few clicks
          </p>
          
          {rateLimit && (
            <div className="mt-4 p-3 bg-blue-50 rounded-lg">
              <p className="text-sm text-blue-700">
                📊 Rate Limit: {rateLimit.remaining}/3 coins remaining today
              </p>
            </div>
          )}
        </div>

        <form onSubmit={handleSubmit} className="space-y-6">
          {/* Basic Info */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Coin Name *
              </label>
              <input
                type="text"
                value={formData.name}
                onChange={(e) => handleInputChange("name", e.target.value)}
                placeholder="e.g., DogeCoin Supreme"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
                maxLength={50}
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Symbol *
              </label>
              <input
                type="text"
                value={formData.symbol}
                onChange={(e) => handleInputChange("symbol", e.target.value.toUpperCase())}
                placeholder="e.g., DOGES"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
                maxLength={10}
              />
            </div>
          </div>

          {/* Supply and Blockchain */}
          <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Initial Supply *
              </label>
              <input
                type="number"
                value={formData.initialSupply}
                onChange={(e) => handleInputChange("initialSupply", parseInt(e.target.value))}
                min="1"
                max="1000000000000000"
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
                required
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-2">
                Blockchain *
              </label>
              <select
                value={formData.blockchain}
                onChange={(e) => handleInputChange("blockchain", e.target.value)}
                className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              >
                <option value="ethereum">🔷 Ethereum</option>
                <option value="bsc">🟡 Binance Smart Chain</option>
                <option value="solana">🟣 Solana</option>
              </select>
            </div>
          </div>

          {/* Description */}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">
              Description (Optional)
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => handleInputChange("description", e.target.value)}
              placeholder="Tell the world about your meme coin..."
              rows={3}
              className="w-full px-4 py-3 border border-gray-300 rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              maxLength={500}
            />
          </div>

          {/* Features */}
          <div className="space-y-4">
            <h4 className="font-medium text-gray-900">Token Features</h4>
            
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canMint}
                  onChange={(e) => handleInputChange("canMint", e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div>
                  <div className="font-medium text-gray-900">🪙 Mintable</div>
                  <div className="text-sm text-gray-500">Create new tokens</div>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.canBurn}
                  onChange={(e) => handleInputChange("canBurn", e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div>
                  <div className="font-medium text-gray-900">🔥 Burnable</div>
                  <div className="text-sm text-gray-500">Destroy tokens</div>
                </div>
              </label>

              <label className="flex items-center space-x-3 p-4 border border-gray-200 rounded-lg hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={formData.postQuantumSecurity}
                  onChange={(e) => handleInputChange("postQuantumSecurity", e.target.checked)}
                  className="w-4 h-4 text-purple-600 border-gray-300 rounded focus:ring-purple-500"
                />
                <div>
                  <div className="font-medium text-gray-900">🔐 Post-Quantum</div>
                  <div className="text-sm text-gray-500">Future-proof security</div>
                </div>
              </label>
            </div>
          </div>

          {/* Submit Button */}
          <button
            type="submit"
            disabled={isCreating || !rateLimit?.canCreate}
            className="w-full bg-gradient-to-r from-purple-600 to-blue-600 text-white font-semibold py-4 px-6 rounded-lg hover:from-purple-700 hover:to-blue-700 transition-all disabled:opacity-50 disabled:cursor-not-allowed shadow-lg"
          >
            {isCreating ? (
              <span className="flex items-center justify-center gap-2">
                <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                Deploying Your Coin...
              </span>
            ) : (
              "🚀 Create & Deploy Coin"
            )}
          </button>
        </form>

        {/* Fee Information */}
        <div className="mt-6 p-4 bg-yellow-50 border border-yellow-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-yellow-900">Platform Fee</h4>
            <button
              type="button"
              onClick={() => setShowFeeInfo(!showFeeInfo)}
              className="text-sm text-yellow-700 hover:text-yellow-800"
            >
              {showFeeInfo ? "Hide" : "Show"} details
            </button>
          </div>
          <p className="text-sm text-yellow-800">
            Token creation: 0.01 ETH (testnet)
          </p>
          {showFeeInfo && (
            <div className="mt-2 text-xs text-yellow-700 space-y-1">
              <p>• Covers smart contract deployment gas</p>
              <p>• Funds platform development</p>
              <p>• Ensures serious creators only</p>
            </div>
          )}
        </div>
        
        {/* Revenue Sharing Information */}
        <div className="mt-4 p-4 bg-green-50 border border-green-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-green-900">💰 Revenue Sharing (New!)</h4>
            <button
              type="button"
              onClick={() => setShowRevenueInfo(!showRevenueInfo)}
              className="text-sm text-green-700 hover:text-green-800"
            >
              {showRevenueInfo ? "Hide" : "Show"} details
            </button>
          </div>
          <p className="text-sm text-green-800">
            Earn 1% on all token trades as the creator!
          </p>
          {showRevenueInfo && (
            <div className="mt-2 text-xs text-green-700 space-y-1">
              <p>• 1% creator fee on all bonding curve trades</p>
              <p>• 1% creator fee on all DEX trades (after graduation)</p>
              <p>• Real-time revenue tracking dashboard</p>
              <p>• Instant withdrawal to your wallet</p>
              <p>• Transparent on-chain accounting</p>
            </div>
          )}
        </div>
        
        {/* Fair Launch Information */}
        <div className="mt-4 p-4 bg-blue-50 border border-blue-200 rounded-lg">
          <div className="flex items-center justify-between mb-2">
            <h4 className="font-medium text-blue-900">⚡ Fair Launch Protection</h4>
            <button
              type="button"
              onClick={() => setShowFairLaunchInfo(!showFairLaunchInfo)}
              className="text-sm text-blue-700 hover:text-blue-800"
            >
              {showFairLaunchInfo ? "Hide" : "Show"} details
            </button>
          </div>
          <p className="text-sm text-blue-800">
            Anti-snipe & fair distribution mechanisms enabled by default
          </p>
          {showFairLaunchInfo && (
            <div className="mt-2 text-xs text-blue-700 space-y-1">
              <p>• Max 1% of supply per wallet</p>
              <p>• Max 0.5% per transaction</p>
              <p>• 5-minute cooldown between buys</p>
              <p>• 3-block anti-snipe protection</p>
              <p>• Bot protection & blacklist controls</p>
              <p>• Customizable after deployment</p>
            </div>
          )}
        </div>
        
        {/* Info Box */}
        <div className="mt-4 p-4 bg-gradient-to-r from-purple-50 to-blue-50 rounded-lg">
          <h4 className="font-medium text-gray-900 mb-2">🎯 What happens next?</h4>
          <ul className="text-sm text-gray-600 space-y-1">
            <li>• Smart contract deployment on your chosen blockchain</li>
            <li>• Automatic social media announcements</li>
            <li>• Real-time analytics tracking</li>
            <li>• Community building tools</li>
            <li>• Revenue sharing automatically enabled</li>
          </ul>
        </div>
      </div>
    </div>
  );
}
