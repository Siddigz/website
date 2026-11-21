# What the owner sets on Vercel

Everything here is set by the owner in the Vercel dashboard, for the project
`siddig-portfolio`. Nothing in this list is ever written into the repository,
and no value should pass through a chat. `.env.example` holds the same names
with no values.

Done so far is marked. The rest is in the order it is needed.

## 1. Settings (Settings → Environment Variables)

Each one: type **Secret**, and tick **Production** and **Preview** unless it
says otherwise. After changing a setting, redeploy for it to take effect.

| Name | What it is | Where the value comes from | Status |
|---|---|---|---|
| `GITHUB_ACTIVITY_TOKEN` | Lets the build read the public contribution graph and recent commits. Without it the GitHub activity section is left out. When the token expires the section quietly disappears from the next build, so note its expiry date somewhere you will see it. | A fine-grained GitHub token with no extra permissions. | Done |
| `CONTACT_ADDRESS` | The address the Email button reveals. | Typed in by hand. | Done |
| `CONTACT_TOKEN_SECRET` | Signs the one-minute tokens the Email button uses. | A random value (see below). | Done |
| `CRON_SECRET` | Vercel sends it when it calls the daily rebuild, so nobody else can trigger one. | A random value (see below). | Done |
| `DEPLOY_HOOK_URL` | The address that starts a new production build. The daily rebuild calls it. **Production only.** | Made in step 2. | After ship |
| `RESUME_ENABLED` | The resume switch. Only the exact word `true` turns it on. Leave it unset for off. Not a secret. | Typed in by hand. | Only if wanted |
| `RESUME_URL` | A private `https` address of the resume PDF. Without it, a blank page is served when the switch is on. | Wherever the file is kept privately. | Only if wanted |

To make a random value without it appearing on screen or in a chat, run this
and paste straight into the Value box. Run it again for each setting, so no
two share a value.

```bash
openssl rand -hex 32 | pbcopy
```

## 2. Deploy hook, after the new site is live

1. Settings → Git → Deploy Hooks. Name it `daily`, branch `main`, and create it.
2. Copy the address it shows.
3. Add it as `DEPLOY_HOOK_URL` (Secret, Production only).
4. Redeploy. The next morning, check Deployments for a build started by the hook
   at about 10:00 UTC.

## 3. Web Analytics

Analytics → enable Web Analytics. The pages already ask for the script; until
this is on, that request answers "not found", which is harmless but shows in
the browser's console.

## 4. Firewall

Firewall → add a rate limit rule: path starts with `/api/contact/`, at most
10 requests per minute per visitor (by IP address), then deny. The site also
limits this itself; the rule is the stronger of the two.

Leave bot protection (a challenge page) off for this path unless the Email
button has been tried on the preview with it on: the button calls these
addresses in the background, where a challenge page cannot be answered, so
it may simply stop working for real visitors.

## 5. Domain

Done on 2026-11-21. Settings → Domains: `siddigz.com` is connected to
Production, and every other address the project answers on redirects to it
permanently.
