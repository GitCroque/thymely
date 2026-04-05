const { PrismaClient } = require("@prisma/client");
const bcrypt = require("bcrypt");
const crypto = require("crypto");

const prisma = new PrismaClient();

async function main() {
  const setup = await prisma.config.findFirst({});
  const templates = await prisma.emailTemplate.findMany({});

  if (setup === null) {
    const bootstrapPassword =
      process.env.THYMELY_BOOTSTRAP_PASSWORD ||
      crypto.randomBytes(18).toString("base64url");

    await prisma.user.upsert({
      where: { email: "admin@admin.com" },
      update: {},
      create: {
        email: `admin@admin.com`,
        name: "admin",
        isAdmin: true,
        password: await bcrypt.hash(bootstrapPassword, 10),
        language: "en",
      },
    });

    await prisma.client.upsert({
      where: { email: `internal@admin.com` },
      update: {},
      create: {
        email: `internal@admin.com`,
        name: "internal",
        contactName: "admin",
        number: "123456789",
        active: true,
      },
    });

    // Use DATA_ENCRYPTION_KEY from env if provided, otherwise generate a random one
    const envKey = process.env.DATA_ENCRYPTION_KEY;
    let encryptionKey;
    if (envKey) {
      const keyBuffer = Buffer.from(envKey, "hex");
      if (keyBuffer.length !== 32) {
        throw new Error(
          `DATA_ENCRYPTION_KEY must be a 64-character hex string (32 bytes). Got ${envKey.length} characters.`
        );
      }
      encryptionKey = keyBuffer;
      console.log("Using DATA_ENCRYPTION_KEY from environment variable.");
    } else {
      encryptionKey = crypto.randomBytes(32);
      console.warn(
        "[WARN] DATA_ENCRYPTION_KEY not set — generated a random key. " +
          "Set DATA_ENCRYPTION_KEY in .env for reproducible deployments."
      );
    }

    const conf = await prisma.config.create({
      data: {
        gh_version: "1.0.0",
        client_version: "1.0.0",
        encryption_key: encryptionKey,
      },
    });

    await prisma.config.update({
      where: {
        id: conf.id,
      },
      data: {
        first_time_setup: false,
      },
    });

    console.log("");
    console.log("┌────────────────────────────────────────────┐");
    console.log("│  Admin credentials (first login only)      │");
    console.log("│  Email: admin@admin.com                    │");
    if (process.env.THYMELY_BOOTSTRAP_PASSWORD) {
      console.log("│  Password: (set by THYMELY_BOOTSTRAP_PASSWORD) │");
    } else {
      // Write password to stderr only — avoids capture by log aggregators
      // that typically only collect stdout
      console.log("│  Password: (printed to stderr below)      │");
      console.error(`[BOOTSTRAP] Admin password: ${bootstrapPassword}`);
    }
    console.log("│  ⚠ Change this password immediately!       │");
    console.log("└────────────────────────────────────────────┘");
    console.log("");
  } else {
    console.log("No need to seed, already seeded");
  }

  if (templates.length === 0) {
    await prisma.emailTemplate.createMany({
      data: [
        {
          html: `<!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html lang="en">
            <head>
              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            </head>
            <div id="" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Ticket Created<div></div>
            </div>
  
            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">
              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
                <tr style="width:100%">
                  <td>
                    <table style="margin-top:8px" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                    </table>
                    <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;padding:0;line-height:42px">Ticket Assigned</h1>
                    <p style="font-size:20px;line-height:28px;margin:4px 0">
                    <p>Hello, <br>A new ticket has been assigned to you.</p>
                    <p style="font-size:14px;margin:16px 0;color:#000">
                    Kind regards, 
  
                    <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                      <tbody>
                        <tr>
                          <td>
                            <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://github.com/GitCroque/thymely" rel="noopener noreferrer">Documentation</a>   |   <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://discord.gg/8XFkbgKmgv" rel="noopener noreferrer">Discord</a> </a>
                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left">This was an automated message sent by Thymely -> An open source helpdesk solution</p>
                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">Thymely Ticket Management.<br />All rights reserved.</p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
          type: "ticket_assigned",
        },
        {
          html: ` <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html lang="en">

            <head>
              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            </head>
            <div id="" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Ticket Created<div></div>
            </div>

            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">
              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
                <tr style="width:100%">
                  <td>
                    <table style="margin-top:8px" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                    </table>
                    <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;padding:0;line-height:42px">Ticket Update for: {{title}}</h1>
                    <p style="font-size:20px;line-height:28px;margin:4px 0">
                    <p>{{comment}}</p>
                    <p style="font-size:14px;margin:16px 0;color:#000">
                    Kind regards, 

                    <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                      <tbody>
                        <tr>
                          <td>
                          <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://github.com/GitCroque/thymely" rel="noopener noreferrer">Documentation</a>   |   <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://discord.gg/8XFkbgKmgv" rel="noopener noreferrer">Discord</a> </a>
                          <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left">This was an automated message sent by Thymely -> An open source helpdesk solution</p>
                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">Thymely Ticket Management.<br />All rights reserved.</p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          </html>`,
          type: "ticket_comment",
        },
        {
          html: ` <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html lang="en">

            <head>
              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            </head>
            <div id="" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Ticket Created<div></div>
            </div>

            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">
              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
                <tr style="width:100%">
                  <td>
                    <table style="margin-top:8px" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                    </table>
                    <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;padding:0;line-height:42px">Ticket Created: {{id}}</h1>
                    <p style="font-size:20px;line-height:28px;margin:4px 0">
                    <p>Hello, <br>Your ticket has now been created and logged.</p>
                    <p style="font-size:14px;margin:16px 0;color:#000">
                    Kind regards, 

                    <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                      <tbody>
                        <tr>
                          <td>
                          <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://github.com/GitCroque/thymely" rel="noopener noreferrer">Documentation</a>   |   <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://discord.gg/8XFkbgKmgv" rel="noopener noreferrer">Discord</a> </a>
                          <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left">This was an automated message sent by Thymely -> An open source helpdesk solution</p>
                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">Thymely Ticket Management.<br />All rights reserved.</p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>
            </body>

          </html>`,
          type: "ticket_created",
        },
        {
          html: ` <!DOCTYPE html PUBLIC "-//W3C//DTD XHTML 1.0 Transitional//EN" "http://www.w3.org/TR/xhtml1/DTD/xhtml1-transitional.dtd">
          <html lang="en">
          
            <head>
              <meta http-equiv="Content-Type" content="text/html charset=UTF-8" />
            </head>
            <div id="" style="display:none;overflow:hidden;line-height:1px;opacity:0;max-height:0;max-width:0">Ticket Created<div></div>
            </div>
          
            <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, &#x27;Segoe UI&#x27;, &#x27;Roboto&#x27;, &#x27;Oxygen&#x27;, &#x27;Ubuntu&#x27;, &#x27;Cantarell&#x27;, &#x27;Fira Sans&#x27;, &#x27;Droid Sans&#x27;, &#x27;Helvetica Neue&#x27;, sans-serif">
              <table align="center" role="presentation" cellSpacing="0" cellPadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
                <tr style="width:100%">
                  <td>
                    <table style="margin-top:8px" align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                      <tbody>
                        <tr>
                          <td><img alt="Slack" src="https://raw.githubusercontent.com/GitCroque/thymely/main/static/black-side-logo.svg" width="200" height="60" style="display:block;outline:none;border:none;text-decoration:none" /></td>
                        </tr>
                      </tbody>
                    </table>
                    <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;padding:0;line-height:42px">Ticket: {{title}}</h1>
                    <p style="font-size:20px;line-height:28px;margin:4px 0">
                    <p>Your Ticket, now has a status of {{status}}</p>
                    Kind regards, 
                    <br>
                    Thymely ticket management
                    </p>
                    
                    <table align="center" border="0" cellPadding="0" cellSpacing="0" role="presentation" width="100%">
                      <tbody>
                        <tr>
                          <td>
                          <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://github.com/GitCroque/thymely" rel="noopener noreferrer">Documentation</a>   |   <a target="_blank" style="color:#b7b7b7;text-decoration:underline" href="https://discord.gg/8XFkbgKmgv" rel="noopener noreferrer">Discord</a> </a>
                          <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left">This was an automated message sent by Thymely -> An open source helpdesk solution</p>
                            <p style="font-size:12px;line-height:15px;margin:16px 0;color:#b7b7b7;text-align:left;margin-bottom:50px">Thymely Ticket Management.<br />All rights reserved.</p>
                          </td>
                        </tr>
                      </tbody>
                    </table>
                  </td>
                </tr>
              </table>
            </body>
          
          </html>`,
          type: "ticket_status_changed",
        },
      ],
    });
  }
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });
