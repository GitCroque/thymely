import { prisma } from "../../prisma";
import { decryptSecret } from "../security/secrets";

const nodemailer = require("nodemailer");
const { ConfidentialClientApplication } = require("@azure/identity");

export async function createTransportProvider() {
  const provider = await prisma.email.findFirst({});

  if (!provider) {
    throw new Error("No email provider configured.");
  }

  const clientSecret = await decryptSecret(provider?.clientSecret);
  const refreshToken = await decryptSecret(provider?.refreshToken);
  const accessToken = await decryptSecret(provider?.accessToken);
  const password = await decryptSecret(provider?.pass);

  if (provider?.serviceType === "gmail") {
    return nodemailer.createTransport({
      service: "gmail",
      host: "smtp.gmail.com",
      port: 465,
      secure: true,
      auth: {
        type: "OAuth2",
        user: provider?.user,
        clientId: provider?.clientId,
        clientSecret,
        refreshToken,
        accessToken,
        expiresIn: provider?.expiresIn,
      },
    });
  } else if (provider?.serviceType === "microsoft") {
    // Microsoft
    const cca = new ConfidentialClientApplication({
      auth: {
        clientId: provider?.clientId,
        authority: `https://login.microsoftonline.com/${provider?.tenantId}`,
        clientSecret,
      },
    });

    const result = await cca.acquireTokenByClientCredential({
      scopes: ["https://graph.microsoft.com/.default"],
    });

    return nodemailer.createTransport({
      service: "hotmail",
      auth: {
        type: "OAuth2",
        user: provider?.user,
        clientId: provider?.clientId,
        clientSecret,
        accessToken: result.accessToken,
      },
    });
  } else if (provider?.serviceType === "other") {
    // Username/password configuration
    return nodemailer.createTransport({
      host: provider.host,
      port: provider?.port,
      secure: provider?.port === "465" ? true : false, // true for 465, false for other ports
      auth: {
        user: provider?.user,
        pass: password,
      },
    });
  } else {
    throw new Error("No valid authentication method configured.");
  }
}
