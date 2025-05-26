#!/usr/bin/env tsx
/**
 * Mainnet Configuration Checker
 * 
 * This script checks if the mainnet configuration is complete and valid
 * 
 * Usage: npm run check:mainnet
 */

import { config } from "dotenv";
import { existsSync } from "fs";
import chalk from "chalk";
import { getNetworkConfig, validateNetworkConfig, isNetworkProductionReady } from "../config/networks";

// Try to load mainnet environment
const mainnetEnvPath = ".env.mainnet";
if (existsSync(mainnetEnvPath)) {
  config({ path: mainnetEnvPath });
  console.log(chalk.green(`✓ Loaded ${mainnetEnvPath}`));
} else {
  console.log(chalk.yellow(`⚠ ${mainnetEnvPath} not found. Using default .env`));
  config();
}

interface CheckResult {
  category: string;
  checks: { name: string; passed: boolean; details?: string }[];
}

function checkEnvironmentVariables(): CheckResult {
  const checks = [
    {
      name: "ETHEREUM_MAINNET_RPC_URL",
      passed: !!process.env.ETHEREUM_MAINNET_RPC_URL && !process.env.ETHEREUM_MAINNET_RPC_URL.includes("YOUR_"),
      details: process.env.ETHEREUM_MAINNET_RPC_URL ? "Configured" : "Missing",
    },
    {
      name: "BSC_MAINNET_RPC_URL",
      passed: !!process.env.BSC_MAINNET_RPC_URL && !process.env.BSC_MAINNET_RPC_URL.includes("YOUR_"),
      details: process.env.BSC_MAINNET_RPC_URL ? "Configured" : "Missing",
    },
    {
      name: "SOLANA_MAINNET_RPC_URL",
      passed: !!process.env.SOLANA_MAINNET_RPC_URL && !process.env.SOLANA_MAINNET_RPC_URL.includes("YOUR_"),
      details: process.env.SOLANA_MAINNET_RPC_URL ? "Configured" : "Missing",
    },
    {
      name: "ETHEREUM_DEPLOYER_PRIVATE_KEY",
      passed: !!process.env.ETHEREUM_DEPLOYER_PRIVATE_KEY,
      details: process.env.ETHEREUM_DEPLOYER_PRIVATE_KEY ? "Set" : "Missing",
    },
    {
      name: "BSC_DEPLOYER_PRIVATE_KEY",
      passed: !!process.env.BSC_DEPLOYER_PRIVATE_KEY,
      details: process.env.BSC_DEPLOYER_PRIVATE_KEY ? "Set" : "Missing",
    },
    {
      name: "SOLANA_DEPLOYER_PRIVATE_KEY",
      passed: !!process.env.SOLANA_DEPLOYER_PRIVATE_KEY,
      details: process.env.SOLANA_DEPLOYER_PRIVATE_KEY ? "Set" : "Missing",
    },
  ];

  return { category: "Environment Variables", checks };
}

function checkContractAddresses(): CheckResult {
  const checks = [
    {
      name: "FEE_COLLECTOR_ETHEREUM",
      passed: !!process.env.FEE_COLLECTOR_ETHEREUM && process.env.FEE_COLLECTOR_ETHEREUM.startsWith("0x"),
      details: process.env.FEE_COLLECTOR_ETHEREUM || "Not deployed",
    },
    {
      name: "FEE_COLLECTOR_BSC",
      passed: !!process.env.FEE_COLLECTOR_BSC && process.env.FEE_COLLECTOR_BSC.startsWith("0x"),
      details: process.env.FEE_COLLECTOR_BSC || "Not deployed",
    },
    {
      name: "BONDING_CURVE_FACTORY_ETHEREUM",
      passed: !!process.env.BONDING_CURVE_FACTORY_ETHEREUM && process.env.BONDING_CURVE_FACTORY_ETHEREUM.startsWith("0x"),
      details: process.env.BONDING_CURVE_FACTORY_ETHEREUM || "Not deployed",
    },
    {
      name: "BONDING_CURVE_FACTORY_BSC",
      passed: !!process.env.BONDING_CURVE_FACTORY_BSC && process.env.BONDING_CURVE_FACTORY_BSC.startsWith("0x"),
      details: process.env.BONDING_CURVE_FACTORY_BSC || "Not deployed",
    },
    {
      name: "MULTISIG_FACTORY_ETHEREUM",
      passed: !!process.env.MULTISIG_FACTORY_ETHEREUM && process.env.MULTISIG_FACTORY_ETHEREUM.startsWith("0x"),
      details: process.env.MULTISIG_FACTORY_ETHEREUM || "Not deployed",
    },
    {
      name: "MULTISIG_FACTORY_BSC",
      passed: !!process.env.MULTISIG_FACTORY_BSC && process.env.MULTISIG_FACTORY_BSC.startsWith("0x"),
      details: process.env.MULTISIG_FACTORY_BSC || "Not deployed",
    },
  ];

  return { category: "Contract Addresses", checks };
}

function checkSecuritySettings(): CheckResult {
  const checks = [
    {
      name: "MAINNET_TREASURY_ADDRESS",
      passed: !!process.env.MAINNET_TREASURY_ADDRESS && process.env.MAINNET_TREASURY_ADDRESS.startsWith("0x"),
      details: process.env.MAINNET_TREASURY_ADDRESS ? "Configured" : "Missing",
    },
    {
      name: "MAINNET_EMERGENCY_ADDRESS",
      passed: !!process.env.MAINNET_EMERGENCY_ADDRESS && process.env.MAINNET_EMERGENCY_ADDRESS.startsWith("0x"),
      details: process.env.MAINNET_EMERGENCY_ADDRESS ? "Configured" : "Missing",
    },
    {
      name: "MULTISIG_OWNERS",
      passed: !!process.env.MULTISIG_OWNERS && process.env.MULTISIG_OWNERS.includes("0x"),
      details: process.env.MULTISIG_OWNERS ? "Configured" : "Missing",
    },
    {
      name: "MULTISIG_REQUIRED_CONFIRMATIONS",
      passed: !!process.env.MULTISIG_REQUIRED_CONFIRMATIONS && parseInt(process.env.MULTISIG_REQUIRED_CONFIRMATIONS) >= 2,
      details: process.env.MULTISIG_REQUIRED_CONFIRMATIONS || "Not set",
    },
  ];

  return { category: "Security Settings", checks };
}

