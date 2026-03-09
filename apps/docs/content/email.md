# Email Integration

Thymely can send and receive emails to integrate your helpdesk with standard email workflows.

## SMTP (outbound email)

SMTP allows Thymely to send email notifications -- for example, when a ticket is created or a comment is added.

### Setup

1. Go to **Admin > SMTP Email**.
2. Enter your SMTP server settings:
   - **Host**: your SMTP server address (e.g. `smtp.example.com`)
   - **Port**: typically `587` (STARTTLS) or `465` (SSL)
   - **Username** and **Password**: your SMTP credentials
   - **Reply-to address**: the email address that appears as the sender
3. Save the configuration.
4. Use the **Send Test Email** button to verify the setup.

## IMAP (inbound email)

IMAP allows Thymely to monitor a mailbox and automatically convert incoming emails into tickets.

### Setup

1. Go to **Admin > SMTP Email** (the IMAP settings are in the same section).
2. Enter your IMAP server settings:
   - **Host**: your IMAP server address (e.g. `imap.example.com`)
   - **Port**: typically `993` (SSL)
   - **Username** and **Password**: your mailbox credentials
3. Save the configuration.

Once configured, Thymely periodically checks the mailbox for new messages and creates tickets from them.

### Self-signed certificates

If your mail server uses a self-signed TLS certificate, set `ALLOW_INSECURE_IMAP_TLS=true` in your `.env` file. Only use this in trusted network environments.

## Email queue

Outbound emails are processed through a queue. If an email fails to send, it is retried automatically. You can monitor the email queue in the admin panel.

## Email templates

Email templates are managed in the admin panel under **Admin > Email Templates**. You can customize the content sent for different notification types.
