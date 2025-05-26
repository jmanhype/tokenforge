import { useQuery } from "convex/react";
import { api } from "@/convex/_generated/api";
import { AlertTriangle, CheckCircle, Key, Lock, RefreshCw, Shield, XCircle } from "lucide-react";
import { useState } from "react";

export function SecurityDashboard() {
  const [showAuditLogs, setShowAuditLogs] = useState(false);
  
  // Get key rotation status
  const keyRotation = useQuery(api.security.keyManager.checkKeyRotation);
  const auditLogs = useQuery(api.security.keyManager.getAuditLogs, 
    showAuditLogs ? { limit: 50 } : "skip"
  );
  const circuitBreakers = useQuery(api.circuitBreaker.getMetrics);

  const getKeyStatusIcon = (status: string) => {
    switch (status) {
      case "expired":
        return <XCircle className="h-5 w-5 text-red-500" />;
      case "expiring_soon":
        return <AlertTriangle className="h-5 w-5 text-yellow-500" />;
      default:
        return <CheckCircle className="h-5 w-5 text-green-500" />;
    }
  };

  const formatTimeRemaining = (ms: number) => {
    const days = Math.floor(ms / (24 * 60 * 60 * 1000));
    const hours = Math.floor((ms % (24 * 60 * 60 * 1000)) / (60 * 60 * 1000));
    
    if (days > 0) return `${days}d ${hours}h`;
    return `${hours}h`;
  };

  return (
    <div className="max-w-7xl mx-auto p-6 space-y-6">
      <div className="flex items-center justify-between">
        <h1 className="text-2xl font-bold flex items-center gap-2">
          <Shield className="h-8 w-8 text-blue-600" />
          Security Dashboard
        </h1>
      </div>

      {/* Key Management Status */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Key className="h-5 w-5" />
          Key Management
        </h2>

        {keyRotation && (
          <div className="space-y-4">
            {/* Keys needing rotation */}
            {keyRotation.needsRotation.length > 0 && (
              <div className="bg-red-50 border border-red-200 rounded-lg p-4">
                <h3 className="font-medium text-red-900 mb-2">Keys Requiring Immediate Rotation</h3>
                <div className="space-y-2">
                  {keyRotation.needsRotation.map((key, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getKeyStatusIcon(key.status)}
                        <span className="text-sm">{key.keyType}</span>
                      </div>
                      <span className="text-sm text-red-600">
                        Expired {formatTimeRemaining(key.expiredFor)} ago
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {/* Keys expiring soon */}
            {keyRotation.warnings.length > 0 && (
              <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
                <h3 className="font-medium text-yellow-900 mb-2">Keys Expiring Soon</h3>
                <div className="space-y-2">
                  {keyRotation.warnings.map((key, i) => (
                    <div key={i} className="flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        {getKeyStatusIcon(key.status)}
                        <span className="text-sm">{key.keyType}</span>
                      </div>
                      <span className="text-sm text-yellow-600">
                        Expires in {formatTimeRemaining(key.expiresIn)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {keyRotation.needsRotation.length === 0 && keyRotation.warnings.length === 0 && (
              <div className="bg-green-50 border border-green-200 rounded-lg p-4">
                <div className="flex items-center gap-2">
                  <CheckCircle className="h-5 w-5 text-green-600" />
                  <span className="text-green-900">All keys are healthy</span>
                </div>
              </div>
            )}
          </div>
        )}
      </div>

      {/* Circuit Breakers */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
          <Lock className="h-5 w-5" />
          Circuit Breakers
        </h2>

        {circuitBreakers && (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {Object.entries(circuitBreakers.byService).map(([service, data]) => (
              <div key={service} className="border rounded-lg p-4">
                <div className="flex items-center justify-between mb-2">
                  <h3 className="font-medium">{service}</h3>
                  <span className={`px-2 py-1 text-xs rounded-full ${
                    data.state === "closed" ? "bg-green-100 text-green-800" :
                    data.state === "open" ? "bg-red-100 text-red-800" :
                    "bg-yellow-100 text-yellow-800"
                  }`}>
                    {data.state}
                  </span>
                </div>
                <div className="text-sm text-gray-600 space-y-1">
                  <div>Success Rate: {data.successRate}%</div>
                  <div>Total Requests: {data.totalRequests}</div>
                  {data.lastFailure && (
                    <div className="text-red-600">
                      Last Failure: {new Date(data.lastFailure).toLocaleTimeString()}
                    </div>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Security Audit Logs */}
      <div className="bg-white rounded-lg shadow p-6">
        <div className="flex items-center justify-between mb-4">
          <h2 className="text-lg font-semibold flex items-center gap-2">
            <RefreshCw className="h-5 w-5" />
            Security Audit Logs
          </h2>
          <button
            onClick={() => setShowAuditLogs(!showAuditLogs)}
            className="text-sm text-blue-600 hover:text-blue-800"
          >
            {showAuditLogs ? "Hide" : "Show"} Logs
          </button>
        </div>

        {showAuditLogs && auditLogs && (
          <div className="overflow-x-auto">
            <table className="min-w-full divide-y divide-gray-200">
              <thead className="bg-gray-50">
                <tr>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Time</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Action</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Actor</th>
                  <th className="px-4 py-2 text-left text-xs font-medium text-gray-500">Details</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {auditLogs.map((log, i) => (
                  <tr key={i} className="hover:bg-gray-50">
                    <td className="px-4 py-2 text-sm text-gray-900">
                      {new Date(log.timestamp).toLocaleString()}
                    </td>
                    <td className="px-4 py-2 text-sm">
                      <span className={`inline-flex items-center px-2 py-1 rounded-full text-xs ${
                        log.severity === "critical" ? "bg-red-100 text-red-800" :
                        log.severity === "warning" ? "bg-yellow-100 text-yellow-800" :
                        "bg-gray-100 text-gray-800"
                      }`}>
                        {log.action}
                      </span>
                    </td>
                    <td className="px-4 py-2 text-sm text-gray-900">{log.actor}</td>
                    <td className="px-4 py-2 text-sm text-gray-600">
                      {log.keyType && <span>Key: {log.keyType}</span>}
                      {log.purpose && <span> | Purpose: {log.purpose}</span>}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-lg shadow p-6">
        <h2 className="text-lg font-semibold mb-4">Quick Actions</h2>
        <div className="flex gap-4">
          <button className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700">
            Rotate All Keys
          </button>
          <button className="px-4 py-2 bg-yellow-600 text-white rounded hover:bg-yellow-700">
            Reset Circuit Breakers
          </button>
          <button className="px-4 py-2 bg-red-600 text-white rounded hover:bg-red-700">
            Emergency Shutdown
          </button>
        </div>
      </div>
    </div>
  );
}