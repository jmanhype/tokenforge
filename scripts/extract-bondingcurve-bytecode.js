import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Read the compiled BondingCurve contract
const artifactPath = path.join(__dirname, '../artifacts/contracts/BondingCurve.sol/BondingCurve.json');
const artifact = JSON.parse(fs.readFileSync(artifactPath, 'utf8'));

// Extract bytecode
const bytecode = artifact.bytecode;

// Write to .env.local
const envPath = path.join(__dirname, '../.env.local');
const envContent = fs.readFileSync(envPath, 'utf8');

// Replace or add BONDING_CURVE_BYTECODE
const updatedContent = envContent.replace(
  /BONDING_CURVE_BYTECODE=.*/,
  `BONDING_CURVE_BYTECODE=${bytecode}`
);

fs.writeFileSync(envPath, updatedContent);
console.log('BondingCurve bytecode extracted and added to .env.local!');