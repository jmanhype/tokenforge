import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DollarSign, TrendingUp, Users, Activity, PieChart } from "lucide-react";
import { formatCurrency } from "../lib/utils";

const FEE_TYPE_NAMES = {
  0: "Token Creation",
  1: "Trading Fees",
  2: "DEX Graduation",
  3: "Liquidity Provision",
  4: "Multi-Sig Deployment",
};

export function FeeDashboard() {
  const stats24h = useQuery(api.fees.feeManager.getFeeStatistics, { timeframe: "24h" });
  const stats7d = useQuery(api.fees.feeManager.getFeeStatistics, { timeframe: "7d" });
  const stats30d = useQuery(api.fees.feeManager.getFeeStatistics, { timeframe: "30d" });
  const statsAll = useQuery(api.fees.feeManager.getFeeStatistics, { timeframe: "all" });
  
  const currentStats = stats24h;
  
  if (!currentStats) {
    return (
      <div className="animate-pulse">
        <div className="h-96 bg-gray-200 rounded-lg"></div>
      </div>
    );
  }
  
  const statCards = [
    {
      title: "Total Revenue",
      value: formatCurrency(currentStats.totalCollected),
      icon: DollarSign,
      change: "+12.5%",
      trend: "up",
    },
    {
      title: "Active Users",
      value: currentStats.uniqueUsers.toLocaleString(),
      icon: Users,
      change: "+8.2%",
      trend: "up",
    },
    {
      title: "Avg Fee/User",
      value: formatCurrency(
        currentStats.uniqueUsers > 0 
          ? currentStats.totalCollected / currentStats.uniqueUsers 
          : 0
      ),
      icon: Activity,
      change: "+4.1%",
      trend: "up",
    },
    {
      title: "Trading Volume",
      value: formatCurrency(currentStats.byType[1] || 0),
      icon: TrendingUp,
      change: "+18.9%",
      trend: "up",
    },
  ];
  
  return (
    <div className="space-y-6">
      <div>
        <h2 className="text-3xl font-bold tracking-tight">Fee Analytics</h2>
        <p className="text-muted-foreground">
          Platform revenue and fee collection metrics
        </p>
      </div>
      
      {/* Stats Cards */}
      <div className="grid gap-4 md:grid-cols-2 lg:grid-cols-4">
        {statCards.map((stat) => {
          const Icon = stat.icon;
          return (
            <Card key={stat.title}>
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">
                  {stat.title}
                </CardTitle>
                <Icon className="h-4 w-4 text-muted-foreground" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold">{stat.value}</div>
                <p className={`text-xs ${
                  stat.trend === "up" ? "text-green-600" : "text-red-600"
                }`}>
                  {stat.change} from last period
                </p>
              </CardContent>
            </Card>
          );
        })}
      </div>
      
      {/* Time Period Tabs */}
      <Tabs defaultValue="24h" className="space-y-4">
        <TabsList>
          <TabsTrigger value="24h">24 Hours</TabsTrigger>
          <TabsTrigger value="7d">7 Days</TabsTrigger>
          <TabsTrigger value="30d">30 Days</TabsTrigger>
          <TabsTrigger value="all">All Time</TabsTrigger>
        </TabsList>
        
        <TabsContent value="24h" className="space-y-4">
          <FeeBreakdown stats={stats24h} />
        </TabsContent>
        
        <TabsContent value="7d" className="space-y-4">
          <FeeBreakdown stats={stats7d} />
        </TabsContent>
        
        <TabsContent value="30d" className="space-y-4">
          <FeeBreakdown stats={stats30d} />
        </TabsContent>
        
        <TabsContent value="all" className="space-y-4">
          <FeeBreakdown stats={statsAll} />
        </TabsContent>
      </Tabs>
    </div>
  );
}

function FeeBreakdown({ stats }: { stats: any }) {
  if (!stats) return null;
  
  return (
    <div className="grid gap-4 md:grid-cols-2">
      {/* Fee Type Breakdown */}
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <PieChart className="h-5 w-5" />
            Revenue by Type
          </CardTitle>
          <CardDescription>
            Breakdown of fees collected by category
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-4">
            {Object.entries(stats.byType).map(([type, amount]) => {
              const percentage = stats.totalCollected > 0
                ? ((amount as number) / stats.totalCollected) * 100
                : 0;
              
              return (
                <div key={type} className="space-y-2">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-medium">
                      {FEE_TYPE_NAMES[type as any] || `Type ${type}`}
                    </span>
                    <span className="text-sm text-muted-foreground">
                      {formatCurrency(amount as number)}
                    </span>
                  </div>
                  <div className="w-full bg-gray-200 rounded-full h-2">
                    <div
                      className="bg-gradient-to-r from-purple-600 to-blue-600 h-2 rounded-full"
                      style={{ width: `${percentage}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </CardContent>
      </Card>
      
      {/* Recent Collections */}
      <Card>
        <CardHeader>
          <CardTitle>Recent Collections</CardTitle>
          <CardDescription>
            Latest fee transactions
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="space-y-3">
            {stats.recentCollections.slice(0, 5).map((fee: any) => (
              <div key={fee.id} className="flex items-center justify-between">
                <div>
                  <p className="text-sm font-medium">
                    {FEE_TYPE_NAMES[fee.feeType] || "Unknown"}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {new Date(fee.collectedAt).toLocaleString()}
                  </p>
                </div>
                <div className="text-sm font-semibold">
                  {formatCurrency(fee.amount)}
                </div>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
      
      {/* Blockchain Distribution */}
      <Card className="md:col-span-2">
        <CardHeader>
          <CardTitle>Revenue by Blockchain</CardTitle>
          <CardDescription>
            Fee distribution across different networks
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div className="grid grid-cols-3 gap-4">
            {Object.entries(stats.byBlockchain).map(([chain, amount]) => (
              <div key={chain} className="text-center">
                <p className="text-2xl font-bold">
                  {formatCurrency(amount as number)}
                </p>
                <p className="text-sm text-muted-foreground capitalize">
                  {chain}
                </p>
              </div>
            ))}
          </div>
        </CardContent>
      </Card>
    </div>
  );
}