import { useEffect, useRef } from "react";
import { Line } from "react-chartjs-2";
import {
  Chart as ChartJS,
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler,
} from "chart.js";
import { formatCurrency, formatNumber } from "../lib/utils";

ChartJS.register(
  CategoryScale,
  LinearScale,
  PointElement,
  LineElement,
  Title,
  Tooltip,
  Legend,
  Filler
);

interface BondingCurveChartProps {
  currentSupply: number;
  currentPrice: number;
  reserveBalance: number;
  marketCap: number;
  priceHistory: Array<{
    timestamp: number;
    price: number;
    supply: number;
  }>;
}

export function BondingCurveChart({
  currentSupply,
  currentPrice,
  reserveBalance,
  marketCap,
  priceHistory,
}: BondingCurveChartProps) {
  const chartRef = useRef<ChartJS<"line">>(null);

  // Generate bonding curve data points
  const generateCurveData = () => {
    const points = [];
    const maxSupply = 1_000_000_000; // 1B tokens
    const steps = 100;
    
    for (let i = 0; i <= steps; i++) {
      const supply = (maxSupply / steps) * i;
      // Price = 0.00001 * (supply / 1e9)^1.5
      const price = 0.00001 * Math.pow(supply / 1e9, 1.5);
      points.push({ x: supply / 1e6, y: price }); // Convert to millions for display
    }
    
    return points;
  };

  const curveData = generateCurveData();
  
  const data = {
    datasets: [
      {
        label: "Bonding Curve",
        data: curveData,
        borderColor: "rgb(99, 102, 241)",
        backgroundColor: "rgba(99, 102, 241, 0.1)",
        borderWidth: 2,
        fill: true,
        tension: 0.4,
        pointRadius: 0,
      },
      {
        label: "Current Position",
        data: [{ x: currentSupply / 1e6, y: currentPrice }],
        borderColor: "rgb(236, 72, 153)",
        backgroundColor: "rgb(236, 72, 153)",
        borderWidth: 3,
        pointRadius: 8,
        pointHoverRadius: 10,
        showLine: false,
      },
      {
        label: "Price History",
        data: priceHistory.map(p => ({ x: p.supply / 1e6, y: p.price })),
        borderColor: "rgb(34, 197, 94)",
        backgroundColor: "rgba(34, 197, 94, 0.1)",
        borderWidth: 2,
        fill: false,
        tension: 0.2,
        pointRadius: 3,
      },
    ],
  };

  const options = {
    responsive: true,
    maintainAspectRatio: false,
    interaction: {
      mode: "index" as const,
      intersect: false,
    },
    plugins: {
      legend: {
        position: "top" as const,
        labels: {
          color: "rgb(156, 163, 175)",
        },
      },
      title: {
        display: false,
      },
      tooltip: {
        callbacks: {
          label: (context: any) => {
            const label = context.dataset.label || "";
            const value = formatCurrency(context.parsed.y);
            const supply = formatNumber(context.parsed.x * 1e6);
            return `${label}: ${value} @ ${supply} tokens`;
          },
        },
      },
    },
    scales: {
      x: {
        type: "linear" as const,
        display: true,
        title: {
          display: true,
          text: "Supply (Millions)",
          color: "rgb(156, 163, 175)",
        },
        grid: {
          color: "rgba(75, 85, 99, 0.2)",
        },
        ticks: {
          color: "rgb(156, 163, 175)",
        },
      },
      y: {
        type: "linear" as const,
        display: true,
        title: {
          display: true,
          text: "Price (USD)",
          color: "rgb(156, 163, 175)",
        },
        grid: {
          color: "rgba(75, 85, 99, 0.2)",
        },
        ticks: {
          color: "rgb(156, 163, 175)",
          callback: (value: any) => formatCurrency(value),
        },
      },
    },
  };

  return (
    <div className="bg-gray-900 rounded-lg p-6">
      <div className="mb-4 grid grid-cols-2 sm:grid-cols-4 gap-4">
        <div>
          <p className="text-sm text-gray-400">Current Price</p>
          <p className="text-lg font-bold text-white">{formatCurrency(currentPrice)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Market Cap</p>
          <p className="text-lg font-bold text-white">{formatCurrency(marketCap)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Reserve</p>
          <p className="text-lg font-bold text-white">{formatCurrency(reserveBalance)}</p>
        </div>
        <div>
          <p className="text-sm text-gray-400">Progress</p>
          <p className="text-lg font-bold text-white">
            {((marketCap / 100000) * 100).toFixed(1)}%
          </p>
        </div>
      </div>
      
      <div className="h-96">
        <Line ref={chartRef} data={data} options={options} />
      </div>
      
      <div className="mt-4 p-3 bg-gray-800 rounded-lg">
        <p className="text-sm text-gray-300">
          🎯 Graduation Target: <span className="font-bold text-green-400">$100,000</span> market cap
        </p>
        <div className="mt-2 bg-gray-700 rounded-full h-2">
          <div
            className="bg-gradient-to-r from-indigo-500 to-pink-500 h-2 rounded-full transition-all duration-500"
            style={{ width: `${Math.min((marketCap / 100000) * 100, 100)}%` }}
          />
        </div>
      </div>
    </div>
  );
}