---
name: the-mailman
description: Manages message delivery, content scheduling, notification dispatch, and cross-posting across channels. Use before publishing any scheduled content, when configuring notification pipelines, or when setting up cross-platform distribution workflows.
license: MIT
---

# The Mailman

## Overview

The Mailman does not create content. It *delivers* it. Every notification reaches its destination. Every scheduled post publishes on time. Every cross-post appears in every channel it belongs in. The Mailman is the Society's outgoing communications infrastructure — the courier that ensures nothing gets lost in transit, no deadline slips, and no channel goes silent.

## When to Use

- Before publishing any scheduled content — to verify delivery pipeline integrity
- When configuring notification systems (email, push, webhook, Slack)
- When setting up cross-posting workflows (blog → Dev.to, PR → Slack, release → Twitter)
- When a scheduled task failed to execute or a notification wasn't delivered
- When auditing delivery logs for reliability metrics

## Process

### Delivery Pipeline Verification

1. Check the delivery manifest: what needs to go where, and by when
2. Verify each channel's health:
   - **Email**: SMTP reachable, queue depth normal, bounce rate below threshold
   - **Push**: Web Push API endpoint reachable, subscription count matches expected
   - **Webhook**: Target endpoints respond 200, timeout configs aren't too tight
   - **Social**: API keys are valid, rate limits aren't exhausted
3. Dry-run the batch: simulate delivery without sending live
4. If dry-run passes, release the batch with tracking headers
5. After delivery, confirm receipt signals — log any failures for retry

### Content Scheduling

1. Accept the content payload: article body, metadata, target channels, publish time
2. Check the schedule against channel constraints:
   - Rate limits (API calls per hour, posts per day)
   - Time-of-day preferences (don't post at 3 AM local if it's a personal account)
   - Content size limits (Twitter has 280 chars, Dev.to has 800 title chars)
3. Register scheduled delivery in two places:
   - **Local job queue**: for immediate execution responsibility
   - **Persistent store**: for crash recovery (if the scheduler restarts, what still needs to go out?)
4. At publish time, execute the delivery and log status

```bash
# Example: schedule a blog post for cross-publishing
the-mailman schedule \
  --source "./content/blog/my-post.mdx" \
  --channels "devto,twitter,linkedin" \
  --at "2026-07-10T14:00:00Z" \
  --dry-run
```

### Notification Dispatch

1. Determine the notification type: push, email, in-app, webhook
2. Route through the appropriate provider:
   - **Push**: Web Push API (VAPID keys, subscription management)
   - **Email**: SMTP / SendGrid / SES via transport layer
   - **Webhook**: HTTP POST with signature verification
   - **In-app**: Server-Sent Events or WebSocket broadcast
3. Apply per-channel formatting (HTML for email, markdown for webhook, notification payload for push)
4. Send with idempotency key — if the same notification is submitted twice, it should only be delivered once
5. On failure: retry with exponential backoff (1s → 4s → 16s → max 3 retries), then escalate

### Cross-Posting Workflow

1. Read the source content and parse its metadata (title, summary, tags, canonical URL)
2. For each target platform, transform the content:
   - **Dev.to**: Markdown body + frontmatter metadata, rate-limit to 1 post per 30s
   - **LinkedIn**: Text-only summary + link card (API doesn't support full Markdown)
   - **Twitter/X**: Compose thread from sections, each chunk under 280 chars
   - **HashNode**: Markdown body + tags, API key required
3. Submit to each platform sequentially (not parallel — respect rate limits)
4. Store the canonical-published-URL mappings: `{ source: "/blog/my-post", devto: "https://dev.to/...", twitter: "https://x.com/..." }`
5. If any platform fails, log the failure and continue — partial delivery is better than no delivery

### Delivery Logging & Auditing

Every delivery attempt records:

```json
{
  "id": "dlv_abc123",
  "type": "cross-post",
  "source": "blog/my-post",
  "channels": ["devto", "twitter"],
  "status": "partial",
  "results": {
    "devto": { "status": "delivered", "url": "https://dev.to/...", "latency": 1200 },
    "twitter": { "status": "failed", "error": "rate_limit_exceeded", "retryAt": "2026-07-06T14:01:00Z" }
  },
  "timestamp": "2026-07-06T14:00:00Z"
}
```

The Mailman maintains a rolling 7-day delivery log and can answer:
- What was delivered in the last 24 hours?
- Which channel has the highest failure rate?
- Are any scheduled tasks overdue?

## Red Flags

- A scheduled post that did not publish at its target time
- A notification channel with delivery latency > 30 seconds
- Delivery logs showing the same task submitted more than 3 times
- An API key expiring within the next 7 days
- A cross-posting target that has not received content in 30+ days
- A webhook endpoint returning non-200 for 3 consecutive attempts

## Rationalizations

| What you think | What The Mailman knows |
|---------------|----------------------|
| "I'll just post it manually" | Manual posting forgets channels. Automation remembers all of them. |
| "The notification went through, I saw it" | One success doesn't mean the pipeline is healthy. Check the logs. |
| "Scheduling a week ahead is risky" | Scheduling with a dry-run is safer than last-minute publishing. |
| "Rate limits won't matter for one post" | They matter when you're resubmitting the failed post plus the new one. |

## Verification

Before a scheduled publish:

- [ ] Delivery manifest is complete — every channel listed
- [ ] All target API keys are valid and not expiring within 7 days
- [ ] Rate limits are respected — no channel exceeds 80% of its hourly quota
- [ ] Dry-run passed — no formatting errors, no missing fields
- [ ] Idempotency keys are set — duplicate submissions won't double-deliver
- [ ] Retry policy is configured — exponential backoff with max 3 attempts
- [ ] Fallback channel exists for critical notifications (email is always the fallback)
- [ ] Delivery log is being written to the configured output
