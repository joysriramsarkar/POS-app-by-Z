# POS App Maintenance Notes

Current pass: April 2026 project-wide cleanup and verification.

## Completed
- Fixed product cursor pagination so paged product loads no longer skip one item.
- Hardened sale stock deduction by aggregating duplicate product IDs before stock validation and SQL updates.
- Added server-side sale item total validation to reject mismatched quantity, unit price, and line total payloads.
- Fixed prepaid checkout accounting so prepaid balance is not double-counted against customer dues.
- Made change-as-prepayment part of sale creation/sync instead of a separate best-effort request.
- Refreshed customers after checkout so due/prepaid balances update immediately in the UI.
- Gated Prisma query/lifecycle logging behind env flags to reduce production/build noise.
- Removed tracked scratch/patch files and an obsolete checkout example text file.

## Verification
- `npm run check` passed.
- `npm run build` passed.
- `npm run test` could not run because the `bun` executable is not installed on this machine.
