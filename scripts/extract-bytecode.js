import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the compiled contract
const artifactPath = path.join(__dirname, '../artifacts/contracts/MemeCoin.sol/MemeCoin.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

// Extract bytecode and ABI
const bytecode = artifact.bytecode;
const abi = artifact.abi;

// Write to a module that can be imported
const outputPath = path.join(__dirname, '../convex/blockchain/contractData.js');
const content = `// Auto-generated from compiled contract
export const MEMECOIN_BYTECODE = "${bytecode}";

export const MEMECOIN_ABI = ${JSON.stringify(abi, null, 2)};
`;

fs.writeFileSync(outputPath, content);
console.log('Contract data extracted successfully!');