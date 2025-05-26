import { useQuery } from "convex/react";
import { api } from "../../convex/_generated/api";
import { useState } from "react";
import { AlertTriangle, Activity, CheckCircle, XCircle, Clock, TrendingUp, TrendingDown } from "lucide-react";

export default function MonitoringDashboard() {
  const [timeRange, setTimeRange] = useState<"1h" | "24h" | "7d">("24h");
  const systemHealth = useQuery(api.monitoringApi.getSystemHealth);
  const recentAlerts = useQuery(api.monitoringApi.getRecentAlerts, { limit: 10 });
  const metrics = useQuery(api.monitoringApi.getMetricsSummary, { timeRange });
  const auditLogs = useQuery(api.monitoringApi.getRecentAuditLogs, { limit: 5 });

  const getHealthIcon = (status: string) => {
    switch (status) {
      case "healthy":
        return <CheckCircle className="w-5 h-5 text-green-500" />;
      case "degraded":
        return <AlertTriangle className="w-5 h-5 text-yellow-500" />;
      case "down":
        return <XCircle className="w-5 h-5 text-red-500" />;
      default:
        return <Clock className="w-5 h-5 text-gray-500" />;
    }
  };

  const getSeverityBadge = (severity: string) => {
    const colors = {
      low: "bg-blue-100 text-blue-800",
      medium: "bg-yellow-100 text-yellow-800",
      high: "bg-orange-100 text-orange-800",
      critical: "bg-red-100 text-red-800",
    };
    return (
      <span className={`px-2 py-1 text-xs font-medium rounded-full ${colors[severity as keyof typeof colors]}`}>
        {severity.toUpperCase()}
      </span>
    );
  };

  return (
    <div className="p-6 space-y-6 bg-gray-50 min-h-screen">
      <div className="flex justify-between items-center">
        <h1 className="text-3xl font-bold text-gray-900">System Monitoring</h1>
        <div className="flex gap-2">
          {(["1h", "24h", "7d"] as const).map((range) => (
            <button
              key={range}
              onClick={() => setTimeRange(range)}
              className={`px-4 py-2 text-sm font-medium rounded-lg ${
                timeRange === range
                  ? "bg-indigo-600 text-white"
                  : "bg-white text-gray-700 border border-gray-300 hover:bg-gray-50"
              }`}
            >
              {range === "1h" ? "1 Hour" : range === "24h" ? "24 Hours" : "7 Days"}
            </button>
          ))}
        </div>
      </div>

      {/* System Health Overview */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">System Health</h2>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {systemHealth?.map((component) => (
            <div key={component.component} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="font-medium text-gray-900">{component.component.replace(/_/g, " ").toUpperCase()}</h3>
                {getHealthIcon(component.status)}
              </div>
              <div className="text-sm text-gray-600">
                {component.responseTime && (
                  <p>Response Time: {component.responseTime}ms</p>
                )}
                {component.errorRate !== undefined && (
                  <p>Error Rate: {(component.errorRate * 100).toFixed(1)}%</p>
                )}
                <p className="text-xs mt-1">
                  Last Check: {new Date(component.lastCheck).toLocaleTimeString()}
                </p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Metrics Summary */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Key Metrics</h2>
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          {metrics?.map((metric) => (
            <div key={metric.name} className="border rounded-lg p-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium text-gray-600">{metric.name}</h3>
                {metric.trend > 0 ? (
                  <TrendingUp className="w-4 h-4 text-green-500" />
                ) : metric.trend < 0 ? (
                  <TrendingDown className="w-4 h-4 text-red-500" />
                ) : null}
              </div>
              <p className="text-2xl font-bold text-gray-900">{metric.value.toLocaleString()}</p>
              {metric.change !== undefined && (
                <p className={`text-sm ${metric.change >= 0 ? "text-green-600" : "text-red-600"}`}>
                  {metric.change >= 0 ? "+" : ""}{metric.change.toFixed(1)}%
                </p>
              )}
            </div>
          ))}
        </div>
      </div>

      {/* Recent Alerts */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Alerts</h2>
        <div className="space-y-4">
          {recentAlerts?.length === 0 ? (
            <p className="text-gray-500 text-center py-8">No recent alerts</p>
          ) : (
            recentAlerts?.map((alert) => (
              <div key={alert._id} className="border rounded-lg p-4">
                <div className="flex items-start justify-between">
                  <div className="flex-1">
                    <div className="flex items-center gap-2 mb-1">
                      <h3 className="font-medium text-gray-900">{alert.title}</h3>
                      {getSeverityBadge(alert.severity)}
                    </div>
                    <p className="text-sm text-gray-600 mb-2">{alert.message}</p>
                    <div className="flex items-center gap-4 text-xs text-gray-500">
                      <span>Triggered: {new Date(alert.triggeredAt).toLocaleString()}</span>
                      {alert.acknowledgedAt && (
                        <span>Acknowledged: {new Date(alert.acknowledgedAt).toLocaleString()}</span>
                      )}
                      {alert.resolvedAt && (
                        <span>Resolved: {new Date(alert.resolvedAt).toLocaleString()}</span>
                      )}
                    </div>
                  </div>
                  <div className="ml-4">
                    <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                      alert.status === "triggered" ? "bg-red-100 text-red-800" :
                      alert.status === "acknowledged" ? "bg-yellow-100 text-yellow-800" :
                      "bg-green-100 text-green-800"
                    }`}>
                      {alert.status.toUpperCase()}
                    </span>
                  </div>
                </div>
              </div>
            ))
          )}
        </div>
      </div>

      {/* Recent Audit Logs */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-xl font-semibold mb-4">Recent Activity</h2>
        <div className="space-y-3">
          {auditLogs?.map((log) => (
            <div key={log._id} className="flex items-center justify-between py-2 border-b last:border-0">
              <div className="flex items-center gap-3">
                <Activity className="w-4 h-4 text-gray-400" />
                <div>
                  <p className="text-sm font-medium text-gray-900">{log.action}</p>
                  <p className="text-xs text-gray-500">
                    User: {log.userId} • {new Date(log.timestamp).toLocaleString()}
                  </p>
                </div>
              </div>
              <span className={`px-2 py-1 text-xs font-medium rounded-full ${
                log.severity === "info" ? "bg-gray-100 text-gray-800" :
                log.severity === "warning" ? "bg-yellow-100 text-yellow-800" :
                log.severity === "error" ? "bg-red-100 text-red-800" :
                "bg-purple-100 text-purple-800"
              }`}>
                {log.severity}
              </span>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}