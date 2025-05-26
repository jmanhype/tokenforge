import { useState, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { toast } from "sonner";
import { ArrowUpDown, TrendingUp, TrendingDown, Info, AlertCircle, Wallet } from "lucide-react";
import { Line } from "react-chartjs-2";
import { web3Service } from "../lib/web3";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface TradingInterfaceProps {
  coinId: Id<"memeCoins">;
}

export default function TradingInterface({ coinId }: TradingInterfaceProps) {
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1); // 1% default slippage
  const [showSlippageSettings, setShowSlippageSettings] = useState(false);
  const [walletConnected, setWalletConnected] = useState(false);
  const [walletAddress, setWalletAddress] = useState<string | null>(null);
  const [isProcessing, setIsProcessing] = useState(false);

  // Get bonding curve data
  const bondingCurve = useQuery(api.bondingCurve.getBondingCurve, { tokenId: coinId });
  const coin = useQuery(api.memeCoins.getById, { coinId });
  const user = useQuery(api.auth.loggedInUser);
  const userHoldings = useQuery(
    api.bondingCurve.getUserHoldings,
    user ? { coinId, userId: user._id } : "skip"
  );
  
  // Check fair launch restrictions
  const fairLaunchCheck = useQuery(
    api.fairLaunch.checkPurchaseAllowed,
    user && amount && parseFloat(amount) > 0 && tradeType === "buy" && buyPreview
      ? { tokenId: coinId, buyer: user.email || "", amount: buyPreview.tokensReceived }
      : "skip"
  );

  // Calculate buy/sell amounts
  const buyPreview = useQuery(
    api.bondingCurve.calculateBuyAmount,
    bondingCurve && amount && parseFloat(amount) > 0
      ? { tokenId: coinId, amountInUSD: parseFloat(amount) }
      : "skip"
  );

  const sellPreview = useQuery(
    api.bondingCurve.calculateSellReturn,
    bondingCurve && amount && parseFloat(amount) > 0 && tradeType === "sell"
      ? { tokenId: coinId, tokenAmount: parseFloat(amount) }
      : "skip"
  );

  // Trading mutations
  const buyTokens = useMutation(api.bondingCurve.buyTokens);
  const sellTokens = useMutation(api.bondingCurve.sellTokens);

  // Check wallet connection on mount
  useEffect(() => {
    checkWalletConnection();
  }, []);

  const checkWalletConnection = async () => {
    const address = await web3Service.getAddress();
    if (address) {
      setWalletConnected(true);
      setWalletAddress(address);
    }
  };

  const connectWallet = async () => {
    try {
      const address = await web3Service.connect();
      setWalletConnected(true);
      setWalletAddress(address);
      toast.success("Wallet connected successfully");
    } catch (error: any) {
      toast.error(error.message || "Failed to connect wallet");
    }
  };

  if (!bondingCurve || !coin) {
    return (
      <div className="bg-white rounded-xl shadow-lg p-6">
        <div className="animate-pulse">
          <div className="h-8 bg-gray-200 rounded w-1/3 mb-4"></div>
          <div className="h-64 bg-gray-200 rounded"></div>
        </div>
      </div>
    );
  }

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    if (!walletConnected) {
      toast.error("Please connect your wallet first");
      return;
    }

    setIsProcessing(true);

    try {
      if (tradeType === "buy") {
        // Get transaction data from backend
        const result = await buyTokens({
          tokenId: coinId,
          ethAmount: parseFloat(amount),
        });

        // Execute blockchain transaction
        const txHash = await web3Service.executeTransaction(result.txData);
        
        toast.success(
          <div>
            <p>Successfully bought ~{result.expectedTokens} {coin.symbol}</p>
            <a 
              href={`https://sepolia.etherscan.io/tx/${txHash}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 underline text-sm"
            >
              View transaction
            </a>
          </div>
        );
      } else {
        // For sell, need to approve token first
        const deployment = await api.memeCoins.getDeployment({ coinId });
        if (!deployment || !bondingCurve.contractAddress) {
          throw new Error("Contract addresses not found");
        }

        // Approve bonding curve to spend tokens
        await web3Service.approveToken(
          deployment.contractAddress,
          bondingCurve.contractAddress,
          amount
        );

        // Get sell transaction data
        const result = await sellTokens({
          tokenId: coinId,
          tokenAmount: parseFloat(amount),
        });

        // Execute blockchain transaction
        const txHash = await web3Service.executeTransaction(result.txData);
        
        toast.success(
          <div>
            <p>Successfully sold for ~{result.expectedEth} ETH</p>
            <a 
              href={`https://sepolia.etherscan.io/tx/${txHash}`} 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-blue-500 underline text-sm"
            >
              View transaction
            </a>
          </div>
        );
      }
      setAmount("");
    } catch (error: any) {
      toast.error(error.message || "Transaction failed");
    } finally {
      setIsProcessing(false);
    }
  };

  const currentPrice = bondingCurve.currentPrice || 0;
  const marketCap = (bondingCurve.currentSupply * currentPrice) || 0;
  const graduationProgress = (marketCap / 100000) * 100; // $100k graduation target

  return (
    <div className="space-y-6">
      {/* Trading Card */}
      <div className="bg-white rounded-xl shadow-lg overflow-hidden">
        {/* Header */}
        <div className="bg-gradient-to-r from-purple-600 to-blue-600 text-white p-6">
          <div className="flex justify-between items-start">
            <div>
              <h2 className="text-2xl font-bold flex items-center gap-2">
                {coin.name}
                <span className="text-sm bg-white/20 px-2 py-1 rounded">
                  {coin.symbol}
                </span>
              </h2>
              <p className="text-xl mt-2">
                ${currentPrice.toFixed(6)}
                <span className={`text-sm ml-2 ${bondingCurve.priceChange24h >= 0 ? "text-green-300" : "text-red-300"}`}>
                  {bondingCurve.priceChange24h >= 0 ? "+" : ""}
                  {(bondingCurve.priceChange24h || 0).toFixed(2)}%
                </span>
              </p>
            </div>
            <div className="text-right">
              <p className="text-sm opacity-80">Market Cap</p>
              <p className="text-xl font-bold">${marketCap.toLocaleString()}</p>
              {walletConnected && (
                <p className="text-xs opacity-70 mt-1">
                  {walletAddress?.slice(0, 6)}...{walletAddress?.slice(-4)}
                </p>
              )}
            </div>
          </div>
        </div>

        {/* Graduation Progress */}
        <div className="px-6 py-4 bg-gradient-to-r from-purple-50 to-blue-50">
          <div className="flex justify-between items-center mb-2">
            <span className="text-sm font-medium text-gray-700">
              Graduation Progress
            </span>
            <span className="text-sm font-bold text-purple-600">
              {graduationProgress.toFixed(1)}%
            </span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div
              className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full transition-all duration-500"
              style={{ width: `${Math.min(graduationProgress, 100)}%` }}
            />
          </div>
          <p className="text-xs text-gray-600 mt-1">
            Graduates to DEX at $100,000 market cap
          </p>
        </div>

        {/* Trading Form */}
        <div className="p-6">
          {/* Trade Type Selector */}
          <div className="flex gap-2 mb-6">
            <button
              onClick={() => setTradeType("buy")}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                tradeType === "buy"
                  ? "bg-green-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Buy
            </button>
            <button
              onClick={() => setTradeType("sell")}
              className={`flex-1 py-3 px-4 rounded-lg font-medium transition-all ${
                tradeType === "sell"
                  ? "bg-red-500 text-white"
                  : "bg-gray-100 text-gray-700 hover:bg-gray-200"
              }`}
            >
              Sell
            </button>
          </div>

          {/* Amount Input */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-700 mb-2">
              {tradeType === "buy" ? "ETH Amount" : "Token Amount"}
            </label>
            <div className="relative">
              <input
                type="number"
                value={amount}
                onChange={(e) => setAmount(e.target.value)}
                placeholder="0.0"
                className="w-full px-4 py-3 border rounded-lg focus:ring-2 focus:ring-purple-500 focus:border-transparent"
              />
              <span className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500">
                {tradeType === "buy" ? "ETH" : coin.symbol}
              </span>
            </div>
            {userHoldings && tradeType === "sell" && (
              <p className="text-xs text-gray-600 mt-1">
                Balance: {userHoldings.balance.toLocaleString()} {coin.symbol}
              </p>
            )}
          </div>

          {/* Preview */}
          {amount && parseFloat(amount) > 0 && (
            <div className="bg-gray-50 rounded-lg p-4 mb-4">
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">You will receive</span>
                <span className="font-medium">
                  {tradeType === "buy"
                    ? `${(buyPreview?.tokensOut || 0).toLocaleString()} ${coin.symbol}`
                    : `${(sellPreview?.amountOut || 0).toFixed(4)} ETH`}
                </span>
              </div>
              <div className="flex justify-between items-center mb-2">
                <span className="text-sm text-gray-600">Average Price</span>
                <span className="font-medium">
                  ${(tradeType === "buy" ? buyPreview?.avgPrice : sellPreview?.avgPrice || 0).toFixed(6)}
                </span>
              </div>
              <div className="flex justify-between items-center">
                <span className="text-sm text-gray-600">Price Impact</span>
                <span className={`font-medium ${
                  (tradeType === "buy" ? buyPreview?.priceImpact : sellPreview?.priceImpact || 0) > 5
                    ? "text-red-600"
                    : "text-green-600"
                }`}>
                  {(tradeType === "buy" ? buyPreview?.priceImpact : sellPreview?.priceImpact || 0).toFixed(2)}%
                </span>
              </div>
            </div>
          )}

          {/* Slippage Settings */}
          <div className="mb-4">
            <button
              onClick={() => setShowSlippageSettings(!showSlippageSettings)}
              className="text-sm text-purple-600 hover:text-purple-700 flex items-center gap-1"
            >
              <Info className="w-4 h-4" />
              Slippage Tolerance: {slippage}%
            </button>
            {showSlippageSettings && (
              <div className="mt-2 p-3 bg-purple-50 rounded-lg">
                <div className="flex gap-2">
                  {[0.5, 1, 2, 5].map((value) => (
                    <button
                      key={value}
                      onClick={() => setSlippage(value)}
                      className={`px-3 py-1 rounded text-sm ${
                        slippage === value
                          ? "bg-purple-600 text-white"
                          : "bg-white text-gray-700 hover:bg-gray-100"
                      }`}
                    >
                      {value}%
                    </button>
                  ))}
                </div>
              </div>
            )}
          </div>

          {/* Fair Launch Warning */}
          {fairLaunchCheck && !fairLaunchCheck.allowed && tradeType === "buy" && (
            <div className="mb-4 p-3 bg-yellow-50 border border-yellow-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-yellow-800">
                <p className="font-medium">Fair Launch Restriction</p>
                <p>{fairLaunchCheck.reason}</p>
              </div>
            </div>
          )}

          {/* Trade Button */}
          {!walletConnected ? (
            <button
              onClick={connectWallet}
              className="w-full py-4 rounded-lg font-bold text-white bg-gradient-to-r from-purple-500 to-blue-600 hover:from-purple-600 hover:to-blue-700 transition-all flex items-center justify-center gap-2"
            >
              <Wallet className="w-5 h-5" />
              Connect Wallet
            </button>
          ) : (
            <button
              onClick={handleTrade}
              disabled={!amount || parseFloat(amount) <= 0 || isProcessing || (fairLaunchCheck && !fairLaunchCheck.allowed && tradeType === "buy")}
              className={`w-full py-4 rounded-lg font-bold text-white transition-all ${
                tradeType === "buy"
                  ? "bg-gradient-to-r from-green-500 to-green-600 hover:from-green-600 hover:to-green-700"
                  : "bg-gradient-to-r from-red-500 to-red-600 hover:from-red-600 hover:to-red-700"
              } disabled:opacity-50 disabled:cursor-not-allowed`}
            >
              {isProcessing ? (
                <span className="flex items-center justify-center gap-2">
                  <div className="animate-spin rounded-full h-5 w-5 border-b-2 border-white"></div>
                  Processing...
                </span>
              ) : (
                `${tradeType === "buy" ? "Buy" : "Sell"} ${coin.symbol}`
              )}
            </button>
          )}

          {/* High Price Impact Warning */}
          {amount && parseFloat(amount) > 0 && 
           (tradeType === "buy" ? buyPreview?.priceImpact : sellPreview?.priceImpact || 0) > 5 && (
            <div className="mt-4 p-3 bg-red-50 border border-red-200 rounded-lg flex items-start gap-2">
              <AlertCircle className="w-5 h-5 text-red-600 flex-shrink-0 mt-0.5" />
              <div className="text-sm text-red-800">
                <p className="font-medium">High Price Impact!</p>
                <p>This trade will significantly move the price. Consider reducing the amount.</p>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">24h Volume</p>
          <p className="text-xl font-bold">${(bondingCurve.volume24h || 0).toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">Total Supply</p>
          <p className="text-xl font-bold">{bondingCurve.currentSupply.toLocaleString()}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">Holders</p>
          <p className="text-xl font-bold">{bondingCurve.holders}</p>
        </div>
        <div className="bg-white rounded-lg p-4 shadow">
          <p className="text-sm text-gray-600">ETH Reserve</p>
          <p className="text-xl font-bold">{(bondingCurve.reserveBalance || 0).toFixed(4)} ETH</p>
        </div>
      </div>

      {/* User Holdings */}
      {userHoldings && userHoldings.balance > 0 && (
        <div className="bg-white rounded-xl shadow-lg p-6">
          <h3 className="text-lg font-bold mb-4">Your Position</h3>
          <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
            <div>
              <p className="text-sm text-gray-600">Balance</p>
              <p className="font-medium">{userHoldings.balance.toLocaleString()} {coin.symbol}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Value</p>
              <p className="font-medium">${userHoldings.currentValue.toFixed(2)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Avg Buy Price</p>
              <p className="font-medium">${userHoldings.averageBuyPrice.toFixed(6)}</p>
            </div>
            <div>
              <p className="text-sm text-gray-600">Unrealized P&L</p>
              <p className={`font-medium ${userHoldings.unrealizedPnL >= 0 ? "text-green-600" : "text-red-600"}`}>
                {userHoldings.unrealizedPnL >= 0 ? "+" : ""}{userHoldings.unrealizedPnL.toFixed(2)} 
                ({userHoldings.unrealizedPnLPercent.toFixed(2)}%)
              </p>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}