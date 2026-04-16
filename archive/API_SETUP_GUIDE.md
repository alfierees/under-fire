# Under Fire — API Setup Guide

## 1. ACLED API (Primary conflict data)

**What it gives you:** Date, location, actor, event type for every recorded
rocket/shelling attack. No time-of-day — but essential for everything else.

### Steps
1. Go to **https://developer.acleddata.com/**
2. Click **"Register for Access"**
3. Fill in: name, email, affiliation (use "Independent Researcher" — totally fine)
4. You'll receive an email with your **API Key** within a few minutes
5. Save two things: your **API Key** and the **email you registered with**

### Set credentials (Mac/Linux)
```bash
export ACLED_KEY="your_key_here"
export ACLED_EMAIL="your@email.com"
```
Add those lines to `~/.zshrc` or `~/.bashrc` so they persist.

### Test it works
```bash
curl "https://api.acleddata.com/acled/read?key=$ACLED_KEY&email=$ACLED_EMAIL&country=Israel&limit=5" | python3 -m json.tool
```
You should see 5 conflict events returned as JSON.

---

## 2. Red Alert / Tzeva Adom Data (Time-of-day — the key feature)

This is what gives you **exact timestamps** (to the second) for every
incoming rocket alert. Three options, best to worst:

---

### Option A — OREF Historical Archive ✅ BEST
**No API key needed.** The Israeli Home Front Command publishes alert history.

```
https://www.oref.org.il/WarningMessages/History/AlertsHistory.json
```

This endpoint returns recent alerts. For historical data, use:

```
https://www.oref.org.il/Shared/Ajax/GetAlertsHistory.aspx?lang=he&fromDate=01.01.2023&toDate=31.12.2023
```

**Limitations:** Coverage varies. Best from ~2021 onwards.

```python
import requests, pandas as pd

url = "https://www.oref.org.il/Shared/Ajax/GetAlertsHistory.aspx"
params = {"lang": "he", "fromDate": "01.01.2023", "toDate": "31.12.2023"}
headers = {"Referer": "https://www.oref.org.il/"}
r = requests.get(url, params=params, headers=headers)
data = r.json()
df = pd.DataFrame(data)
print(df.head())
```

---

### Option B — Community Archive on GitHub ✅ GREAT for history
Several researchers have scraped and archived full Tzeva Adom history
back to 2011 in CSV format.

Search GitHub for: **`tzeva adom alerts csv`** or **`red alert israel historical`**

Key repos to look for:
- Repos with `alertsHistory` CSV files
- Files named `tzeva_adom_*.csv` with columns: `date`, `time`, `area`, `city`

This is the **best source for pre-2021 time-of-day data.**

---

### Option C — tzevaadom.co.il Community API
```
https://api.tzevaadom.co.il/alerts-history
```

Unofficial but well-maintained. Returns alerts with timestamps.
No key needed. Rate-limit politely (1 req/sec).

---

## Recommended Approach

| Time Period | Best Source |
|-------------|-------------|
| 2011–2020   | GitHub CSV archive |
| 2021–2023   | OREF historical API |
| 2023–present| OREF real-time + ACLED |

## Next Steps Once You Have Keys

1. Run `01_acled_pull.py` — set `ACLED_KEY` and `ACLED_EMAIL` first
2. Run the Red Alert scraper (see `03_red_alert_pull.py`)
3. The website (`index.html`) will automatically use real data
   once `data/clean_acled.json` and `data/alerts.json` are present
