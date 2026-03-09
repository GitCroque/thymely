# Users & Clients

Thymely distinguishes between two types of accounts: **internal users** (your team) and **clients** (external contacts).

## Internal users

Internal users are members of your organization who manage tickets. They access the full Thymely interface.

### Creating users

Go to **Admin > Internal Users** to create new accounts. Each user needs an email address and a password.

### User roles

When RBAC is enabled (in **Admin > Settings**), users are assigned roles that control their permissions.

Default roles:

- **Admin**: full access to all features, settings, and user management.
- **Engineer**: can create, view, and manage tickets assigned to them or their team.

### Teams

Users can be organized into teams. Teams determine which tickets appear in a user's view and can be used for assignment routing.

## Clients

Clients are external contacts -- your customers, vendors, or anyone who submits support requests.

### Creating clients

Go to **Clients** in the sidebar to create client records. Client information includes name, email, phone, and notes.

### Client portal

Clients with portal access can:

- Submit new tickets
- View the status of their tickets
- Add comments to their tickets

Client accounts are separate from internal user accounts.

## Roles and RBAC

Role-Based Access Control can be enabled in **Admin > Settings**. When enabled:

- Each user is assigned a role.
- Roles define granular permissions (create tickets, manage users, access admin panel, etc.).
- When RBAC is disabled, all authenticated users have full access.

To configure roles, go to **Admin > Roles**.
