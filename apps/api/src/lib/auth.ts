// functions for easily finding relevant auth methods

import { prisma } from "../prisma";
import { decryptSecret } from "./security/secrets";

const AUTH_CONFIG_CACHE_TTL_MS = Number(
  process.env.AUTH_CONFIG_CACHE_TTL_MS || "60000"
);

type CachedValue<T> = {
  value: T;
  expiresAt: number;
};

type OidcConfigWithSecret = {
  id: number;
  clientId: string;
  clientSecret: string | null;
  issuer: string;
  redirectUri: string;
};

type OAuthProviderWithSecret = {
  id: number;
  name: string;
  clientId: string;
  clientSecret: string;
  authorizationUrl: string;
  tokenUrl: string;
  userInfoUrl: string;
  redirectUri: string;
  scope: string;
};

let cachedOidcConfig: CachedValue<OidcConfigWithSecret> | null = null;
let cachedOAuthProvider: CachedValue<OAuthProviderWithSecret> | null = null;

export async function getOidcConfig() {
  if (cachedOidcConfig && cachedOidcConfig.expiresAt > Date.now()) {
    return cachedOidcConfig.value;
  }

  const config = await prisma.openIdConfig.findFirst();
  if (!config) {
    throw new Error("Config not found in the database");
  }
  const decryptedClientSecret = await decryptSecret(config.clientSecret);
  const resolvedConfig = {
    ...config,
    clientSecret: decryptedClientSecret ?? null,
  };

  cachedOidcConfig = {
    value: resolvedConfig,
    expiresAt: Date.now() + AUTH_CONFIG_CACHE_TTL_MS,
  };

  return resolvedConfig;
}

export async function getOAuthProvider() {
  if (cachedOAuthProvider && cachedOAuthProvider.expiresAt > Date.now()) {
    return cachedOAuthProvider.value;
  }

  const provider = await prisma.oAuthProvider.findFirst();
  if (!provider) {
    throw new Error(`OAuth provider ${provider} not found`);
  }
  const decryptedClientSecret = await decryptSecret(provider.clientSecret);
  if (!decryptedClientSecret) {
    throw new Error("OAuth provider client secret not found");
  }
  const resolvedProvider = {
    ...provider,
    clientSecret: decryptedClientSecret,
  };

  cachedOAuthProvider = {
    value: resolvedProvider,
    expiresAt: Date.now() + AUTH_CONFIG_CACHE_TTL_MS,
  };

  return resolvedProvider;
}

export async function getSAMLProvider(providerName: any) {
  const provider = await prisma.sAMLProvider.findUnique({
    where: { name: providerName },
  });
  if (!provider) {
    throw new Error(`SAML provider ${providerName} not found`);
  }
  return provider;
}
