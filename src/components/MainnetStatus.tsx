import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Shield, AlertTriangle, CheckCircle, XCircle, Loader } from "lucide-react";
import { useState } from "react";

export default function MainnetStatus() {
  const [selectedNetwork, setSelectedNetwork] = useState<"ethereum" | "bsc" | "solana">("ethereum");
  const readiness = useQuery(api.config.mainnetConfig.checkMainnetReadiness);
  const networkConfig = useQuery(api.config.mainnetConfig.getMainnetConfig, { 
    blockchain: selectedNetwork 
  });

  if (!readiness || !networkConfig) {
    return (
      <div className="flex items-center justify-center p-8">
        <Loader className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const getScoreColor = (percentage: number) => {
    if (percentage >= 80) return "text-green-600";
    if (percentage >= 60) return "text-yellow-600";
    return "text-red-600";
  };

  const getScoreIcon = (percentage: number) => {
    if (percentage >= 80) return <CheckCircle className="w-5 h-5 text-green-500" />;
    if (percentage >= 60) return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
    return <XCircle className="w-5 h-5 text-red-500" />;
  };

  return (
    <div className="bg-white rounded-lg shadow-lg p-6">
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-3">
          <Shield className="w-8 h-8 text-indigo-600" />
          <div>
            <h2 className="text-2xl font-bold text-gray-900">Mainnet Configuration</h2>
            <p className="text-sm text-gray-600">
              {readiness.isReady ? "Ready for mainnet deployment" : "Additional configuration required"}
            </p>
          </div>
        </div>
        <div className={`text-3xl font-bold ${getScoreColor(readiness.overallScore.percentage)}`}>
          {readiness.overallScore.percentage}%
        </div>
      </div>

      {/* Network Selector */}
      <div className="flex gap-2 mb-6">
        {(["ethereum", "bsc", "solana"] as const).map((network) => (
          <button
            key={network}
            onClick={() => setSelectedNetwork(network)}
            className={`px-4 py-2 rounded-lg font-medium transition-colors ${
              selectedNetwork === network
                ? "bg-indigo-600 text-white"
                : "bg-gray-100 text-gray-700 hover:bg-gray-200"
            }`}
          >
            {network.toUpperCase()}
          </button>
        ))}
      </div>

      {/* Network Configuration Status */}
      <div className="bg-gray-50 rounded-lg p-4 mb-6">
        <h3 className="font-semibold text-gray-900 mb-3">
          {selectedNetwork.toUpperCase()} Configuration
        </h3>
        
        {networkConfig.enabled ? (
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <span className="text-sm text-gray-600">Status</span>
              <span className={`text-sm font-medium ${
                networkConfig.isConfigured ? "text-green-600" : "text-red-600"
              }`}>
                {networkConfig.isConfigured ? "Configured" : "Not Configured"}
              </span>
            </div>
            
            {networkConfig.warnings && networkConfig.warnings.length > 0 && (
              <div className="mt-3 space-y-1">
                {networkConfig.warnings.map((warning, index) => (
                  <div key={index} className="flex items-start gap-2 text-sm text-yellow-600">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0 mt-0.5" />
                    <span>{warning}</span>
                  </div>
                ))}
              </div>
            )}
            
            {networkConfig.fees && (
              <div className="mt-3 pt-3 border-t border-gray-200">
                <h4 className="text-sm font-medium text-gray-700 mb-2">Fee Configuration</h4>
                <div className="space-y-1 text-sm">
                  <div className="flex justify-between">
                    <span className="text-gray-600">Token Creation</span>
                    <span className="font-mono">{networkConfig.fees.tokenCreation} {selectedNetwork === "solana" ? "SOL" : selectedNetwork === "ethereum" ? "ETH" : "BNB"}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">Trading Fee</span>
                    <span className="font-mono">{networkConfig.fees.bondingCurveTrade}%</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-gray-600">DEX Graduation</span>
                    <span className="font-mono">{networkConfig.fees.dexGraduation} {selectedNetwork === "solana" ? "SOL" : selectedNetwork === "ethereum" ? "ETH" : "BNB"}</span>
                  </div>
                </div>
              </div>
            )}
          </div>
        ) : (
          <div className="text-center py-4">
            <AlertTriangle className="w-12 h-12 text-yellow-500 mx-auto mb-2" />
            <p className="text-sm text-gray-600">Mainnet deployment is currently disabled</p>
            <p className="text-xs text-gray-500 mt-1">Set VITE_USE_TESTNET=false to enable</p>
          </div>
        )}
      </div>

      {/* Readiness Scores */}
      <div className="space-y-4">
        <h3 className="font-semibold text-gray-900">Readiness Checklist</h3>
        
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {Object.entries(readiness.scores).map(([category, score]) => (
            <div key={category} className="bg-gray-50 rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h4 className="font-medium text-gray-900 capitalize">
                  {category.replace(/([A-Z])/g, " $1").trim()}
                </h4>
                {getScoreIcon(score.percentage)}
              </div>
              <div className="relative w-full h-2 bg-gray-200 rounded-full overflow-hidden">
                <div
                  className={`absolute left-0 top-0 h-full transition-all duration-500 ${
                    score.percentage >= 80 ? "bg-green-500" :
                    score.percentage >= 60 ? "bg-yellow-500" : "bg-red-500"
                  }`}
                  style={{ width: `${score.percentage}%` }}
                />
              </div>
              <p className="text-xs text-gray-600 mt-1">
                {score.passed} of {score.total} checks passed
              </p>
            </div>
          ))}
        </div>
      </div>

      {/* Recommendations */}
      {readiness.recommendations && readiness.recommendations.length > 0 && (
        <div className="mt-6 bg-yellow-50 border border-yellow-200 rounded-lg p-4">
          <h4 className="font-medium text-yellow-900 mb-2 flex items-center gap-2">
            <AlertTriangle className="w-5 h-5" />
            Recommendations
          </h4>
          <ul className="space-y-1">
            {readiness.recommendations.map((rec, index) => (
              <li key={index} className="text-sm text-yellow-800 flex items-start gap-2">
                <span className="text-yellow-600 mt-0.5">•</span>
                <span>{rec}</span>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* Deploy Button */}
      <div className="mt-6 flex justify-end">
        <button
          disabled={!readiness.isReady}
          className={`px-6 py-3 rounded-lg font-medium transition-colors ${
            readiness.isReady
              ? "bg-indigo-600 text-white hover:bg-indigo-700"
              : "bg-gray-300 text-gray-500 cursor-not-allowed"
          }`}
        >
          {readiness.isReady ? "Deploy to Mainnet" : "Configuration Incomplete"}
        </button>
      </div>
    </div>
  );
}