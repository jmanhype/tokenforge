#!/usr/bin/env tsx
/**
 * Contract Verification Script
 * 
 * This script verifies deployed contracts on Etherscan/BSCScan
 * 
 * Usage: npm run verify:contracts -- --network ethereum|bsc --manifest <path-to-manifest>
 */

import { exec } from "child_process";
import { readFileSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import { promisify } from "util";

const execAsync = promisify(exec);

interface ContractInfo {
  contractName: string;
  address: string;
  constructorArgs?: any[];
}

async function verifyContract(
  network: string,
  contractInfo: ContractInfo,
  apiKey: string
): Promise<void> {
  console.log(chalk.blue(`\nVerifying ${contractInfo.contractName} at ${contractInfo.address}...`));
  
  const networkName = network === "ethereum" ? "mainnet" : "bsc";
  const constructorArgs = contractInfo.constructorArgs || [];
  
  try {
    // Create constructor arguments file if needed
    let argsFile = "";
    if (constructorArgs.length > 0) {
      argsFile = `verify-args-${Date.now()}.js`;
      const argsContent = `module.exports = ${JSON.stringify(constructorArgs)};`;
      require("fs").writeFileSync(argsFile, argsContent);
    }
    
    // Build verification command
    const cmd = `npx hardhat verify --network ${networkName} ${
      argsFile ? `--constructor-args ${argsFile}` : ""
    } ${contractInfo.address}`;
    
    console.log(chalk.gray(`Running: ${cmd}`));
    
    const { stdout, stderr } = await execAsync(cmd, {
      env: {
        ...process.env,
        ETHERSCAN_API_KEY: network === "ethereum" ? apiKey : undefined,
        BSCSCAN_API_KEY: network === "bsc" ? apiKey : undefined,
      },
    });
    
    if (stderr && !stderr.includes("Already Verified")) {
      console.error(chalk.yellow(`Warning: ${stderr}`));
    }
    
    if (stdout.includes("Successfully verified") || stdout.includes("Already Verified")) {
      console.log(chalk.green(`✅ ${contractInfo.contractName} verified successfully`));
    } else {
      console.log(chalk.yellow(`⚠️  ${contractInfo.contractName} verification output: ${stdout}`));
    }
    
    // Clean up args file
    if (argsFile) {
      require("fs").unlinkSync(argsFile);
    }
    
  } catch (error: any) {
    if (error.message.includes("Already Verified")) {
      console.log(chalk.green(`✅ ${contractInfo.contractName} already verified`));
    } else {
      console.error(chalk.red(`❌ Failed to verify ${contractInfo.contractName}: ${error.message}`));
    }
  }
}

async function main() {
  const args = process.argv.slice(2);
  const networkIndex = args.indexOf("--network");
  const manifestIndex = args.indexOf("--manifest");
  
  if (networkIndex === -1 || !args[networkIndex + 1]) {
    console.error(chalk.red("Usage: npm run verify:contracts -- --network ethereum|bsc --manifest <path>"));
    process.exit(1);
  }
  
  const network = args[networkIndex + 1];
  if (network !== "ethereum" && network !== "bsc") {
    console.error(chalk.red("Invalid network. Use 'ethereum' or 'bsc'"));
    process.exit(1);
  }
  
  if (manifestIndex === -1 || !args[manifestIndex + 1]) {
    console.error(chalk.red("Please provide deployment manifest path with --manifest"));
    process.exit(1);
  }
  
  const manifestPath = args[manifestIndex + 1];
  const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
  
  const apiKey = network === "ethereum" 
    ? process.env.ETHERSCAN_API_KEY 
    : process.env.BSCSCAN_API_KEY;
    
  if (!apiKey) {
    console.error(chalk.red(`${network === "ethereum" ? "ETHERSCAN" : "BSCSCAN"}_API_KEY not found in environment`));
    process.exit(1);
  }
  
  console.log(chalk.green(`\n🔍 Verifying contracts on ${network}...\n`));
  
  // Define constructor arguments for each contract
  const contractsWithArgs: ContractInfo[] = [
    {
      contractName: "FeeCollector",
      address: manifest.contracts.find((c: any) => c.contractName === "FeeCollector")?.address || "",
      constructorArgs: [
        process.env.MAINNET_TREASURY_ADDRESS,
        process.env.MAINNET_EMERGENCY_ADDRESS,
      ],
    },
    {
      contractName: "MultiSigWalletFactory",
      address: manifest.contracts.find((c: any) => c.contractName === "MultiSigWalletFactory")?.address || "",
      constructorArgs: [],
    },
    {
      contractName: "BondingCurveFactory",
      address: manifest.contracts.find((c: any) => c.contractName === "BondingCurveFactory")?.address || "",
      constructorArgs: [
        manifest.contracts.find((c: any) => c.contractName === "FeeCollector")?.address || "",
      ],
    },
  ];
  
  for (const contractInfo of contractsWithArgs) {
    if (contractInfo.address) {
      await verifyContract(network, contractInfo, apiKey);
      // Add delay to avoid rate limiting
      await new Promise(resolve => setTimeout(resolve, 5000));
    }
  }
  
  console.log(chalk.green("\n✅ Contract verification completed!"));
}

main().catch(error => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});