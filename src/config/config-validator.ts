import config from "../config/envConfig";
export function validateConfig(): void {
  const requiredVars: { key: keyof typeof config; label: string }[] = [
    { key: "clientId", label: "CLIENT_ID" },
    { key: "clientSecret", label: "CLIENT_SECRET" },
    { key: "tenantId", label: "TENANT_CLIENT_ID" },
    { key: "senderEmail", label: "SENDER_EMAIL" },
  ];

  console.log("DEBUG config:", config);

  const missing = requiredVars.filter(({ key }) => !config[key]);

  if (missing.length > 0) {
    console.error("❌ Missing required environment variables:");
    missing.forEach(({ label }) => console.error(`  - ${label}`));
    process.exit(1);
  }

  console.log("✅ All required environment variables are present.");
}
