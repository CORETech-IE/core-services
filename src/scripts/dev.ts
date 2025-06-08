// scripts/dev.ts
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

// Parse arguments
const args = process.argv.slice(2);
const clientId = args.find(arg => !arg.startsWith('--'));
const platformFlag = args.includes("--win") ? "--win" : args.includes("--linux") ? "--linux" : "";
const shouldDecrypt = args.includes("--decrypt");
const isStandalone = args.includes("--standalone");
const gpgPassphraseArg = args.find(arg => arg.startsWith("--gpg-passphrase="));

if (!clientId) {
  console.error("❌ Missing CLIENT_ID. Usage: npm run dev -- core-dev [--win|--linux] [--decrypt] [--standalone] [--gpg-passphrase=xxx]");
  process.exit(1);
}

console.log(`🚀 Starting Core Services for client: ${clientId}`);
console.log(`🎯 Mode: ${isStandalone ? 'STANDALONE' : 'TRADITIONAL'}`);

// Determine effective platform
const platform =
  platformFlag === "--win"
    ? "win"
    : platformFlag === "--linux"
    ? "linux"
    : process.platform.startsWith("win")
    ? "win"
    : "linux";

// 🚀 Smart detection for compiled vs TypeScript execution
const isCompiled = __filename.endsWith('.js');
console.log(`🔧 Execution mode: ${isCompiled ? 'COMPILED (JavaScript)' : 'DEVELOPMENT (TypeScript)'}`);

/**
 * Handle Standalone Mode - No .env files required!
 */
if (isStandalone) {
  console.log("🔒 Standalone mode detected - bypassing .env file requirements");
  
  // Set environment variables for standalone mode
  process.env.CONFIG_MODE = 'standalone';
  process.env.CLIENT_ID = clientId;
  
  // Set GPG passphrase if provided
  if (gpgPassphraseArg) {
    const passphrase = gpgPassphraseArg.split('=')[1];
    process.env.GPG_PASSPHRASE = passphrase;
    console.log("🔑 GPG passphrase set from CLI argument");
  }
  
  // Verify GPG setup before starting
  console.log("🔍 Verifying GPG setup...");
  try {
    execSync('gpg --list-secret-keys', { stdio: 'pipe' });
    console.log("✅ GPG keys available");
  } catch (error) {
    console.error("❌ GPG setup issue. Make sure GPG is installed and keys are imported.");
    console.error("Run: gpg --list-secret-keys");
    process.exit(1);
  }
  
  // Verify SOPS is available
  const sopsPath = path.resolve(__dirname, "../../../core-envs-private/tools/win64/sops.exe");
  if (!fs.existsSync(sopsPath) && platform === "win") {
    console.error(`❌ SOPS not found at: ${sopsPath}`);
    console.error("Make sure core-envs-private repo is cloned and sops.exe is in tools/win64/");
    process.exit(1);
  }
  
  console.log("🚀 Starting application in standalone mode...");
  
  // 🎯 Smart app path resolution - works for both compiled and TypeScript
  const appPath = isCompiled 
    ? path.resolve(__dirname, "../app.js")   // Compiled version in dist/
    : path.resolve(__dirname, "../app.ts");  // TypeScript version in src/
  
  const runCommand = isCompiled
    ? `node "${appPath}" ${clientId} --standalone`
    : `ts-node "${appPath}" ${clientId} --standalone`;
  
  console.log(`📂 App path: ${appPath}`);
  console.log(`⚡ Run command: ${runCommand}`);
  
  try {
    execSync(runCommand, { 
      stdio: "inherit", 
      shell: platform === "win" ? "cmd.exe" : "/bin/bash",
      env: process.env // Pass all environment variables including GPG_PASSPHRASE
    });
  } catch (error) {
    console.error("❌ Application failed to start in standalone mode");
    process.exit(1);
  }
  
  // Exit here - standalone mode is complete
  process.exit(0);
}

/**
 * Handle Traditional Mode - Original logic
 */
console.log("📄 Traditional mode - using .env + YAML files");

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
  console.error(`💡 Available clients:`);
  
  // List available clients
  const clientsDir = path.join(envsRepo, "clients");
  if (fs.existsSync(clientsDir)) {
    const availableClients = fs.readdirSync(clientsDir, { withFileTypes: true })
      .filter(dirent => dirent.isDirectory())
      .map(dirent => dirent.name);
    
    availableClients.forEach(client => console.error(`   - ${client}`));
  }
  
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
    console.error("💡 Make sure:");
    console.error("   1. GPG private key is imported: gpg --list-secret-keys");
    console.error("   2. You have the correct passphrase");
    console.error("   3. SOPS binary is available");
    process.exit(1);
  }
} else {
  if (!fs.existsSync(envOutput)) {
    console.error(`❌ .env file not found at ${envOutput}. Use --decrypt to generate it.`);
    console.error(`💡 Run: npm run dev -- ${clientId} --decrypt`);
    process.exit(1);
  }
  console.log(`ℹ️ Using existing .env file at: ${envOutput}`);
}

// Start the application in traditional mode
console.log("🚀 Starting application in traditional mode...");

// 🎯 Smart app path resolution for traditional mode too
const appPath = isCompiled 
  ? path.resolve(__dirname, "../app.js")   // Compiled version
  : path.resolve(__dirname, "../app.ts");  // TypeScript version

const runCommand = isCompiled
  ? `node "${appPath}" ${clientId}`
  : `ts-node "${appPath}" ${clientId}`;

console.log(`📂 App path: ${appPath}`);
console.log(`⚡ Run command: ${runCommand}`);

try {
  execSync(runCommand, { 
    stdio: "inherit", 
    shell: platform === "win" ? "cmd.exe" : "/bin/bash" 
  });
} catch (error) {
  console.error("❌ Application failed to start");
  process.exit(1);
}