import axios from "axios";
import { getServiceContainer } from "../services/serviceContainer";

let cachedToken = "";
let tokenExpiresAt = 0;

export interface AuthConfig {
  authUrl: string;
  authUsername: string;
  authPassword: string;
}

export async function getAuthToken(): Promise<string> {
  const now = Date.now();
  
  if (cachedToken && now < tokenExpiresAt) {
    return cachedToken;
  }

  try {
    // Get auth config from service container
    const container = getServiceContainer();
    const authConfig = container.getAuthConfig();

    if (!authConfig.authUrl || !authConfig.authUsername || !authConfig.authPassword) {
      throw new Error("Missing authentication configuration");
    }

    console.log("🔑 Requesting new auth token...");
    console.log("🔑 Auth URL:", authConfig.authUrl);
    console.log("🔑 Auth Username:", authConfig.authUsername);
    console.log("🔑 Auth Password:", authConfig.authPassword);

    const response = await axios.post(`${authConfig.authUrl}`, {
      username: authConfig.authUsername,
      password: authConfig.authPassword,
    });

    if (response.status !== 200 || !response.data?.token) {
      throw new Error("Invalid response from auth server");
    }

    cachedToken = response.data.token;
    console.log("🔑 Auth token received:", cachedToken);
    
    const expiresIn = response.data.expiresIn || 3600; // en segundos
    tokenExpiresAt = now + expiresIn * 1000 - 10000; // 10s de margen
    
    return cachedToken;
    
  } catch (err: any) {
    console.error("❌ Failed to get auth token:", err.response?.data || err.message);
    throw new Error("Authentication failed");
  }
}