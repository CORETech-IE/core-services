import axios from "axios";
import { getServiceContainer } from "../services/serviceContainer";
import logger from "./logging";

let cachedToken = "";
let tokenExpiresAt = 0;

export interface AuthConfig {
  authUrl: string;
  authUsername: string;
  authPassword: string;
}

export async function getAuthToken(): Promise<string> {
  const startTime = Date.now();
  const now = Date.now();

  // Check if we have a valid cached token
  if (cachedToken && now < tokenExpiresAt) {
    logger.auth('Using cached auth token', {
      token_cached: true,
      expires_in_ms: tokenExpiresAt - now,
      expires_in_minutes: Math.round((tokenExpiresAt - now) / 60000)
    });
    return cachedToken;
  }

  try {
    // Get auth config from service container
    const container = getServiceContainer();
    const authConfig = container.getAuthConfig();
    
    logger.auth('Requesting new auth token', {
      auth_url: authConfig.authUrl,
      auth_username: authConfig.authUsername,
      has_auth_password: !!authConfig.authPassword,
      password_length: authConfig.authPassword?.length || 0,
      token_expired: cachedToken && now >= tokenExpiresAt,
      had_cached_token: !!cachedToken,
      // VERBOSE ONLY: Show more details for debugging
      ...(logger.isVerbose() && {
        verbose_auth_url: authConfig.authUrl,
        verbose_username: authConfig.authUsername,
        verbose_password_masked: authConfig.authPassword ? 
          authConfig.authPassword.substring(0, 3) + '*'.repeat(authConfig.authPassword.length - 3) : 
          'NOT_SET'
      })
    });

    if (!authConfig.authUrl || !authConfig.authUsername || !authConfig.authPassword) {
      logger.auth('Authentication configuration incomplete', {
        error_code: 'MISSING_AUTH_CONFIG',
        has_url: !!authConfig.authUrl,
        has_username: !!authConfig.authUsername,
        has_password: !!authConfig.authPassword,
        duration_ms: Date.now() - startTime
      });
      throw new Error("Missing authentication configuration");
    }

    const authRequestStart = Date.now();
    
    logger.auth('Sending authentication request', {
      auth_url: authConfig.authUrl,
      request_payload_keys: ['username', 'password'],
      duration_ms: Date.now() - startTime
    });

    const response = await axios.post(`${authConfig.authUrl}`, {
      username: authConfig.authUsername,
      password: authConfig.authPassword,
    });

    const authRequestDuration = Date.now() - authRequestStart;

    if (response.status !== 200 || !response.data?.token) {
      logger.auth('Invalid response from auth server', {
        error_code: 'INVALID_AUTH_RESPONSE',
        status_code: response.status,
        has_token: !!response.data?.token,
        has_response_data: !!response.data,
        auth_request_duration_ms: authRequestDuration,
        total_duration_ms: Date.now() - startTime
      });
      throw new Error("Invalid response from auth server");
    }

    cachedToken = response.data.token;
    
    const expiresIn = response.data.expiresIn || 3600; // en segundos
    tokenExpiresAt = now + expiresIn * 1000 - 10000; // 10s de margen
    
    // Calculate token info for logging (but never log the actual token)
    const tokenLength = cachedToken.length;
    const tokenPrefix = cachedToken.substring(0, 8);
    const tokenSuffix = cachedToken.substring(cachedToken.length - 4);
    
    logger.auth('Auth token received successfully', {
      token_length: tokenLength,
      token_preview: `${tokenPrefix}...${tokenSuffix}`,
      expires_in_seconds: expiresIn,
      expires_in_minutes: Math.round(expiresIn / 60),
      expires_at: new Date(tokenExpiresAt).toISOString(),
      auth_request_duration_ms: authRequestDuration,
      total_duration_ms: Date.now() - startTime,
      // VERBOSE ONLY: More token details for debugging
      ...(logger.isVerbose() && {
        verbose_token_full: cachedToken, // ONLY in verbose mode
        verbose_response_keys: Object.keys(response.data || {}),
        verbose_response_status: response.status,
        verbose_response_headers_content_type: response.headers['content-type']
      })
    });
    
    return cachedToken;
    
  } catch (err: any) {
    const errorDuration = Date.now() - startTime;
    const isAxiosError = err.response;
    
    logger.auth('Authentication failed', {
      error_code: 'AUTHENTICATION_FAILED',
      error_message: err.message,
      duration_ms: errorDuration,
      is_network_error: !isAxiosError,
      ...(isAxiosError && {
        response_status: err.response?.status,
        response_status_text: err.response?.statusText,
        response_data_available: !!err.response?.data
      }),
      // VERBOSE ONLY: Detailed error info
      ...(logger.isVerbose() && {
        verbose_error_stack: err.stack,
        verbose_response_data: err.response?.data,
        verbose_request_config: {
          url: err.config?.url,
          method: err.config?.method,
          timeout: err.config?.timeout
        }
      })
    });

    throw new Error("Authentication failed");
  }
}