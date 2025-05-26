import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { Id } from "@/convex/_generated/dataModel";
import { Loader2, CheckCircle, XCircle, AlertCircle, Clock } from "lucide-react";

interface DeploymentStatusProps {
  jobId?: Id<"jobs">;
  coinId: Id<"memeCoins">;
}

export function DeploymentStatus({ jobId, coinId }: DeploymentStatusProps) {
  const job = useQuery(api.jobQueue.getJob, jobId ? { jobId } : "skip");
  const coin = useQuery(api.memeCoins.get, { id: coinId });
  const deployment = useQuery(api.memeCoins.getDeployment, { coinId });

  if (!coin) return null;

  const getStatusIcon = () => {
    if (coin.status === "deployed") {
      return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
    if (coin.status === "failed") {
      return <XCircle className="h-5 w-5 text-red-500" />;
    }
    if (job?.status === "retrying") {
      return <AlertCircle className="h-5 w-5 text-yellow-500" />;
    }
    if (job?.status === "processing" || coin.status === "pending") {
      return <Loader2 className="h-5 w-5 animate-spin text-blue-500" />;
    }
    return <Clock className="h-5 w-5 text-gray-400" />;
  };

  const getStatusText = () => {
    if (coin.status === "deployed" && deployment) {
      return `Deployed to ${deployment.blockchain}`;
    }
    if (coin.status === "failed") {
      return job?.error || "Deployment failed";
    }
    if (job?.status === "retrying") {
      return `Retrying... (Attempt ${job.attempts}/${job.maxAttempts})`;
    }
    if (job?.status === "processing") {
      return "Deploying contract...";
    }
    if (job?.status === "queued") {
      return "Queued for deployment";
    }
    return "Preparing deployment...";
  };

  const getExplorerLink = () => {
    if (!deployment?.contractAddress) return null;

    const explorers = {
      ethereum: `https://etherscan.io/token/${deployment.contractAddress}`,
      bsc: `https://bscscan.com/token/${deployment.contractAddress}`,
      solana: `https://solscan.io/token/${deployment.contractAddress}`,
    };

    return explorers[deployment.blockchain as keyof typeof explorers];
  };

  return (
    <div className="flex items-center justify-between p-4 bg-gray-50 rounded-lg">
      <div className="flex items-center space-x-3">
        {getStatusIcon()}
        <div>
          <p className="text-sm font-medium text-gray-900">{getStatusText()}</p>
          {job && (
            <p className="text-xs text-gray-500">
              Job ID: {job._id.substring(0, 8)}...
            </p>
          )}
        </div>
      </div>

      {deployment?.contractAddress && (
        <div className="text-right">
          <p className="text-xs text-gray-500">Contract Address</p>
          <p className="text-sm font-mono">{deployment.contractAddress.substring(0, 10)}...</p>
          {getExplorerLink() && (
            <a
              href={getExplorerLink()!}
              target="_blank"
              rel="noopener noreferrer"
              className="text-xs text-blue-600 hover:text-blue-800"
            >
              View on Explorer →
            </a>
          )}
        </div>
      )}

      {deployment?.deploymentCost && (
        <div className="text-right">
          <p className="text-xs text-gray-500">Cost</p>
          <p className="text-sm font-medium">${deployment.deploymentCost.toFixed(4)}</p>
        </div>
      )}
    </div>
  );
}