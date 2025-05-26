import { useState, useEffect } from "react";
import { useAction, useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Id } from "../../convex/_generated/dataModel";
import { Button } from "@/components/ui/button";
import { Progress } from "@/components/ui/progress";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { CheckCircle2, TrendingUp, Users, DollarSign, Activity } from "lucide-react";

interface GraduationStatusProps {
  tokenId: Id<"memeCoins">;
}

export function GraduationStatus({ tokenId }: GraduationStatusProps) {
  const [isChecking, setIsChecking] = useState(false);
  const [eligibility, setEligibility] = useState<any>(null);
  const [isGraduating, setIsGraduating] = useState(false);
  
  const checkEligibility = useAction(api.dex.graduation.checkGraduationEligibility);
  const graduateToken = useAction(api.dex.graduation.graduateToken);
  
  const handleCheckEligibility = async () => {
    setIsChecking(true);
    try {
      const result = await checkEligibility({ tokenId });
      setEligibility(result);
    } catch (error) {
      console.error("Failed to check eligibility:", error);
    } finally {
      setIsChecking(false);
    }
  };
  
  const handleGraduate = async (targetDex: "uniswap" | "pancakeswap") => {
    setIsGraduating(true);
    try {
      const result = await graduateToken({ 
        tokenId, 
        targetDex,
        liquidityPercentage: 80 // Use 80% of reserves for initial liquidity
      });
      
      // Show success message
      alert(`Graduation initiated! Transaction ID: ${result.graduationId}`);
      
      // Refresh eligibility
      await handleCheckEligibility();
    } catch (error) {
      console.error("Failed to graduate token:", error);
      alert("Failed to graduate token: " + (error as Error).message);
    } finally {
      setIsGraduating(false);
    }
  };
  
  useEffect(() => {
    handleCheckEligibility();
  }, [tokenId]);
  
  if (!eligibility) {
    return (
      <div className="animate-pulse">
        <div className="h-32 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }
  
  const metrics = [
    {
      label: "Market Cap",
      icon: DollarSign,
      value: `$${eligibility.currentMetrics?.marketCap?.toLocaleString() || 0}`,
      progress: eligibility.progress?.marketCap || 0,
      threshold: `$${eligibility.thresholds?.marketCap?.toLocaleString() || 0}`,
    },
    {
      label: "Liquidity",
      icon: TrendingUp,
      value: `$${eligibility.currentMetrics?.liquidity?.toLocaleString() || 0}`,
      progress: eligibility.progress?.liquidity || 0,
      threshold: `$${eligibility.thresholds?.liquidity?.toLocaleString() || 0}`,
    },
    {
      label: "Holders",
      icon: Users,
      value: eligibility.currentMetrics?.holders || 0,
      progress: eligibility.progress?.holders || 0,
      threshold: eligibility.thresholds?.holders || 0,
    },
    {
      label: "24h Volume",
      icon: Activity,
      value: `$${eligibility.currentMetrics?.volume24h?.toLocaleString() || 0}`,
      progress: eligibility.progress?.volume24h || 0,
      threshold: `$${eligibility.thresholds?.volume24h?.toLocaleString() || 0}`,
    },
  ];
  
  return (
    <div className="space-y-6">
      <div className="bg-white rounded-xl shadow-sm p-6">
        <div className="flex items-center justify-between mb-6">
          <h3 className="text-xl font-bold">DEX Graduation Status</h3>
          <Button
            onClick={handleCheckEligibility}
            disabled={isChecking}
            variant="outline"
            size="sm"
          >
            {isChecking ? "Checking..." : "Refresh"}
          </Button>
        </div>
        
        {eligibility.eligible ? (
          <Alert className="mb-6 border-green-200 bg-green-50">
            <CheckCircle2 className="h-4 w-4 text-green-600" />
            <AlertTitle className="text-green-800">Ready for Graduation!</AlertTitle>
            <AlertDescription className="text-green-700">
              Your token meets all criteria for DEX listing. You can now graduate to a decentralized exchange.
            </AlertDescription>
          </Alert>
        ) : (
          <Alert className="mb-6">
            <AlertTitle>Not Yet Eligible</AlertTitle>
            <AlertDescription>
              {eligibility.reason}
            </AlertDescription>
          </Alert>
        )}
        
        <div className="grid grid-cols-2 gap-4 mb-6">
          {metrics.map((metric) => {
            const Icon = metric.icon;
            const isComplete = metric.progress >= 100;
            
            return (
              <div key={metric.label} className="space-y-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Icon className={`h-4 w-4 ${isComplete ? 'text-green-600' : 'text-gray-400'}`} />
                    <span className="text-sm font-medium">{metric.label}</span>
                  </div>
                  <span className="text-sm text-gray-600">{metric.value}</span>
                </div>
                <Progress value={Math.min(metric.progress, 100)} className="h-2" />
                <div className="text-xs text-gray-500">
                  Target: {metric.threshold}
                </div>
              </div>
            );
          })}
        </div>
        
        {eligibility.eligible && (
          <div className="flex gap-4">
            <Button
              onClick={() => handleGraduate("uniswap")}
              disabled={isGraduating}
              className="flex-1"
            >
              {isGraduating ? "Graduating..." : "Graduate to Uniswap V3"}
            </Button>
            <Button
              onClick={() => handleGraduate("pancakeswap")}
              disabled={isGraduating}
              variant="outline"
              className="flex-1"
            >
              {isGraduating ? "Graduating..." : "Graduate to PancakeSwap"}
            </Button>
          </div>
        )}
      </div>
      
      <div className="bg-gray-50 rounded-lg p-4 text-sm text-gray-600">
        <h4 className="font-medium text-gray-900 mb-2">What is DEX Graduation?</h4>
        <p className="mb-2">
          When your token reaches certain milestones, it can "graduate" from the bonding curve to a major decentralized exchange (DEX) like Uniswap or PancakeSwap.
        </p>
        <p>
          This provides better liquidity, wider market access, and enables advanced trading features for your token holders.
        </p>
      </div>
    </div>
  );
}