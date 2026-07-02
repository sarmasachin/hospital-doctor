# livehospital.org — Email Setup Guide

`support@livehospital.org` tab kaam karne ke liye domain registrar par email forwarding setup karein.

## Option 1: Domain Registrar (Recommended)

Most registrars (GoDaddy, Namecheap, Hostinger, Cloudflare):

1. Login to domain panel → **Email** or **Email Forwarding**
2. Create forward:
   - `support@livehospital.org` → `sharma.sachinctr@gmail.com`
   - `privacy@livehospital.org` → `sharma.sachinctr@gmail.com`
3. Save and wait 15–60 minutes for DNS propagation

## Option 2: Cloudflare Email Routing (Free)

1. Add domain to Cloudflare
2. **Email** → **Email Routing** → Enable
3. Add destination: `sharma.sachinctr@gmail.com` (verify)
4. Create rules:
   - `support@livehospital.org` → forward to Gmail
   - `privacy@livehospital.org` → forward to Gmail

## Option 3: Google Workspace (Paid)

Professional inbox at `@livehospital.org` — ~$6/user/month.

## Verify

After setup, send test email to `support@livehospital.org` — it should arrive in your Gmail.

## Website mailto links

Even before forwarding is live, website `mailto:support@livehospital.org` links work in the user's email app.