function checkApiKeys(): CheckResult {
  const checks = [
    {
      name: "ETHERSCAN_API_KEY",
      passed: !!process.env.ETHERSCAN_API_KEY && !process.env.ETHERSCAN_API_KEY.includes("YOUR_"),
      details: process.env.ETHERSCAN_API_KEY ? "Set" : "Missing",
    },
    {
      name: "BSCSCAN_API_KEY",
      passed: !!process.env.BSCSCAN_API_KEY && !process.env.BSCSCAN_API_KEY.includes("YOUR_"),
      details: process.env.BSCSCAN_API_KEY ? "Set" : "Missing",
    },
    {
      name: "COINGECKO_API_KEY",
      passed: !!process.env.COINGECKO_API_KEY && !process.env.COINGECKO_API_KEY.includes("YOUR_"),
      details: process.env.COINGECKO_API_KEY ? "Set" : "Missing",
    },
  ];

  return { category: "API Keys", checks };
}

function checkMonitoring(): CheckResult {
  const checks = [
    {
      name: "SENTRY_DSN_MAINNET",
      passed: !!process.env.SENTRY_DSN_MAINNET,
      details: process.env.SENTRY_DSN_MAINNET ? "Configured" : "Missing",
    },
    {
      name: "DISCORD_WEBHOOK_MAINNET",
      passed: !!process.env.DISCORD_WEBHOOK_MAINNET,
      details: process.env.DISCORD_WEBHOOK_MAINNET ? "Configured" : "Missing",
    },
    {
      name: "TELEGRAM_BOT_TOKEN_MAINNET",
      passed: !!process.env.TELEGRAM_BOT_TOKEN_MAINNET,
      details: process.env.TELEGRAM_BOT_TOKEN_MAINNET ? "Configured" : "Missing",
    },
  ];

  return { category: "Monitoring & Alerts", checks };
}

function checkNetworkConfigs(): CheckResult {
  const networks = ["ethereum", "bsc", "solana"];
  const checks = networks.map(network => {
    try {
      const config = getNetworkConfig(network, false);
      const errors = validateNetworkConfig(config);
      return {
        name: `${network.toUpperCase()} Network Config`,
        passed: errors.length === 0,
        details: errors.length === 0 ? "Valid" : errors.join(", "),
      };
    } catch (error) {
      return {
        name: `${network.toUpperCase()} Network Config`,
        passed: false,
        details: "Configuration error",
      };
    }
  });

  return { category: "Network Configurations", checks };
}

async function main() {
  console.log(chalk.bold.blue("\n🔍 Checking Mainnet Configuration\n"));

  const results: CheckResult[] = [
    checkEnvironmentVariables(),
    checkContractAddresses(),
    checkSecuritySettings(),
    checkApiKeys(),
    checkMonitoring(),
    checkNetworkConfigs(),
  ];

  let totalChecks = 0;
  let passedChecks = 0;

  results.forEach(result => {
    console.log(chalk.bold.underline(`\n${result.category}:`));
    
    result.checks.forEach(check => {
      totalChecks++;
      if (check.passed) {
        passedChecks++;
        console.log(chalk.green(`  ✓ ${check.name}`));
        if (check.details && check.details !== "Set" && check.details !== "Configured" && check.details !== "Valid") {
          console.log(chalk.gray(`    ${check.details}`));
        }
      } else {
        console.log(chalk.red(`  ✗ ${check.name}`));
        if (check.details) {
          console.log(chalk.gray(`    ${check.details}`));
        }
      }
    });
  });

  const percentage = Math.round((passedChecks / totalChecks) * 100);
  
  console.log(chalk.bold.underline("\n📊 Summary:"));
  console.log(`  Total checks: ${totalChecks}`);
  console.log(`  Passed: ${chalk.green(passedChecks)}`);
  console.log(`  Failed: ${chalk.red(totalChecks - passedChecks)}`);
  console.log(`  Score: ${percentage >= 80 ? chalk.green(percentage + "%") : percentage >= 60 ? chalk.yellow(percentage + "%") : chalk.red(percentage + "%")}`);

  if (percentage >= 80) {
    console.log(chalk.green("\n✅ Mainnet configuration is ready!"));
    
    // Check individual networks
    console.log(chalk.bold.underline("\n🚀 Network Readiness:"));
    ["ethereum", "bsc", "solana"].forEach(network => {
      const ready = isNetworkProductionReady(network);
      console.log(`  ${network.toUpperCase()}: ${ready ? chalk.green("Ready") : chalk.red("Not Ready")}`);
    });
  } else {
    console.log(chalk.red("\n❌ Mainnet configuration is incomplete."));
    console.log(chalk.yellow("\nNext steps:"));
    console.log("1. Copy .env.mainnet.example to .env.mainnet");
    console.log("2. Fill in all missing configuration values");
    console.log("3. Deploy contracts to mainnet using: npm run deploy:mainnet -- --network <network>");
    console.log("4. Run this check again: npm run check:mainnet");
  }

  process.exit(percentage >= 80 ? 0 : 1);
}

main().catch(error => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});