# MFFL site (memffl.com)

The Memphis Fantasy Football League site. Scores, standings and team names come
from MyFantasyLeague (league 30555, every season back to 2004). Everything else
lives in plain files in `content/`, editable on the site at `/admin`.

## How it works

| Piece | Where |
|---|---|
| MFL scores, team names, logos (downloaded) | `data/mfl/`, `public/mfl-logos/` |
| League name, founding year, about text | `content/site.yaml` |
| Team colors, logos, jersey numbers, notes | `content/teams.yaml` |
| Owners and which team slots they ran | `content/owners.yaml` |
| Champion / runner-up / 3rd / Toilet Bowl per season | `content/seasons.yaml` |
| Weekly recaps | `content/recaps/<season>-week-<week>.md` |

A GitHub Action (`.github/workflows/deploy.yml`) pulls new scores every Tuesday
and Friday morning, saves them, rebuilds the site and publishes it. Any save
from `/admin` also triggers a rebuild.

## Run it on your computer

```bash
npm install
npm run sync     # pull scores from MFL (slow on purpose; MFL rate-limits)
npm run dev      # site at http://localhost:4321
```

To use the admin editor locally without signing in, run `npm run cms` in a
second terminal and open http://localhost:4321/admin/.

## Going live

1. **Create the GitHub repo** and push this folder to its `main` branch.
2. **Turn on Pages:** repo Settings → Pages → Source: *GitHub Actions*.
3. **Point the domain:** at your domain registrar, add DNS records for
   `memffl.com`: four `A` records to `185.199.108.153`, `185.199.109.153`,
   `185.199.110.153`, `185.199.111.153`, and a `CNAME` for `www` to
   `<your-github-username>.github.io`. Then in Settings → Pages, set the custom
   domain to `memffl.com` and tick *Enforce HTTPS* once it's available.
4. **Admin sign-in:** Decap needs a small sign-in helper to log in with GitHub
   when the site is on GitHub Pages.
   - Create a GitHub OAuth App (GitHub → Settings → Developer settings → OAuth Apps).
   - Deploy a free sign-in helper, for example the `sveltia-cms-auth` Cloudflare
     Worker, with that app's client ID and secret.
   - In `public/admin/config.yml`, set `repo` to `your-username/memffl` and
     `base_url` to the helper's URL.

## Common edits

- **Team colors or logo:** `/admin` → League Settings → Team colors. Upload a
  logo to replace the MFL one, or leave it empty to keep MFL's.
- **New owner or a team changed hands:** League Settings → Owners. Team slots
  are MFL's franchise numbers (0001–0013) and stay the same when a team renames.
- **Season finishes:** League Settings → Season finishes. MFL doesn't share
  playoff brackets publicly, so these drive the trophy cases and the
  Championship / Toilet Bowl labels.
