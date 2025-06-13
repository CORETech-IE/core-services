// scripts/dev.ts - SIMPLIFIED VERSION
import { execSync } from "child_process";
import * as path from "path";
import * as fs from "fs";

// Parse arguments
const args = process.argv.slice(2);
const clientId = args.find(arg => !arg.startsWith('--'));
const gpgPassphraseArg = args.find(arg => arg.startsWith("--gpg-passphrase="));

if (!clientId) {
  console.error("❌ Missing CLIENT_ID. Usage: npm run dev -- core-dev [--gpg-passphrase=xxx]");
  process.exit(1);
}

console.log(`🚀 Starting Core Services for client: ${clientId}`);
console.log(`🔐 Mode: SOPS ONLY`);

// Set environment variables
process.env.CLIENT_ID = clientId;

// Set GPG passphrase if provided
if (gpgPassphraseArg) {
  const passphrase = gpgPassphraseArg.split('=')[1];
  process.env.GPG_PASSPHRASE = passphrase;
  console.log("🔑 GPG passphrase set from CLI argument");
}

// Verify GPG setup
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
if (!fs.existsSync(sopsPath) && process.platform.startsWith("win")) {
  console.error(`❌ SOPS not found at: ${sopsPath}`);
  console.error("Make sure core-envs-private repo is cloned and sops.exe is in tools/win64/");
  process.exit(1);
}

// Verify client configuration exists
const envsPath = path.resolve(__dirname, "../../../core-envs-private/clients", clientId);
const configPath = path.join(envsPath, 'config.yaml');
const secretsPath = path.join(envsPath, 'secrets.sops.yaml');

if (!fs.existsSync(configPath)) {
  console.error(`❌ Client config not found: ${configPath}`);
  process.exit(1);
}

if (!fs.existsSync(secretsPath)) {
  console.error(`❌ Client secrets not found: ${secretsPath}`);
  process.exit(1);
}

console.log("✅ Client configuration verified");

// Determine if we're running compiled or TypeScript
const isCompiled = __filename.endsWith('.js');
console.log(`🔧 Execution mode: ${isCompiled ? 'COMPILED (JavaScript)' : 'DEVELOPMENT (TypeScript)'}`);

// Start the application
console.log("🚀 Starting application...");

const appPath = isCompiled 
  ? path.resolve(__dirname, "../app.js")   // Compiled version in dist/
  : path.resolve(__dirname, "../app.ts");  // TypeScript version in src/

const runCommand = isCompiled
  ? `node "${appPath}" ${clientId}`
  : `ts-node "${appPath}" ${clientId}`;

console.log(`📂 App path: ${appPath}`);
console.log(`⚡ Run command: ${runCommand}`);

try {
  execSync(runCommand, { 
    stdio: "inherit", 
    shell: process.platform.startsWith("win") ? "cmd.exe" : "/bin/bash",
    env: process.env // Pass all environment variables including GPG_PASSPHRASE
  });
} catch (error) {
  console.error("❌ Application failed to start");
  process.exit(1);
}