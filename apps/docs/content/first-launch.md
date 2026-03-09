# First Launch

After [installing Thymely](/installation), here is what to do on your first login.

## Log in

Open `http://<your-server-ip>:3000` and log in with:

- **Email**: `admin@admin.com`
- **Password**: the value of `THYMELY_BOOTSTRAP_PASSWORD`, or check the container logs if you did not set one.

## Onboarding checklist

### 1. Change the admin password

Go to your **profile** (top-right menu) and change the default password immediately.

### 2. Configure email (optional)

If you want Thymely to send email notifications or receive tickets by email:

1. Go to **Admin > SMTP Email**.
2. Enter your SMTP server details (host, port, username, password).
3. For inbound email (IMAP), configure the IMAP settings in the same section.

See [Email Integration](/email) for details.

### 3. Create a team

Go to **Admin > Teams** and create your first team. Teams help organize which engineers handle which tickets.

### 4. Invite users

Go to **Admin > Internal Users** to create accounts for your team members.

### 5. Create your first ticket

Go to **Tickets** in the sidebar and click **Create Ticket**. Fill in a title, description, priority, and assignee. That's it.

## What's next

- [Tickets](/tickets) -- learn about ticket lifecycle, labels, and time tracking.
- [Users & Clients](/users) -- set up clients and configure roles.
- [Authentication](/authentication) -- enable OAuth2 or OIDC login.
