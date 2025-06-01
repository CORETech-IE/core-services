import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

// Arguments: clientId, platform flag (--win|--linux), and optional --decrypt
const args = process.argv.slice(2);
const clientId = args[0];
const platformFlag = args.includes("--win") ? "--win" : args.includes("--linux") ? "--linux" : "";
const shouldDecrypt = args.includes("--decrypt");

if (!clientId) {
  console.error("❌ Missing CLIENT_ID. Usage: npm run dev -- core-dev [--win|--linux] [--decrypt]");
  process.exit(1);
}

// Determine effective platform
const platform =
  platformFlag === "--win"
    ? "win"
    : platformFlag === "--linux"
    ? "linux"
    : process.platform.startsWith("win")
    ? "win"
    : "linux";

// Path to core-envs-private repo (assumed sibling of core-services)
const envsRepo = path.resolve(__dirname, "../../../core-envs-private");

// Path to the secrets file
const secretsPath = path.join(envsRepo, "clients", clientId, "secrets.sops.yaml");

// Output path for the generated .env file
const envOutput = path.resolve(__dirname, "../.env");

// SOPS binary path
const sopsBinary =
  platform === "win"
    ? path.join(envsRepo, "tools", "win64", "sops.exe")
    : "sops";

if (!fs.existsSync(secretsPath)) {
  console.error(`❌ secrets.sops.yaml not found at: ${secretsPath}`);
  process.exit(1);
}

if (shouldDecrypt) {
  try {
    console.log(`🔐 Decrypting secrets for "${clientId}" using SOPS...`);
    const command = `"${sopsBinary}" -d "${secretsPath}" > "${envOutput}"`;
    execSync(command, {
      stdio: "inherit",
      shell: platform === "win" ? "cmd.exe" : "/bin/bash",
    });
    console.log(`✅ .env file generated at: ${envOutput}`);
  } catch (error) {
    console.error("❌ Failed to decrypt secrets with SOPS");
    process.exit(1);
  }
} else {
  if (!fs.existsSync(envOutput)) {
    console.error(`❌ .env file not found at ${envOutput}. Use --decrypt to generate it.`);
    process.exit(1);
  }
  console.log(`ℹ️ Using existing .env file at: ${envOutput}`);
}


const appPath = path.resolve(__dirname, "../app.ts");
const runCommand = `ts-node ${appPath} ${clientId}`;
execSync(runCommand, { stdio: "inherit", shell: platform === "win" ? "cmd.exe" : "/bin/bash" });
