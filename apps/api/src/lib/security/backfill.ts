import { prisma } from "../../prisma";
import { encryptSecret } from "./secrets";

function isEncrypted(value: string | null | undefined): boolean {
  return Boolean(value && value.startsWith("enc:v1:"));
}

export async function backfillEncryptedSecrets() {
  const oauthProviders = await prisma.oAuthProvider.findMany({
    select: { id: true, clientSecret: true },
  });

  for (const provider of oauthProviders) {
    if (!provider.clientSecret || isEncrypted(provider.clientSecret)) {
      continue;
    }

    await prisma.oAuthProvider.update({
      where: { id: provider.id },
      data: {
        clientSecret: (await encryptSecret(provider.clientSecret)) as string,
      },
    });
  }

  const oidcConfigs = await prisma.openIdConfig.findMany({
    select: { id: true, clientSecret: true },
  });

  for (const config of oidcConfigs) {
    if (!config.clientSecret || isEncrypted(config.clientSecret)) {
      continue;
    }

    await prisma.openIdConfig.update({
      where: { id: config.id },
      data: {
        clientSecret: await encryptSecret(config.clientSecret),
      },
    });
  }

  const emailProviders = await prisma.email.findMany({
    select: {
      id: true,
      pass: true,
      clientSecret: true,
      refreshToken: true,
      accessToken: true,
    },
  });

  for (const provider of emailProviders) {
    const data: Record<string, string> = {};

    if (provider.pass && !isEncrypted(provider.pass)) {
      data.pass = (await encryptSecret(provider.pass)) as string;
    }
    if (provider.clientSecret && !isEncrypted(provider.clientSecret)) {
      data.clientSecret = (await encryptSecret(provider.clientSecret)) as string;
    }
    if (provider.refreshToken && !isEncrypted(provider.refreshToken)) {
      data.refreshToken = (await encryptSecret(provider.refreshToken)) as string;
    }
    if (provider.accessToken && !isEncrypted(provider.accessToken)) {
      data.accessToken = (await encryptSecret(provider.accessToken)) as string;
    }

    if (Object.keys(data).length > 0) {
      await prisma.email.update({
        where: { id: provider.id },
        data,
      });
    }
  }

  const emailQueues = await prisma.emailQueue.findMany({
    select: {
      id: true,
      password: true,
      clientSecret: true,
      refreshToken: true,
      accessToken: true,
    },
  });

  for (const queue of emailQueues) {
    const data: Record<string, string> = {};

    if (queue.password && !isEncrypted(queue.password)) {
      data.password = (await encryptSecret(queue.password)) as string;
    }
    if (queue.clientSecret && !isEncrypted(queue.clientSecret)) {
      data.clientSecret = (await encryptSecret(queue.clientSecret)) as string;
    }
    if (queue.refreshToken && !isEncrypted(queue.refreshToken)) {
      data.refreshToken = (await encryptSecret(queue.refreshToken)) as string;
    }
    if (queue.accessToken && !isEncrypted(queue.accessToken)) {
      data.accessToken = (await encryptSecret(queue.accessToken)) as string;
    }

    if (Object.keys(data).length > 0) {
      await prisma.emailQueue.update({
        where: { id: queue.id },
        data,
      });
    }
  }

  const webhooks = await prisma.webhooks.findMany({
    select: { id: true, secret: true },
  });

  for (const webhook of webhooks) {
    if (!webhook.secret || isEncrypted(webhook.secret)) {
      continue;
    }

    await prisma.webhooks.update({
      where: { id: webhook.id },
      data: {
        secret: await encryptSecret(webhook.secret),
      },
    });
  }
}
