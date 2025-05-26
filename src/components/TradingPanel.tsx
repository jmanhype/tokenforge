import { useState } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Loader2, TrendingUp, TrendingDown, AlertCircle } from "lucide-react";
import { formatCurrency, formatNumber } from "../lib/utils";
import { toast } from "sonner";

interface TradingPanelProps {
  coinId: Id<"memeCoins">;
  currentPrice: number;
  reserveBalance: number;
  totalSupply: number;
  userBalance?: number;
  userTokenBalance?: number;
}

export function TradingPanel({
  coinId,
  currentPrice,
  reserveBalance,
  totalSupply,
  userBalance = 0,
  userTokenBalance = 0,
}: TradingPanelProps) {
  const [tradeType, setTradeType] = useState<"buy" | "sell">("buy");
  const [amount, setAmount] = useState("");
  const [slippage, setSlippage] = useState(1); // 1% default slippage
  const [isLoading, setIsLoading] = useState(false);

  const buyTokens = useMutation(api.bondingCurve.buy);
  const sellTokens = useMutation(api.bondingCurve.sell);

  // Calculate estimated output
  const calculateEstimate = () => {
    if (!amount || parseFloat(amount) <= 0) return null;

    const inputAmount = parseFloat(amount);
    
    if (tradeType === "buy") {
      // Estimate tokens received for USD input
      // This is a simplified calculation - actual calculation happens on backend
      const estimatedTokens = (inputAmount / currentPrice) * 0.98; // Account for 2% fees
      const priceImpact = (inputAmount / reserveBalance) * 100;
      
      return {
        output: estimatedTokens,
        priceImpact,
        outputLabel: "tokens",
        inputLabel: "USD",
      };
    } else {
      // Estimate USD received for token input
      const estimatedUSD = inputAmount * currentPrice * 0.98; // Account for 2% fees
      const priceImpact = (inputAmount / totalSupply) * 100;
      
      return {
        output: estimatedUSD,
        priceImpact,
        outputLabel: "USD",
        inputLabel: "tokens",
      };
    }
  };

  const estimate = calculateEstimate();
  const maxSlippage = slippage / 100;

  const handleTrade = async () => {
    if (!amount || parseFloat(amount) <= 0) {
      toast.error("Please enter a valid amount");
      return;
    }

    setIsLoading(true);

    try {
      if (tradeType === "buy") {
        const result = await buyTokens({
          coinId,
          amountInUSD: parseFloat(amount),
          minTokensOut: estimate ? estimate.output * (1 - maxSlippage) : 0,
        });

        if (result.success) {
          toast.success(
            `Bought ${formatNumber(result.tokensOut)} tokens for ${formatCurrency(
              result.amountIn
            )}`
          );
          setAmount("");
        } else {
          toast.error(result.error || "Transaction failed");
        }
      } else {
        const result = await sellTokens({
          coinId,
          tokenAmount: parseFloat(amount),
          minUSDOut: estimate ? estimate.output * (1 - maxSlippage) : 0,
        });

        if (result.success) {
          toast.success(
            `Sold ${formatNumber(result.tokensIn)} tokens for ${formatCurrency(
              result.amountOut
            )}`
          );
          setAmount("");
        } else {
          toast.error(result.error || "Transaction failed");
        }
      }
    } catch (error) {
      console.error("Trade error:", error);
      toast.error("Transaction failed. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="mb-6">
        <div className="flex gap-2 p-1 bg-gray-800 rounded-lg">
          <button
            onClick={() => setTradeType("buy")}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              tradeType === "buy"
                ? "bg-green-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <TrendingUp className="inline-block w-4 h-4 mr-2" />
            Buy
          </button>
          <button
            onClick={() => setTradeType("sell")}
            className={`flex-1 py-2 px-4 rounded-md font-medium transition-colors ${
              tradeType === "sell"
                ? "bg-red-600 text-white"
                : "text-gray-400 hover:text-white"
            }`}
          >
            <TrendingDown className="inline-block w-4 h-4 mr-2" />
            Sell
          </button>
        </div>
      </div>

      <div className="space-y-4">
        <div>
          <label className="block text-sm text-gray-400 mb-2">
            {tradeType === "buy" ? "Amount (USD)" : "Amount (Tokens)"}
          </label>
          <div className="relative">
            <input
              type="number"
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              placeholder="0.00"
              className="w-full bg-gray-800 text-white rounded-lg px-4 py-3 pr-20 focus:outline-none focus:ring-2 focus:ring-indigo-500"
            />
            <button
              onClick={() =>
                setAmount(
                  tradeType === "buy"
                    ? userBalance.toString()
                    : userTokenBalance.toString()
                )
              }
              className="absolute right-2 top-1/2 transform -translate-y-1/2 text-sm text-indigo-400 hover:text-indigo-300"
            >
              MAX
            </button>
          </div>
          <p className="mt-1 text-sm text-gray-400">
            Balance: {tradeType === "buy" 
              ? formatCurrency(userBalance)
              : formatNumber(userTokenBalance) + " tokens"
            }
          </p>
        </div>

        {estimate && parseFloat(amount) > 0 && (
          <div className="bg-gray-800 rounded-lg p-4 space-y-2">
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">You receive</span>
              <span className="text-white font-medium">
                ~{estimate.outputLabel === "USD" 
                  ? formatCurrency(estimate.output)
                  : formatNumber(estimate.output) + " " + estimate.outputLabel
                }
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Price impact</span>
              <span className={`font-medium ${
                estimate.priceImpact > 5 ? "text-red-400" : "text-green-400"
              }`}>
                {estimate.priceImpact.toFixed(2)}%
              </span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Platform fee</span>
              <span className="text-white">1%</span>
            </div>
            <div className="flex justify-between text-sm">
              <span className="text-gray-400">Creator fee</span>
              <span className="text-white">1%</span>
            </div>
          </div>
        )}

        <div>
          <label className="block text-sm text-gray-400 mb-2">
            Max Slippage
          </label>
          <div className="flex gap-2">
            {[0.5, 1, 2.5, 5].map((value) => (
              <button
                key={value}
                onClick={() => setSlippage(value)}
                className={`px-3 py-1 rounded-md text-sm font-medium transition-colors ${
                  slippage === value
                    ? "bg-indigo-600 text-white"
                    : "bg-gray-800 text-gray-400 hover:text-white"
                }`}
              >
                {value}%
              </button>
            ))}
            <input
              type="number"
              value={slippage}
              onChange={(e) => setSlippage(parseFloat(e.target.value) || 1)}
              className="flex-1 bg-gray-800 text-white rounded-md px-3 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              min="0.1"
              max="50"
              step="0.1"
            />
          </div>
        </div>

        {estimate && estimate.priceImpact > 10 && (
          <div className="flex items-start gap-2 p-3 bg-red-900/20 border border-red-800 rounded-lg">
            <AlertCircle className="w-5 h-5 text-red-400 flex-shrink-0 mt-0.5" />
            <div className="text-sm text-red-300">
              <p className="font-medium">High Price Impact Warning</p>
              <p className="mt-1 text-red-400">
                This trade will move the price by {estimate.priceImpact.toFixed(1)}%. 
                Consider trading a smaller amount.
              </p>
            </div>
          </div>
        )}

        <button
          onClick={handleTrade}
          disabled={!amount || parseFloat(amount) <= 0 || isLoading}
          className={`w-full py-3 px-4 rounded-lg font-medium transition-colors flex items-center justify-center gap-2 ${
            tradeType === "buy"
              ? "bg-green-600 hover:bg-green-700 disabled:bg-green-800"
              : "bg-red-600 hover:bg-red-700 disabled:bg-red-800"
          } text-white disabled:opacity-50 disabled:cursor-not-allowed`}
        >
          {isLoading ? (
            <>
              <Loader2 className="w-4 h-4 animate-spin" />
              Processing...
            </>
          ) : (
            <>
              {tradeType === "buy" ? <TrendingUp className="w-4 h-4" /> : <TrendingDown className="w-4 h-4" />}
              {tradeType === "buy" ? "Buy" : "Sell"} Tokens
            </>
          )}
        </button>
      </div>
    </div>
  );
}