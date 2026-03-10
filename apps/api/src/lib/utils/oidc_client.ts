// utils/oidcClient.js

import { Issuer } from "openid-client";

// eslint-disable-next-line @typescript-eslint/no-explicit-any -- accepts OidcConfigWithSecret from auth cache
export async function getOidcClient(config: any) {
  const oidcIssuer = await Issuer.discover(config.issuer);
  const hasClientSecret = Boolean(config.clientSecret);

  return new oidcIssuer.Client({
    client_id: config.clientId,
    client_secret: hasClientSecret ? config.clientSecret : undefined,
    redirect_uris: [config.redirectUri],
    response_types: ["code"],
    token_endpoint_auth_method: hasClientSecret ? "client_secret_post" : "none",
  });
}
