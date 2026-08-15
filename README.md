Columbia Wireless Site Asset Management, a Next.js + Supabase tower/site management platform built by VeriPura, integrated with SAM 2.0 for document intake.

**Documentation:**
- [`docs/ARCHITECTURE.md`](docs/ARCHITECTURE.md), stack, deployment, auth, multi-tenant org scoping.
- [`docs/DATA_MODEL.md`](docs/DATA_MODEL.md), tables, columns, relationships (reconstructed from code, `supabase/schema.sql` is stale, don't trust it).
- [`docs/API_REFERENCE.md`](docs/API_REFERENCE.md), every API route and its actual permission gating, including known gaps.
- [`docs/SAM2_INTEGRATION.md`](docs/SAM2_INTEGRATION.md), the SAM 2.0 integration contract, sharable with the SAM 2.0 side.
- `Columbia_Wireless_User_Guide.docx`, client-facing feature walkthrough.

`DEMO_OVERVIEW.md`, `DEMO_STATUS.md`, and `DEMO_VERIFICATION_GUIDE.md` in the project root predate the Columbia Wireless rebrand and SAM 2.0 integration and are out of date, prefer the `docs/` folder above.

---

This is a [Next.js](https://nextjs.org) project bootstrapped with [`create-next-app`](https://nextjs.org/docs/app/api-reference/cli/create-next-app).

## Getting Started

First, run the development server:

```bash
npm run dev
# or
yarn dev
# or
pnpm dev
# or
bun dev
```

Open [http://localhost:3000](http://localhost:3000) with your browser to see the result.

You can start editing the page by modifying `app/page.tsx`. The page auto-updates as you edit the file.

This project uses [`next/font`](https://nextjs.org/docs/app/building-your-application/optimizing/fonts) to automatically optimize and load [Geist](https://vercel.com/font), a new font family for Vercel.

## Learn More

To learn more about Next.js, take a look at the following resources:

- [Next.js Documentation](https://nextjs.org/docs) - learn about Next.js features and API.
- [Learn Next.js](https://nextjs.org/learn) - an interactive Next.js tutorial.

You can check out [the Next.js GitHub repository](https://github.com/vercel/next.js) - your feedback and contributions are welcome!

## Deploy on Vercel

The easiest way to deploy your Next.js app is to use the [Vercel Platform](https://vercel.com/new?utm_medium=default-template&filter=next.js&utm_source=create-next-app&utm_campaign=create-next-app-readme) from the creators of Next.js.

Check out our [Next.js deployment documentation](https://nextjs.org/docs/app/building-your-application/deploying) for more details.
