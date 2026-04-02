// utils/oauthClients.js
//@ts-nocheck

const { AuthorizationCode } = require('simple-oauth2');

const oauthClients = {};

interface OAuthProviderConfig {
  name: string;
  clientId: string;
  clientSecret: string;
  tokenUrl: string;
  authorizationUrl: string;
}

export function getOAuthClient(providerConfig: OAuthProviderConfig) {
  const { name } = providerConfig;
  if (!oauthClients[name]) {
    oauthClients[name] = new AuthorizationCode({
      client: {
        id: providerConfig.clientId,
        secret: providerConfig.clientSecret,
      },
      auth: {
        tokenHost: providerConfig.tokenUrl,
        authorizeHost: providerConfig.authorizationUrl,
      },
    });
  }
  return oauthClients[name];
}
