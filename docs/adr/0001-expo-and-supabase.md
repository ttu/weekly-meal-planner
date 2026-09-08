# 0001 — Expo and Supabase as the platform

Status: Accepted · 2026-08-29

## Context

A shared household board used mostly on phones in a kitchen, with several people
editing the same week. It needs auth, a relational store, per-household access
control and live updates, built by a very small team.

## Decision

Expo (React Native) targeting iOS, Android and web, on Supabase — Postgres,
Auth, RLS and Realtime.

## Consequences

- Auth, access control and realtime come as configuration rather than code.
- The relational model (meals ↔ ingredients, aggregation) fits Postgres and
  would fight a document store.
- Expo's web target gives a desktop planning view from the same codebase, which
  is where a week actually gets filled in.
- Free tier is adequate for hundreds of households; the trigger to pay is daily
  backups, not a quota.
- Vendor coupling is real but bounded: with the domain logic pure and the
  Supabase calls confined to `infrastructure`, a move to Convex or a
  self-hosted Postgres is a schema-and-client job.
- App Intents will later require a native target and a development build,
  ending Expo Go use. Known and scheduled, not stumbled into.
