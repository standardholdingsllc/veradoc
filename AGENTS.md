<!-- BEGIN:nextjs-agent-rules -->
# This is NOT the Next.js you know

This version has breaking changes — APIs, conventions, and file structure may all differ from your training data. Read the relevant guide in `node_modules/next/dist/docs/` before writing any code. Heed deprecation notices.
<!-- END:nextjs-agent-rules -->

## VeraDoc subdomain transition

For any task involving hostname routing, canonical domains, cross-subdomain authentication, generated absolute URLs, or the `demo`, `app`, `notario`, and `admin` surfaces, read `SUBDOMAIN_TRANSITION_AGENT_GUIDE.md` completely before making changes. Treat its invariants, work-package boundaries, verification requirements, and rollout gates as normative for that transition. The guide does not by itself authorize changes to Vercel, DNS, Supabase, OAuth providers, payment providers, signing providers, messaging providers, or other external systems.
