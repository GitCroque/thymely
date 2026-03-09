# Authentication

Thymely supports multiple authentication methods: local accounts, OAuth2, and OpenID Connect (OIDC).

## Local authentication

By default, users log in with an email address and password. Passwords are hashed with bcrypt (cost factor 12).

Admin accounts can be created in **Admin > Internal Users**. Users can change their own password from their profile page.

### Password reset

If a user forgets their password, an admin can reset it from the user management page. A one-time password (OTP) is generated and sent by email (if SMTP is configured).

## OAuth2

OAuth2 allows users to log in with an external identity provider (e.g. GitHub, Google, or a custom provider).

### Setup

1. Go to **Admin > Authentication**.
2. Select **OAuth2** as the provider type.
3. Enter the required fields:
   - **Client ID**: provided by your OAuth2 provider
   - **Client Secret**: provided by your OAuth2 provider
   - **Authorization URL**: the provider's authorization endpoint
   - **Token URL**: the provider's token endpoint
   - **Redirect URI**: the callback URL for your Thymely instance (typically `https://<your-domain>/api/v1/auth/oauth/callback`)
4. Save the configuration.

## OpenID Connect (OIDC)

OIDC is built on top of OAuth2 and provides standardized identity verification. It is supported by providers like Authentik, Keycloak, Azure AD, and Okta.

### Requirements

- Set your client type to **Public** in your OIDC provider.
- Have your OIDC well-known configuration URL ready.
- Have your OIDC client ID ready.

### Setup

1. Go to **Admin > Authentication**.
2. Select **OIDC** as the provider type.
3. Enter the required fields:
   - **Issuer**: the well-known configuration URL of your OIDC provider (e.g. `https://auth.example.com/.well-known/openid-configuration`)
   - **Client ID**: provided by your OIDC provider
   - **Redirect URI**: the callback URL for your Thymely instance
4. Save the configuration.

### Logging in with OIDC

Once configured, an OIDC login button appears on the login page. Users click it, authenticate with the external provider, and are redirected back to Thymely.

If a user logs in with OIDC for the first time, an account is automatically created.

## External registration

External registration allows new users to create an account themselves (without an admin invitation). This can be enabled in **Admin > Settings**. Rate limited to 5 requests per 15 minutes.

## Troubleshooting

- **"Account Not Found"**: the user's account may not exist yet. If using OIDC/OAuth2, ensure auto-creation is enabled or create the account manually.
- **Login errors**: check the API logs (`docker compose logs thymely`) for detailed error messages.
- **Callback URL mismatch**: ensure the redirect URI configured in Thymely matches exactly what is registered with your identity provider.
