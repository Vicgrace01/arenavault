import { readFileSync, writeFileSync } from "node:fs";
const path = "app/page.tsx";
let code = readFileSync(path, "utf8");

const before = code;

// 1. Correct the earn modal open — show an honest inline note
code = code.replace(
  'function routeToEarn() {\n    setError(null);\n    try {\n      openEarnModal();\n      setEarnDeposited(true);',
  'function routeToEarn() {\n    setError("Earn vaults are not provisioned for this testnet app yet. On mainnet, earnDeposit() routes the pool into a DeFindex or Blend vault.");\n    try {\n      openEarnModal();\n      setEarnDeposited(true);'
);

// 2. Button label change
code = code.replace(
  '{earnDeposited ? "Earning yield" : "Route to Earn"}',
  '{earnDeposited ? "Earn preview (testnet)" : "Route to Earn"}'
);

// 3. Confirmation text under the pool
code = code.replace(
  'Pool routed to a Pollar Earn vault. APY shown in the Earn modal.',
  'Testnet Earn vault not provisioned. SDK path shown for mainnet.'
);

// 4. Settlement label — clearer wording
code = code.replace(
  'Escrow releases 20.00 USDC to Player A',
  'Escrow releases pool to Player A'
);

if (code === before) {
  console.log("No replacements made. The strings may already be updated.");
} else {
  writeFileSync(path, code);
  console.log("Patched app/page.tsx");
}

// Verify
const check = readFileSync(path, "utf8");
console.log("Has honest earn note:", check.includes("not provisioned for this testnet app"));
console.log("Has earn label:", check.includes("Earn preview (testnet)"));
console.log("Has settlement label:", check.includes("Escrow releases pool to Player A"));
