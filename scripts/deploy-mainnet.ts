#!/usr/bin/env tsx
/**
 * Mainnet Deployment Script
 * 
 * This script handles the deployment of all smart contracts to mainnet
 * with proper safety checks and confirmations.
 * 
 * Usage: npm run deploy:mainnet -- --network ethereum|bsc
 */

import { ethers } from "ethers";
import { config } from "dotenv";
import { readFileSync, writeFileSync, existsSync } from "fs";
import { join } from "path";
import chalk from "chalk";
import inquirer from "inquirer";
import { getNetworkConfig, validateNetworkConfig } from "../config/networks";

// Load mainnet environment
config({ path: ".env.mainnet" });

interface DeploymentResult {
  contractName: string;
  address: string;
  transactionHash: string;
  blockNumber: number;
  gasUsed: string;
  deploymentCost: string;
}

interface DeploymentManifest {
  network: string;
  chainId: number;
  deployedAt: string;
  contracts: DeploymentResult[];
  totalCost: string;
}

class MainnetDeployer {
  private network: string;
  private provider: ethers.Provider;
  private deployer: ethers.Wallet;
  private deploymentResults: DeploymentResult[] = [];
  
  constructor(network: string) {
    this.network = network;
    const config = getNetworkConfig(network, false);
    
    // Validate configuration
    const errors = validateNetworkConfig(config);
    if (errors.length > 0) {
      console.error(chalk.red("Configuration errors:"));
      errors.forEach(error => console.error(chalk.red(`  - ${error}`)));
      process.exit(1);
    }
    
    this.provider = new ethers.JsonRpcProvider(config.rpcUrl);
    
    const privateKey = network === "ethereum" 
      ? process.env.ETHEREUM_DEPLOYER_PRIVATE_KEY
      : process.env.BSC_DEPLOYER_PRIVATE_KEY;
      
    if (!privateKey) {
      console.error(chalk.red(`Deployer private key not found for ${network}`));
      process.exit(1);
    }
    
    this.deployer = new ethers.Wallet(privateKey, this.provider);
  }
  
  async checkPreDeployment(): Promise<void> {
    console.log(chalk.blue("\n🔍 Pre-deployment checks...\n"));
    
    // Check deployer balance
    const balance = await this.provider.getBalance(this.deployer.address);
    const balanceEth = ethers.formatEther(balance);
    console.log(`Deployer address: ${chalk.cyan(this.deployer.address)}`);
    console.log(`Deployer balance: ${chalk.green(balanceEth)} ${this.network === "ethereum" ? "ETH" : "BNB"}`);
    
    if (parseFloat(balanceEth) < 0.5) {
      console.error(chalk.red("Insufficient balance for deployment"));
      process.exit(1);
    }
    
    // Check gas prices
    const feeData = await this.provider.getFeeData();
    const gasPrice = feeData.gasPrice ? ethers.formatUnits(feeData.gasPrice, "gwei") : "0";
    console.log(`Current gas price: ${chalk.yellow(gasPrice)} gwei`);
    
    const maxGasPrice = process.env.MAX_GAS_PRICE_GWEI || "200";
    if (parseFloat(gasPrice) > parseFloat(maxGasPrice)) {
      console.error(chalk.red(`Gas price too high! Current: ${gasPrice} gwei, Max: ${maxGasPrice} gwei`));
      process.exit(1);
    }
    
    // Check network
    const chainId = (await this.provider.getNetwork()).chainId;
    const expectedChainId = this.network === "ethereum" ? 1n : 56n;
    if (chainId !== expectedChainId) {
      console.error(chalk.red(`Wrong network! Expected chain ID ${expectedChainId}, got ${chainId}`));
      process.exit(1);
    }
    
    console.log(chalk.green("\n✅ All pre-deployment checks passed\n"));
  }
  
