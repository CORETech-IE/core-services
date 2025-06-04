// import defaultConfig from "../config/envConfig";

export function validateConfig(config: any): void {
  const requiredVars: { key: string; label: string }[] = [
    { key: "clientId", label: "CLIENT_ID" },
    { key: "clientSecret", label: "CLIENT_SECRET" },
    { key: "tenantId", label: "TENANT_CLIENT_ID" },
    { key: "senderEmail", label: "SENDER_EMAIL" },
  ];
 
  console.log("DEBUG config:", config);
 
  // Handle null config (can happen in standalone mode if not properly loaded)
  if (!config) {
    console.error("❌ Configuration is null or undefined");
    process.exit(1);
  }
 
  const missing = requiredVars.filter(({ key }) => !config[key]);
 
  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach(({ label }) => console.error(`  - ${label}`));
    process.exit(1);
  }
 
  console.log("✅ All required environment variables are present.");
}