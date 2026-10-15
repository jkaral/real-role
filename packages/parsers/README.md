# Page parsers

`parsePosting(document, url?)` reads only the supplied DOM, with no network or Node APIs. It tries Greenhouse, Lever and Ashby hosted-page parsers before the generic fallback. JSON-LD takes priority everywhere.

The generic parser accepts a single schema.org JobPosting in an object, array or `@graph`, validates the extracted fields through the frozen shared schema, and strips HTML using an inert template. Multiple valid postings return null, as a listing page is not a single job. Malformed metadata blocks do not prevent another block from being parsed. Optional invalid dates are omitted; date-only values use UTC, and timestamps require an explicit offset.

Fallbacks use scoped board selectors or explicit JobPosting microdata. They require a title and employer, and do not invent those from URLs. Hosted DOM markup can change; JSON-LD is preferred and unsupported shapes return null. Board-specific JSON-LD retains salary and other structured fields; plain DOM fallbacks extract title, company, location, description, visible ISO date, URL identifier and explicitly denominated salary ranges. Bare dollar signs are not assigned an assumed currency.

Tests use saved, fictional HTML under jsdom. Run `pnpm --filter @real-role/parsers test`.