  async confirmDeployment(): Promise<boolean> {
    if (process.env.REQUIRE_MAINNET_CONFIRMATION !== "true") {
      return true;
    }
    
    console.log(chalk.yellow("\n⚠️  MAINNET DEPLOYMENT WARNING ⚠️"));
    console.log(chalk.yellow("You are about to deploy contracts to MAINNET."));
    console.log(chalk.yellow("This will consume real funds and contracts cannot be modified after deployment.\n"));
    
    const { confirmDeploy } = await inquirer.prompt([
      {
        type: "confirm",
        name: "confirmDeploy",
        message: `Do you want to proceed with deployment to ${this.network.toUpperCase()} MAINNET?`,
        default: false,
      },
    ]);
    
    if (!confirmDeploy) {
      console.log(chalk.red("\nDeployment cancelled by user"));
      return false;
    }
    
    // Double confirmation with typed message
    const { typedConfirmation } = await inquirer.prompt([
      {
        type: "input",
        name: "typedConfirmation",
        message: `Type "DEPLOY TO ${this.network.toUpperCase()} MAINNET" to confirm:`,
      },
    ]);
    
    const expectedMessage = `DEPLOY TO ${this.network.toUpperCase()} MAINNET`;
    if (typedConfirmation !== expectedMessage) {
      console.log(chalk.red("\nConfirmation message did not match. Deployment cancelled."));
      return false;
    }
    
    // Deployment delay
    const delaySeconds = parseInt(process.env.MAINNET_DEPLOYMENT_DELAY_SECONDS || "300");
    console.log(chalk.yellow(`\nStarting deployment in ${delaySeconds} seconds... (Press Ctrl+C to cancel)`));
    
    for (let i = delaySeconds; i > 0; i--) {
      process.stdout.write(`\r${chalk.yellow(`Deploying in ${i} seconds...`)}`);
      await new Promise(resolve => setTimeout(resolve, 1000));
    }
    
    console.log("\n");
    return true;
  }
  
  async deployContract(
    contractName: string,
    artifactPath: string,
    args: any[] = []
  ): Promise<DeploymentResult> {
    console.log(chalk.blue(`\n📦 Deploying ${contractName}...`));
    
    const artifactFullPath = join(process.cwd(), artifactPath);
    if (!existsSync(artifactFullPath)) {
      throw new Error(`Artifact not found: ${artifactFullPath}`);
    }
    
    const artifact = JSON.parse(readFileSync(artifactFullPath, "utf8"));
    const factory = new ethers.ContractFactory(artifact.abi, artifact.bytecode, this.deployer);
    
    // Estimate gas
    const deployTransaction = await factory.getDeployTransaction(...args);
    const estimatedGas = await this.provider.estimateGas({
      ...deployTransaction,
      from: this.deployer.address,
    });
    
    console.log(`Estimated gas: ${chalk.yellow(estimatedGas.toString())}`);
    
    // Deploy with proper gas settings
    const networkConfig = getNetworkConfig(this.network, false);
    const contract = await factory.deploy(...args, {
      gasLimit: estimatedGas * 120n / 100n, // 20% buffer
      maxFeePerGas: networkConfig.gasSettings?.maxFeePerGas,
      maxPriorityFeePerGas: networkConfig.gasSettings?.maxPriorityFeePerGas,
    });
    
    console.log(`Transaction hash: ${chalk.cyan(contract.deploymentTransaction()?.hash)}`);
    console.log("Waiting for confirmations...");
    
    const receipt = await contract.deploymentTransaction()?.wait(networkConfig.confirmations);
    
    if (!receipt) {
      throw new Error("Deployment receipt not found");
    }
    
    const deploymentCost = receipt.gasUsed * receipt.gasPrice;
    
    const result: DeploymentResult = {
      contractName,
      address: await contract.getAddress(),
      transactionHash: receipt.hash,
      blockNumber: receipt.blockNumber,
      gasUsed: receipt.gasUsed.toString(),
      deploymentCost: ethers.formatEther(deploymentCost),
    };
    
    this.deploymentResults.push(result);
    
    console.log(chalk.green(`✅ ${contractName} deployed to: ${result.address}`));
    console.log(`   Cost: ${result.deploymentCost} ${this.network === "ethereum" ? "ETH" : "BNB"}`);
    
    return result;
  }
  
