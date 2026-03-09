# Webhooks

Webhooks allow Thymely to notify external systems when events occur. You can use them to integrate with Slack, Discord, or any service that accepts HTTP callbacks.

## Creating a webhook

1. Go to **Admin > Webhooks**.
2. Click **Create Webhook**.
3. Enter the webhook URL (must be HTTPS unless `ALLOW_INSECURE_WEBHOOK_URLS=true` is set in your environment).
4. Select the events you want to trigger the webhook.
5. Save.

## Event types

Webhooks are triggered on ticket events, such as:

- Ticket created
- Ticket updated
- Ticket status changed
- Comment added

## Payload format

Webhook payloads are sent as `POST` requests with a JSON body containing the event type and relevant ticket data.

Example payload:

```json
{
  "event": "ticket.created",
  "ticket": {
    "id": "abc123",
    "title": "Cannot access dashboard",
    "priority": "High",
    "status": "open",
    "assignee": "engineer@example.com"
  }
}
```

## Built-in integrations

Thymely also supports direct integrations with:

- **Slack**: send ticket notifications to a Slack channel.
- **Discord**: send ticket notifications to a Discord channel via webhook URL.

These are configured separately in the admin panel.

## Troubleshooting

- **Webhook not firing**: check that the webhook URL is reachable from the server running Thymely.
- **SSL errors**: if using a self-signed certificate on the receiving end, set `ALLOW_INSECURE_WEBHOOK_URLS=true`.
- **Timeouts**: webhook requests have a timeout. If the receiving server is slow, the delivery may fail.
