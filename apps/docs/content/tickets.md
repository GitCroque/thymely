# Tickets

Tickets are the core of Thymely. They represent support requests, tasks, bugs, or any work item your team needs to track.

## Creating a ticket

There are several ways to create a ticket:

- **Internal**: from the web interface, click **Create Ticket** in the sidebar or on the tickets page.
- **Client portal**: external users with a client account can submit tickets through the portal.
- **Email**: if IMAP is configured, incoming emails automatically create tickets. See [Email Integration](/email).

When creating a ticket, you can set:

- **Title** and **description** (rich text editor)
- **Priority**: Low, Medium, or High
- **Type**: Incident, Service, Feature, Bug, Maintenance, Access, or Feedback
- **Assignee**: the engineer responsible for the ticket
- **Client**: the external contact associated with the ticket

## Ticket lifecycle

Tickets move through the following statuses:

```
Open --> In Progress --> In Review --> Done / Closed
```

- **Open**: newly created, not yet being worked on.
- **In Progress**: actively being handled by an engineer.
- **In Review**: work is done, pending validation.
- **Done**: resolved and closed.

You can also mark a ticket as **hidden** to remove it from default views without deleting it.

## Assigning tickets

Tickets can be assigned to any internal user (engineer or admin). Assign from the ticket detail page or during creation. Reassignment is possible at any time.

## Comments

Add comments to a ticket to communicate with your team or with the client. Comments support rich text formatting.

If email integration is configured, comments can trigger email notifications to the client.

## File attachments

Attach files to tickets (up to 10 MB per file). Supported for both ticket creation and comments.

## Time tracking

Track time spent on a ticket from the ticket detail page. Time entries are logged per user and can be used for reporting.

## Labels

Apply labels to tickets for categorization and filtering. Labels are created and managed in the admin panel.

## Priorities

Three priority levels are available:

| Priority | Use case |
| --- | --- |
| **Low** | Non-urgent requests, general questions |
| **Medium** | Standard support requests |
| **High** | Urgent issues requiring immediate attention |

## Ticket types

| Type | Description |
| --- | --- |
| Incident | Something is broken or not working |
| Service | General service request |
| Feature | Feature request or enhancement |
| Bug | Software bug report |
| Maintenance | Scheduled maintenance task |
| Access | Access or permission request |
| Feedback | User feedback or suggestion |
