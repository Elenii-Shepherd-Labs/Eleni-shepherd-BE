# Contributing

## Principles

- Keep backend business rules and provider orchestration on the server.
- Keep controllers thin and move workflow logic into services.
- Preserve mobile compatibility when changing auth, onboarding, or response shapes.
- Update docs when contracts, environment requirements, or operational behavior change.

## Local Setup

1. Copy `.env.example` to `.env`.
2. Install dependencies with `npm install`.
3. Start required services:
   - MongoDB
   - Redis
   - optional `vision-service` for Python vision flows
4. Run the backend with `npm run start:dev`.

## Change Workflow

1. Read the relevant docs in `docs/` before changing auth, onboarding, AI, or vision flows.
2. Make the smallest server-side change that preserves the public contract.
3. Update `docs/api.md`, `docs/workflows.md`, or `README.md` if behavior changed.
4. Run the checks that match your change:
   - `npm run build`
   - `npm test`

## Pull Request Checklist

- Explain user-facing behavior changes, not only code changes.
- Call out any backend contract changes that mobile must consume.
- Include new environment variables in `.env.example`.
- Note any deployment or migration steps in `docs/deployment.md`.
