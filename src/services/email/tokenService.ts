import axios from 'axios';
import qs from 'querystring';

export interface TokenServiceConfig {
  tokenEndpoint: string;
  tenantId: string;
  clientId: string;
  clientSecret: string;
}

let cachedToken: {
  value: string;
  expiresAt: number;
} | null = null;

export async function getAccessToken(config: TokenServiceConfig): Promise<string> {
  const now = Date.now();
  
  // Return cached token if still valid
  if (cachedToken && cachedToken.expiresAt > now + 60_000) {
    return cachedToken.value;
  }

  const url = `${config.tokenEndpoint}/${config.tenantId}/oauth2/v2.0/token`;
  const data = qs.stringify({
    client_id: config.clientId,
    client_secret: config.clientSecret,
    scope: 'https://graph.microsoft.com/.default',
    grant_type: 'client_credentials'
  });

  const headers = {
    'Content-Type': 'application/x-www-form-urlencoded'
  };

  const response = await axios.post(url, data, { headers });
  const { access_token, expires_in } = response.data;

  // Cache token with expiration time
  cachedToken = {
    value: access_token,
    expiresAt: now + expires_in * 1000
  };

  console.log('[core-services] OAuth token acquired from Microsoft Graph');
  return access_token;
}