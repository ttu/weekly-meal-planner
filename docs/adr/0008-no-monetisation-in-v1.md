# 0008 — No ads or monetisation in v1

Status: Accepted · 2026-08-29

## Context

Running costs are about $25/month for Supabase Pro plus $99/year for Apple. Ads
were considered as a way to cover them.

## Decision

Ship v1 with no ads, no subscription and no analytics SDK.

## Consequences

- Ad revenue would plausibly cover $25/month somewhere in the low hundreds of
  households, but requires a certified consent platform for the EU, a privacy
  policy, and a first-run consent step — disproportionate work for the amount,
  and a poor first impression for a shared kitchen app.
- AdMob's $100 payout threshold means revenue would accrue unpaid for months
  while costs are charged monthly.
- Costs are borne directly until the app has enough households to make
  monetisation a genuine question. At that point a small household subscription
  is the better option and beats every ad scenario modelled.
- Adding analytics later requires consent and its own ADR, not a library
  install.
