import { Authenticated, Unauthenticated, useQuery } from "convex/react";
import { api } from "../convex/_generated/api";
import { SignInForm } from "./SignInForm";
import { SignOutButton } from "./SignOutButton";
import { Toaster } from "sonner";
import { CoinGenerator } from "./components/CoinGenerator";
import { Dashboard } from "./components/Dashboard";
import { UserCoins } from "./components/UserCoins";
import TrendingTokens from "./components/social/TrendingTokens";
import { TradingPage } from "./pages/TradingPage";
import MonitoringDashboard from "./components/MonitoringDashboard";
import TokenAnalyticsPage from "./pages/TokenAnalyticsPage";
import CreatorDashboard from "./components/CreatorDashboard";
import { useState } from "react";
import { BrowserRouter, Routes, Route, Navigate } from "react-router-dom";

export default function App() {
  return (
    <BrowserRouter>
      <Routes>
        <Route path="/trade/:coinId" element={
          <>
            <Authenticated>
              <TradingPage />
            </Authenticated>
            <Unauthenticated>
              <Navigate to="/" />
            </Unauthenticated>
          </>
        } />
        <Route path="/analytics/:tokenId" element={
          <>
            <Authenticated>
              <TokenAnalyticsPage />
            </Authenticated>
            <Unauthenticated>
              <Navigate to="/" />
            </Unauthenticated>
          </>
        } />
        <Route path="/monitoring" element={
          <>
            <Authenticated>
              <MonitoringDashboard />
            </Authenticated>
            <Unauthenticated>
              <Navigate to="/" />
            </Unauthenticated>
          </>
        } />
        <Route path="/*" element={<MainApp />} />
      </Routes>
      <Toaster position="top-right" />
    </BrowserRouter>
  );
}

function MainApp() {
  const [activeTab, setActiveTab] = useState<"create" | "dashboard" | "trending" | "my-coins" | "creator-revenue">("create");

  return (
    <div className="min-h-screen flex flex-col bg-gradient-to-br from-purple-50 to-blue-50">
      <header className="sticky top-0 z-10 bg-white/90 backdrop-blur-sm border-b shadow-sm">
        <div className="max-w-7xl mx-auto px-4 h-16 flex justify-between items-center">
          <div className="flex items-center gap-4">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-600 to-blue-600 bg-clip-text text-transparent">
              MemeCoinGen
            </h1>
            <span className="text-sm text-gray-500">🚀 Create • Deploy • Moon</span>
          </div>
          <SignOutButton />
        </div>
      </header>

      <main className="flex-1">
        <Content activeTab={activeTab} setActiveTab={setActiveTab} />
      </main>
    </div>
  );
}

function Content({ 
  activeTab, 
  setActiveTab 
}: { 
  activeTab: "create" | "dashboard" | "trending" | "my-coins" | "creator-revenue";
  setActiveTab: (tab: "create" | "dashboard" | "trending" | "my-coins" | "creator-revenue") => void;
}) {
  const loggedInUser = useQuery(api.auth.loggedInUser);

  if (loggedInUser === undefined) {
    return (
      <div className="flex justify-center items-center min-h-[400px]">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-purple-600"></div>
      </div>
    );
  }

  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <Unauthenticated>
        <div className="max-w-md mx-auto">
          <div className="text-center mb-8">
            <h2 className="text-4xl font-bold text-gray-900 mb-4">
              Welcome to MemeCoinGen
            </h2>
            <p className="text-lg text-gray-600">
              Create and deploy your own meme coins in minutes
            </p>
          </div>
          <SignInForm />
        </div>
      </Unauthenticated>

      <Authenticated>
        <div className="mb-8">
          <h2 className="text-3xl font-bold text-gray-900 mb-2">
            Welcome back, {loggedInUser?.name || loggedInUser?.email || "Creator"}! 👋
          </h2>
          <p className="text-gray-600">Ready to create the next viral meme coin?</p>
        </div>

        {/* Navigation Tabs */}
        <div className="flex gap-1 mb-8 bg-gray-100 p-1 rounded-lg w-fit">
          <button
            onClick={() => setActiveTab("create")}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === "create"
                ? "bg-white text-purple-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            🎯 Create Coin
          </button>
          <button
            onClick={() => setActiveTab("dashboard")}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === "dashboard"
                ? "bg-white text-purple-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            📊 Market Dashboard
          </button>
          <button
            onClick={() => setActiveTab("trending")}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === "trending"
                ? "bg-white text-purple-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            🔥 Trending
          </button>
          <button
            onClick={() => setActiveTab("my-coins")}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === "my-coins"
                ? "bg-white text-purple-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            💎 My Coins
          </button>
          <button
            onClick={() => setActiveTab("creator-revenue")}
            className={`px-6 py-2 rounded-md font-medium transition-all ${
              activeTab === "creator-revenue"
                ? "bg-white text-purple-600 shadow-sm"
                : "text-gray-600 hover:text-gray-900"
            }`}
          >
            💰 Revenue
          </button>
        </div>

        {/* Tab Content */}
        {activeTab === "create" && <CoinGenerator />}
        {activeTab === "dashboard" && <Dashboard />}
        {activeTab === "trending" && <TrendingTokens />}
        {activeTab === "my-coins" && <UserCoins />}
        {activeTab === "creator-revenue" && <CreatorDashboard />}
      </Authenticated>
    </div>
  );
}
