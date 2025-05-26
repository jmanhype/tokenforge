import { formatDistanceToNow } from "date-fns";
import { TrendingUp, TrendingDown, Sparkles, ExternalLink } from "lucide-react";
import { formatCurrency, formatNumber, truncateAddress } from "../lib/utils";

interface Transaction {
  _id: string;
  type: "buy" | "sell" | "launch" | "graduation";
  user: string;
  amount: number;
  tokens: number;
  price: number;
  timestamp: number;
  txHash?: string;
}

interface TransactionHistoryProps {
  transactions: Transaction[];
  blockchain?: string;
}

export function TransactionHistory({ transactions, blockchain = "ethereum" }: TransactionHistoryProps) {
  const getExplorerUrl = (txHash: string) => {
    const explorers: Record<string, string> = {
      ethereum: `https://etherscan.io/tx/${txHash}`,
      bsc: `https://bscscan.com/tx/${txHash}`,
      solana: `https://solscan.io/tx/${txHash}`,
    };
    return explorers[blockchain] || "#";
  };

  const getTransactionIcon = (type: Transaction["type"]) => {
    switch (type) {
      case "buy":
        return <TrendingUp className="w-4 h-4 text-green-400" />;
      case "sell":
        return <TrendingDown className="w-4 h-4 text-red-400" />;
      case "launch":
        return <Sparkles className="w-4 h-4 text-yellow-400" />;
      case "graduation":
        return <Sparkles className="w-4 h-4 text-purple-400" />;
    }
  };

  const getTransactionColor = (type: Transaction["type"]) => {
    switch (type) {
      case "buy":
        return "text-green-400";
      case "sell":
        return "text-red-400";
      case "launch":
        return "text-yellow-400";
      case "graduation":
        return "text-purple-400";
    }
  };

  const getTransactionText = (tx: Transaction) => {
    switch (tx.type) {
      case "buy":
        return `bought ${formatNumber(tx.tokens)} tokens`;
      case "sell":
        return `sold ${formatNumber(tx.tokens)} tokens`;
      case "launch":
        return "launched token";
      case "graduation":
        return "graduated to DEX";
    }
  };

  if (transactions.length === 0) {
    return (
      <div className="bg-gray-900 rounded-lg p-8 text-center">
        <p className="text-gray-400">No transactions yet. Be the first to trade!</p>
      </div>
    );
  }

  return (
    <div className="bg-gray-900 rounded-lg overflow-hidden">
      <div className="p-4 border-b border-gray-800">
        <h3 className="text-lg font-semibold text-white">Recent Transactions</h3>
      </div>
      
      <div className="divide-y divide-gray-800">
        {transactions.map((tx) => (
          <div
            key={tx._id}
            className="p-4 hover:bg-gray-800/50 transition-colors"
          >
            <div className="flex items-start gap-3">
              <div className="p-2 bg-gray-800 rounded-lg">
                {getTransactionIcon(tx.type)}
              </div>
              
              <div className="flex-1 min-w-0">
                <div className="flex items-baseline gap-2 flex-wrap">
                  <span className="text-sm text-gray-300">
                    {truncateAddress(tx.user)}
                  </span>
                  <span className={`text-sm font-medium ${getTransactionColor(tx.type)}`}>
                    {getTransactionText(tx)}
                  </span>
                </div>
                
                <div className="mt-1 flex items-center gap-4 text-xs text-gray-400">
                  <span>
                    {tx.type === "buy" || tx.type === "sell" ? (
                      <>
                        {formatCurrency(tx.amount)} @ {formatCurrency(tx.price)}
                      </>
                    ) : (
                      "—"
                    )}
                  </span>
                  <span>
                    {formatDistanceToNow(new Date(tx.timestamp), { addSuffix: true })}
                  </span>
                </div>
              </div>
              
              {tx.txHash && (
                <a
                  href={getExplorerUrl(tx.txHash)}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="p-2 text-gray-400 hover:text-white hover:bg-gray-800 rounded-lg transition-colors"
                  title="View on explorer"
                >
                  <ExternalLink className="w-4 h-4" />
                </a>
              )}
            </div>
          </div>
        ))}
      </div>
      
      <div className="p-4 border-t border-gray-800">
        <button className="text-sm text-indigo-400 hover:text-indigo-300 font-medium">
          View all transactions →
        </button>
      </div>
    </div>
  );
}