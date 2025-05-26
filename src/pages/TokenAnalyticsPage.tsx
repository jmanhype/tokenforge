import { useParams, Link } from "react-router-dom";
import TokenAnalytics from "../components/TokenAnalytics";
import { ArrowLeft } from "lucide-react";
import { Id } from "../../convex/_generated/dataModel";

export default function TokenAnalyticsPage() {
  const { tokenId } = useParams<{ tokenId: string }>();

  if (!tokenId) {
    return (
      <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50 flex items-center justify-center">
        <div className="text-center">
          <h1 className="text-2xl font-bold text-gray-900 mb-4">Token not found</h1>
          <Link to="/" className="text-purple-600 hover:text-purple-700">
            Go back to dashboard
          </Link>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-50 to-blue-50">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <Link
              to="/"
              className="flex items-center gap-2 text-gray-600 hover:text-gray-900 transition-colors"
            >
              <ArrowLeft className="w-5 h-5" />
              <span>Back to Dashboard</span>
            </Link>
            <span className="text-gray-300">|</span>
            <h1 className="text-xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              Token Analytics
            </h1>
          </div>
        </div>
      </header>

      <main className="max-w-7xl mx-auto px-4 py-8">
        <TokenAnalytics tokenId={tokenId as Id<"memeCoins">} />
      </main>
    </div>
  );
}