  async deployAllContracts(): Promise<void> {
    // Deploy Fee Collector
    const feeCollector = await this.deployContract(
      "FeeCollector",
      "artifacts/contracts/FeeCollector.sol/FeeCollector.json",
      [
        process.env.MAINNET_TREASURY_ADDRESS,
        process.env.MAINNET_EMERGENCY_ADDRESS,
      ]
    );
    
    // Deploy MultiSig Factory
    const multiSigFactory = await this.deployContract(
      "MultiSigWalletFactory",
      "artifacts/contracts/MultiSigWalletFactory.sol/MultiSigWalletFactory.json"
    );
    
    // Deploy Bonding Curve Factory
    const bondingCurveFactory = await this.deployContract(
      "BondingCurveFactory",
      "artifacts/contracts/BondingCurveFactory.sol/BondingCurveFactory.json",
      [feeCollector.address]
    );
    
    // Configure Fee Collector
    console.log(chalk.blue("\n⚙️  Configuring contracts..."));
    
    const feeCollectorContract = new ethers.Contract(
      feeCollector.address,
      ["function configureFees(uint256[] feeTypes, uint256[] amounts, bool[] enabled) public"],
      this.deployer
    );
    
    const feeTypes = [0, 1, 2, 3, 4]; // All fee types
    const feeAmounts = [
      ethers.parseEther(process.env.TOKEN_CREATION_FEE || "0.1"),
      ethers.parseEther((parseFloat(process.env.BONDING_CURVE_TRADE_FEE_PERCENT || "1") / 100).toString()),
      ethers.parseEther(process.env.DEX_GRADUATION_FEE || "0.5"),
      ethers.parseEther(process.env.LIQUIDITY_PROVISION_FEE || "0.05"),
      ethers.parseEther(process.env.MULTI_SIG_DEPLOYMENT_FEE || "0.2"),
    ];
    const enabled = [true, true, true, true, true];
    
    const configTx = await feeCollectorContract.configureFees(feeTypes, feeAmounts, enabled);
    await configTx.wait();
    
    console.log(chalk.green("✅ Contracts configured"));
  }
  
  async saveDeploymentManifest(): Promise<void> {
    const totalCost = this.deploymentResults.reduce(
      (sum, result) => sum + parseFloat(result.deploymentCost),
      0
    );
    
    const manifest: DeploymentManifest = {
      network: this.network,
      chainId: this.network === "ethereum" ? 1 : 56,
      deployedAt: new Date().toISOString(),
      contracts: this.deploymentResults,
      totalCost: totalCost.toFixed(6),
    };
    
    const manifestPath = join(
      process.cwd(),
      "deployments",
      `mainnet-${this.network}-${Date.now()}.json`
    );
    
    writeFileSync(manifestPath, JSON.stringify(manifest, null, 2));
    console.log(chalk.green(`\n📄 Deployment manifest saved to: ${manifestPath}`));
    
    // Update .env.mainnet with deployed addresses
    console.log(chalk.blue("\n📝 Update your .env.mainnet with these addresses:"));
    this.deploymentResults.forEach(result => {
      const envKey = `${result.contractName.toUpperCase().replace(/([A-Z])/g, "_$1").slice(1)}_${this.network.toUpperCase()}`;
      console.log(`${envKey}=${result.address}`);
    });
  }
  
  async run(): Promise<void> {
    try {
      await this.checkPreDeployment();
      
      const confirmed = await this.confirmDeployment();
      if (!confirmed) {
        process.exit(0);
      }
      
      console.log(chalk.green("\n🚀 Starting mainnet deployment...\n"));
      
      await this.deployAllContracts();
      await this.saveDeploymentManifest();
      
      console.log(chalk.green("\n✅ Mainnet deployment completed successfully!"));
      console.log(chalk.yellow("\n⚠️  IMPORTANT: Update your .env.mainnet file with the deployed contract addresses"));
      console.log(chalk.yellow("⚠️  IMPORTANT: Verify all contracts on Etherscan/BSCScan"));
      
    } catch (error) {
      console.error(chalk.red("\n❌ Deployment failed:"), error);
      process.exit(1);
    }
  }
}

// Main execution
async function main() {
  const args = process.argv.slice(2);
  const networkIndex = args.indexOf("--network");
  
  if (networkIndex === -1 || !args[networkIndex + 1]) {
    console.error(chalk.red("Usage: npm run deploy:mainnet -- --network ethereum|bsc"));
    process.exit(1);
  }
  
  const network = args[networkIndex + 1];
  if (network !== "ethereum" && network !== "bsc") {
    console.error(chalk.red("Invalid network. Use 'ethereum' or 'bsc'"));
    process.exit(1);
  }
  
  const deployer = new MainnetDeployer(network);
  await deployer.run();
}

main().catch(error => {
  console.error(chalk.red("Fatal error:"), error);
  process.exit(1);
});