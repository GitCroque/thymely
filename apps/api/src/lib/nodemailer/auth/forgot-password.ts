import { prisma } from "../../../prisma";
import { createTransportProvider } from "../transport";

export async function forgotPassword(
  recipientEmail: string,
  link: string,
  token: string
) {
  try {
    const emailConfig = await prisma.email.findFirst();
    const resetLink = `${link}/auth/reset-password?token=${token}`;

    if (!emailConfig) {
      return;
    }

    const transport = await createTransportProvider();

    await transport.sendMail({
      from: emailConfig.reply,
      to: recipientEmail,
      subject: "Password Reset Request",
      text: `Reset your password using this link: ${resetLink}`,
      html: `
      <!DOCTYPE html>
      <html lang="en">
        <head>
          <meta http-equiv="Content-Type" content="text/html; charset=UTF-8" />
        </head>
        <body style="background-color:#ffffff;margin:0 auto;font-family:-apple-system, BlinkMacSystemFont, 'Segoe UI', 'Roboto', 'Oxygen', 'Ubuntu', 'Cantarell', 'Fira Sans', 'Droid Sans', 'Helvetica Neue', sans-serif">
          <table align="center" role="presentation" cellspacing="0" cellpadding="0" border="0" width="100%" style="max-width:600px;margin:0 auto">
            <tr>
              <td>
                <h1 style="color:#1d1c1d;font-size:16px;font-weight:700;margin:10px 0;line-height:42px">Password Reset</h1>
                <p style="font-size:16px;line-height:24px">A password reset was requested for your account.</p>
                <p style="font-size:16px;line-height:24px">
                  <a href="${resetLink}" target="_blank" rel="noopener noreferrer">Reset your password</a>
                </p>
                <p style="font-size:14px;color:#000">If you did not request this, you can safely ignore this email.</p>
                <p style="font-size:12px;line-height:15px;color:#b7b7b7;margin-top:24px">This was an automated message sent by Thymely.</p>
              </td>
            </tr>
          </table>
        </body>
      </html>
      `,
    });
  } catch (error) {
    console.log(error);
  }
}
