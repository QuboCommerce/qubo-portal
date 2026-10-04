# Support, chatbot and AI: design

Status: knowledgebase built (`packages/kb`, `GET /v1/kb`). Chatbot, tickets and support
grants are planned. This document is the contract they get built against.

## Three assistants, three trust levels

| Assistant | Lives in | Reader | Can see |
| --- | --- | --- | --- |
| Website chat | marketing | anyone | `public` KB entries, live prices |
| Account help | portal | signed-in customer | + `customer` entries, **their own** account, servers, invoices, tickets |
| Front desk | portal (staff) | Qubo staff | + `staff` entries, any customer's account metadata, support grants |

The Puck editor assistant inside Qubo is a separate product feature. It runs on the customer's
server with their own AI key (or a Copilot/ACP bridge later) and never talks to this one.

## Security model

1. **Permissions live in tools, not prompts.** The model can ask for anything. Each tool
   (`kb.search`, `account.instances`, `tickets.create`, …) checks the **session** and returns
   only what that session may read. A jailbreak can change what the model *says*, not what
   the tools *return*. Asking for "Mostapha's IP" in the website chat fails because the
   public toolset has no tool that can answer it.
2. **Audience comes from the session**, never from the request (`/v1/kb` already enforces
   this). Staff = verified email in `PORTAL_STAFF_EMAILS` until staff roles exist.
3. **Live facts beat retrieval.** Prices and limits come from `@qubo-portal/plans` through
   KB placeholders or a tool, never from embeddings that could be stale.
4. **Customer business data stays on their server.** The portal knows names, plan, billing,
   server version/health and usage counts (heartbeat). It doesn't hold orders, products or
   end-customer personal data, so a portal breach can't leak them.
5. **Server access needs consent.** Staff reach a customer's server only through a support
   grant: requested in the portal, approved in the customer's Qubo admin, time-boxed (e.g.
   24 h), scoped, revocable and logged on both sides. Self-hosted customers can refuse.
6. **Everything is logged.** Every assistant tool call records the session, tool and
   arguments. Ticket transcripts are retained under the privacy policy.
7. **The model only sees the minimum.** Tool results are trimmed to the fields the answer
   needs before they reach the model. The API key stays server-side with per-session rate limits.

Server IPs: the portal does not store them today. When managed hosting arrives they become
staff-only fields, never exposed to customer or public tools.

## Tickets

Signed-in "talk to a person" creates a ticket (account, org, server, transcript). Staff work
them in the portal, with the front-desk assistant drafting replies from the KB and account
tools. Anonymous visitors get a contact form instead (email + message, rate-limited).

## Retrieval later

`search()` is keyword ranking over a few dozen entries. When KB plus resolved tickets outgrow
it: pgvector in the portal database, one embedding per entry/chunk with its `audience`
stored next to it, filtered **in SQL** before ranking. Same boundary, different ranking.
