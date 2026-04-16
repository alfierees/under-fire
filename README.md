# Under Fire

**Patterns in rocket and missile attacks on Israel — a live data journalism project.**

---

## How to get it live in 4 steps

### Step 1 — Create a GitHub repo

```bash
git init
git add .
git commit -m "initial commit"
gh repo create under-fire --public
git push -u origin main
```

### Step 2 — Enable GitHub Pages

In your repo → **Settings** → **Pages** → Source: **Deploy from branch** → `main` / `/ (root)`

Your site will be live at `https://YOUR-USERNAME.github.io/under-fire`

### Step 3 — Enable GitHub Actions

The workflow file `.github/workflows/update-data.yml` is already in the repo.
GitHub Actions runs it automatically. Just make sure Actions are enabled:
**Settings** → **Actions** → **Allow all actions** ✓

### Step 4 — Backfill historical data (one-time)

Trigger this manually from the Actions tab to pull years of history:

1. Go to **Actions** → **Update Alert Data**
2. Click **Run workflow**
3. Set `backfill_days` to `3650` (10 years)
4. Run it — it'll populate `data/alerts.json` with historical alerts

After this, the Action runs every 10 minutes automatically and adds new alerts as they happen.

---

## Architecture

```
OREF API (oref.org.il)
    │  polls every 10 minutes
    ▼
GitHub Actions workflow
    │  appends new alerts
    ▼
data/alerts.json  (in this repo, auto-committed)
    │  GitHub Pages serves it as a static file
    ▼
index.html  (fetches data/alerts.json on load, refreshes every 5 min)
```

**No server. No database. Completely free.**

---

## To also add ACLED data (richer actor attribution)

Once you have an ACLED API key:

```bash
export ACLED_KEY="your_key"
export ACLED_EMAIL="your@email.com"
python scripts/01_acled_pull.py
```

This produces `data/clean_acled.csv`. A merge script (coming soon) will
blend ACLED actor/episode data with the OREF timestamp data.

---

## File structure

```
index.html                   ← Main website (open this in browser)
data/
  alerts.json                ← Auto-updated alert data (OREF)
  clean_acled.csv            ← Conflict event data (ACLED, after setup)
  plots/                     ← EDA charts from Python pipeline
scripts/
  oref_scraper.py            ← OREF live + history fetcher
  backfill.py                ← Historical backfill tool
  01_acled_pull.py           ← ACLED data pull
  02_eda_temporal.py         ← Temporal analysis & charts
.github/workflows/
  update-data.yml            ← GitHub Actions: runs scraper every 10 min
```
