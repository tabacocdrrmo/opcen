# opcen

Personnel portal for the Tabaco City Disaster Risk Reduction and Management Office (CDRRMO).

`index.html` is the sign-in page for the operations center. A successful sign-in sends administrators to `admin.html` and all other personnel to `crew-portal.html`. The public information site lives in a separate repository (`cdrrmo-website`).

Plain static HTML, CSS, and JavaScript — no build step. Supabase provides authentication and the account records; the browser only ever sees the signed-in user's own row.

## Files

- `index.html` — sign-in
- `css/login.css`, `js/login.js` — styles and behaviour for the sign-in page
- `js/supabase-client.js` — Supabase client and shared helpers
- `admin.html`, `crew-portal.html` — post-sign-in destinations
- `supabase/functions/` — edge functions used by the portal
