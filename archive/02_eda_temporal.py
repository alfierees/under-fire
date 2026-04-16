"""
UNDER FIRE — Phase 2: Temporal EDA
====================================
Explores time-based patterns in the cleaned ACLED dataset.
Run after 01_acled_pull.py has produced data/clean_acled.csv

pip install pandas matplotlib seaborn scipy numpy
"""

import pandas as pd
import numpy as np
import matplotlib
matplotlib.use("Agg")   # headless — saves PNGs, no display needed
import matplotlib.pyplot as plt
import matplotlib.dates as mdates
import seaborn as sns
from scipy import stats
from scipy.ndimage import gaussian_filter1d
import warnings
warnings.filterwarnings("ignore")

import os
os.makedirs("data/plots", exist_ok=True)

# ─────────────────────────────────────────────
# CONFLICT EPISODE LABELS (for plot annotations)
# ─────────────────────────────────────────────
EPISODES = [
    {"name": "Cast Lead",        "start": "2008-12-27", "color": "#e74c3c"},
    {"name": "Pillar",           "start": "2012-11-14", "color": "#e74c3c"},
    {"name": "Protective Edge",  "start": "2014-07-08", "color": "#e74c3c"},
    {"name": "Guardian",         "start": "2021-05-10", "color": "#e74c3c"},
    {"name": "Oct 7 War",        "start": "2023-10-07", "color": "#c0392b"},
    {"name": "Iran Strike 1",    "start": "2024-04-13", "color": "#9b59b6"},
    {"name": "Iran Strike 2",    "start": "2024-10-01", "color": "#9b59b6"},
]

ACTOR_COLORS = {
    "Hamas":             "#c0392b",
    "PIJ":               "#e8b84b",
    "Hezbollah":         "#4a9eff",
    "Iran Direct":       "#9b59b6",
    "Other Palestinian": "#e67e22",
    "Houthis":           "#2ecc71",
    "Unknown":           "#6b6b80",
}

STYLE = {
    "bg":       "#0a0a0c",
    "surface":  "#111116",
    "border":   "#2a2a35",
    "text":     "#d8d8e0",
    "muted":    "#6b6b80",
    "accent":   "#e8b84b",
}

def apply_dark_style():
    plt.rcParams.update({
        "figure.facecolor":  STYLE["bg"],
        "axes.facecolor":    STYLE["surface"],
        "axes.edgecolor":    STYLE["border"],
        "axes.labelcolor":   STYLE["text"],
        "xtick.color":       STYLE["muted"],
        "ytick.color":       STYLE["muted"],
        "text.color":        STYLE["text"],
        "grid.color":        STYLE["border"],
        "grid.linewidth":    0.5,
        "font.family":       "monospace",
        "figure.dpi":        150,
    })

apply_dark_style()


# ─────────────────────────────────────────────
# LOAD DATA
# ─────────────────────────────────────────────
def load():
    path = "data/clean_acled.csv"
    if not os.path.exists(path):
        raise FileNotFoundError("Run 01_acled_pull.py first to generate data/clean_acled.csv")
    df = pd.read_csv(path, parse_dates=["event_date"])
    df["year"]  = df["event_date"].dt.year
    df["month"] = df["event_date"].dt.month
    df["month_name"] = df["event_date"].dt.strftime("%b")
    df["dow"]   = df["event_date"].dt.dayofweek          # 0=Mon
    df["dow_name"] = df["event_date"].dt.strftime("%a")
    df["week_date"] = df["event_date"].dt.to_period("W").apply(lambda r: r.start_time)
    df["month_date"] = df["event_date"].dt.to_period("M").apply(lambda r: r.start_time)
    df["fatalities"] = pd.to_numeric(df["fatalities"], errors="coerce").fillna(0)
    if "actor_group" not in df.columns:
        df["actor_group"] = "Unknown"
    return df


# ─────────────────────────────────────────────
# PLOT 1: Timeline Strip (events over time)
# ─────────────────────────────────────────────
def plot_timeline(df):
    fig, ax = plt.subplots(figsize=(16, 4))
    fig.patch.set_facecolor(STYLE["bg"])
    ax.set_facecolor(STYLE["surface"])

    for actor, grp in df.groupby("actor_group"):
        color = ACTOR_COLORS.get(actor, STYLE["muted"])
        ax.scatter(grp["event_date"], [1]*len(grp),
                   color=color, alpha=0.4, s=8, linewidths=0, label=actor)

    # Episode markers
    for ep in EPISODES:
        ax.axvline(pd.to_datetime(ep["start"]), color=ep["color"],
                   linewidth=0.8, alpha=0.7, linestyle="--")
        ax.text(pd.to_datetime(ep["start"]), 1.35, ep["name"],
                color=ep["color"], fontsize=5.5, rotation=45, ha="left", va="bottom")

    ax.set_xlim(df["event_date"].min(), df["event_date"].max())
    ax.set_ylim(0.5, 1.8)
    ax.set_yticks([])
    ax.xaxis.set_major_locator(mdates.YearLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))
    ax.set_title("ALL RECORDED ROCKET / MISSILE EVENTS — 2008 to PRESENT",
                 fontsize=9, color=STYLE["text"], pad=12, loc="left")
    ax.legend(loc="lower right", fontsize=6, framealpha=0.2,
              labelcolor=STYLE["text"], facecolor=STYLE["surface"],
              ncol=len(ACTOR_COLORS))
    ax.grid(axis="x", alpha=0.3)

    plt.tight_layout()
    plt.savefig("data/plots/01_timeline_strip.png", bbox_inches="tight",
                facecolor=STYLE["bg"])
    plt.close()
    print("✓ Saved: data/plots/01_timeline_strip.png")


# ─────────────────────────────────────────────
# PLOT 2: Monthly Rolling Average (escalation curve)
# ─────────────────────────────────────────────
def plot_escalation_curve(df):
    monthly = df.groupby("month_date").size().reset_index(name="count")
    monthly = monthly.sort_values("month_date")

    # Fill missing months with 0
    full_range = pd.date_range(monthly["month_date"].min(),
                               monthly["month_date"].max(), freq="MS")
    monthly = monthly.set_index("month_date").reindex(full_range, fill_value=0)
    monthly.index.name = "month_date"
    monthly = monthly.reset_index()

    # Smooth
    monthly["smooth"] = gaussian_filter1d(monthly["count"].values.astype(float), sigma=1.5)

    fig, ax = plt.subplots(figsize=(16, 5))
    fig.patch.set_facecolor(STYLE["bg"])
    ax.set_facecolor(STYLE["surface"])

    ax.fill_between(monthly["month_date"], monthly["smooth"],
                    alpha=0.15, color=STYLE["accent2"] if "accent2" in STYLE else "#c0392b")
    ax.plot(monthly["month_date"], monthly["smooth"],
            color="#c0392b", linewidth=1.5, alpha=0.9)

    # Episode annotations
    for ep in EPISODES:
        dt = pd.to_datetime(ep["start"])
        ax.axvline(dt, color=ep["color"], linewidth=0.8, linestyle="--", alpha=0.7)
        y_max = monthly["smooth"].max()
        ax.text(dt, y_max * 1.02, ep["name"],
                color=ep["color"], fontsize=5.5, rotation=40, ha="left", va="bottom")

    ax.set_title("ATTACK FREQUENCY OVER TIME (monthly, smoothed)",
                 fontsize=9, color=STYLE["text"], pad=12, loc="left")
    ax.set_ylabel("Events / Month", fontsize=7)
    ax.grid(alpha=0.3)
    ax.xaxis.set_major_locator(mdates.YearLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))

    plt.tight_layout()
    plt.savefig("data/plots/02_escalation_curve.png", bbox_inches="tight",
                facecolor=STYLE["bg"])
    plt.close()
    print("✓ Saved: data/plots/02_escalation_curve.png")


# ─────────────────────────────────────────────
# PLOT 3: Day-of-Week Pattern
# ─────────────────────────────────────────────
def plot_day_of_week(df):
    fig, axes = plt.subplots(1, 2, figsize=(14, 5))
    fig.patch.set_facecolor(STYLE["bg"])

    day_labels = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"]

    # Overall
    ax = axes[0]
    ax.set_facecolor(STYLE["surface"])
    dow_counts = df.groupby("dow").size().reindex(range(7), fill_value=0)
    bars = ax.bar(day_labels, dow_counts.values, color=STYLE["accent"],
                  alpha=0.8, width=0.6)
    # Highlight Friday
    bars[4].set_color("#c0392b")
    bars[4].set_alpha(1.0)
    ax.set_title("EVENTS BY DAY OF WEEK (all years)",
                 fontsize=8, color=STYLE["text"], loc="left")
    ax.set_ylabel("Event count", fontsize=7)
    ax.grid(axis="y", alpha=0.3)
    ax.tick_params(axis="both", labelsize=7)

    # By actor
    ax2 = axes[1]
    ax2.set_facecolor(STYLE["surface"])
    for actor, grp in df.groupby("actor_group"):
        counts = grp.groupby("dow").size().reindex(range(7), fill_value=0)
        # normalise
        if counts.sum() > 0:
            norm = counts / counts.sum()
            ax2.plot(day_labels, norm.values,
                     label=actor, color=ACTOR_COLORS.get(actor, STYLE["muted"]),
                     linewidth=1.5, marker="o", markersize=4, alpha=0.8)

    ax2.set_title("DAY OF WEEK PATTERN BY ACTOR (normalised)",
                  fontsize=8, color=STYLE["text"], loc="left")
    ax2.set_ylabel("Proportion of events", fontsize=7)
    ax2.legend(fontsize=6, framealpha=0.2, labelcolor=STYLE["text"],
               facecolor=STYLE["surface"])
    ax2.grid(alpha=0.3)
    ax2.tick_params(axis="both", labelsize=7)

    plt.tight_layout()
    plt.savefig("data/plots/03_day_of_week.png", bbox_inches="tight",
                facecolor=STYLE["bg"])
    plt.close()
    print("✓ Saved: data/plots/03_day_of_week.png")


# ─────────────────────────────────────────────
# PLOT 4: Seasonality (month of year heatmap)
# ─────────────────────────────────────────────
def plot_seasonality(df):
    fig, ax = plt.subplots(figsize=(14, 5))
    fig.patch.set_facecolor(STYLE["bg"])
    ax.set_facecolor(STYLE["surface"])

    pivot = df.groupby(["year", "month"]).size().unstack(fill_value=0)
    pivot = pivot.reindex(columns=range(1, 13), fill_value=0)

    month_labels = ["Jan","Feb","Mar","Apr","May","Jun",
                    "Jul","Aug","Sep","Oct","Nov","Dec"]

    im = ax.imshow(pivot.values, aspect="auto", cmap="YlOrRd",
                   interpolation="nearest")

    ax.set_xticks(range(12))
    ax.set_xticklabels(month_labels, fontsize=7)
    ax.set_yticks(range(len(pivot.index)))
    ax.set_yticklabels(pivot.index.astype(int), fontsize=7)
    ax.set_title("ATTACK SEASONALITY HEATMAP — events per year/month",
                 fontsize=8, color=STYLE["text"], loc="left")

    plt.colorbar(im, ax=ax, label="Event count", fraction=0.02)
    plt.tight_layout()
    plt.savefig("data/plots/04_seasonality_heatmap.png", bbox_inches="tight",
                facecolor=STYLE["bg"])
    plt.close()
    print("✓ Saved: data/plots/04_seasonality_heatmap.png")


# ─────────────────────────────────────────────
# PLOT 5: Actor Volume Over Time
# ─────────────────────────────────────────────
def plot_actor_timeline(df):
    fig, ax = plt.subplots(figsize=(16, 5))
    fig.patch.set_facecolor(STYLE["bg"])
    ax.set_facecolor(STYLE["surface"])

    for actor in df["actor_group"].unique():
        grp = df[df["actor_group"] == actor]
        monthly = grp.groupby("month_date").size().reset_index(name="count")
        full_range = pd.date_range(df["month_date"].min(),
                                   df["month_date"].max(), freq="MS")
        monthly = (monthly.set_index("month_date")
                          .reindex(full_range, fill_value=0)
                          .reset_index())
        monthly.columns = ["month_date", "count"]
        smooth = gaussian_filter1d(monthly["count"].values.astype(float), sigma=2)
        color = ACTOR_COLORS.get(actor, STYLE["muted"])
        ax.plot(monthly["month_date"], smooth,
                label=actor, color=color, linewidth=1.2, alpha=0.85)

    for ep in EPISODES:
        ax.axvline(pd.to_datetime(ep["start"]), color="#2a2a35",
                   linewidth=0.6, linestyle="--")

    ax.set_title("ATTACK FREQUENCY BY ACTOR (monthly, smoothed)",
                 fontsize=9, color=STYLE["text"], loc="left")
    ax.set_ylabel("Events / Month", fontsize=7)
    ax.legend(fontsize=7, framealpha=0.2, labelcolor=STYLE["text"],
              facecolor=STYLE["surface"])
    ax.grid(alpha=0.3)
    ax.xaxis.set_major_locator(mdates.YearLocator())
    ax.xaxis.set_major_formatter(mdates.DateFormatter("%Y"))

    plt.tight_layout()
    plt.savefig("data/plots/05_actor_timeline.png", bbox_inches="tight",
                facecolor=STYLE["bg"])
    plt.close()
    print("✓ Saved: data/plots/05_actor_timeline.png")


# ─────────────────────────────────────────────
# STATISTICAL TESTS
# ─────────────────────────────────────────────
def statistical_tests(df):
    print("\n" + "═"*60)
    print("STATISTICAL TESTS")
    print("═"*60)

    # Test 1: Is day-of-week distribution uniform? (chi-squared)
    observed = df.groupby("dow").size().reindex(range(7), fill_value=0).values
    expected = [len(df) / 7] * 7
    chi2, p = stats.chisquare(observed, expected)
    print(f"\n1. Day-of-week uniformity test (chi-squared):")
    print(f"   χ² = {chi2:.2f}, p = {p:.4f}")
    if p < 0.05:
        print(f"   → SIGNIFICANT: attacks are NOT evenly distributed across days")
        peak_day = ["Mon","Tue","Wed","Thu","Fri","Sat","Sun"][observed.argmax()]
        print(f"   → Peak day: {peak_day} ({observed.max()} events)")
    else:
        print(f"   → Not significant: no strong day-of-week pattern")

    # Test 2: Month-of-year (seasonality)
    obs_month = df.groupby("month").size().reindex(range(1, 13), fill_value=0).values
    exp_month = [len(df) / 12] * 12
    chi2_m, p_m = stats.chisquare(obs_month, exp_month)
    month_names = ["Jan","Feb","Mar","Apr","May","Jun",
                   "Jul","Aug","Sep","Oct","Nov","Dec"]
    print(f"\n2. Month-of-year seasonality test (chi-squared):")
    print(f"   χ² = {chi2_m:.2f}, p = {p_m:.4f}")
    if p_m < 0.05:
        peak_month = month_names[obs_month.argmax()]
        print(f"   → SIGNIFICANT: seasonal pattern exists")
        print(f"   → Peak month: {peak_month} ({obs_month.max()} events)")
    else:
        print(f"   → Not significant at p<0.05")

    # Test 3: Is attack rate different during Ramadan?
    # Approximate Ramadan dates (start of month)
    ramadan_months = {
        2008: (9, 2008), 2009: (8, 2009), 2010: (8, 2010),
        2011: (8, 2011), 2012: (7, 2012), 2013: (7, 2013),
        2014: (6, 2014), 2015: (6, 2015), 2016: (6, 2016),
        2017: (5, 2017), 2018: (5, 2018), 2019: (5, 2019),
        2020: (4, 2020), 2021: (4, 2021), 2022: (4, 2022),
        2023: (3, 2023), 2024: (3, 2024),
    }
    df["is_ramadan"] = df.apply(
        lambda r: r["month"] == ramadan_months.get(r["year"], (0,0))[0], axis=1
    )
    ramadan_rate = df[df["is_ramadan"]]["event_date"].dt.to_period("M").value_counts().mean()
    non_ramadan_rate = df[~df["is_ramadan"]]["event_date"].dt.to_period("M").value_counts().mean()
    print(f"\n3. Ramadan vs. non-Ramadan attack rate:")
    print(f"   During Ramadan:  {ramadan_rate:.1f} events/month (avg)")
    print(f"   Outside Ramadan: {non_ramadan_rate:.1f} events/month (avg)")
    ratio = ramadan_rate / non_ramadan_rate if non_ramadan_rate > 0 else float("nan")
    print(f"   Ratio: {ratio:.2f}x")

    print("\n" + "═"*60)


# ─────────────────────────────────────────────
# NOTE ON TIME-OF-DAY
# ─────────────────────────────────────────────
def note_on_time_of_day():
    print("""
╔══════════════════════════════════════════════════════════════╗
║  NOTE: TIME OF DAY                                           ║
╠══════════════════════════════════════════════════════════════╣
║  ACLED does not record time-of-day in its main dataset.      ║
║  To get hourly patterns, next steps are:                     ║
║                                                              ║
║  Option A — GDELT news media timestamps                      ║
║    GDELT records news articles about events with timestamps. ║
║    Cross-reference event dates with GDELT news stories       ║
║    mentioning "rockets" or "missiles" in Israel.             ║
║    BigQuery: SELECT * FROM gdelt-bq.full.events              ║
║              WHERE Actor1CountryCode = 'ISR' OR 'PSE'        ║
║              AND SQLDATE >= '20080101'                        ║
║                                                              ║
║  Option B — IDF alert data (Tzeva Adom / Red Alert)         ║
║    The Red Alert (Tzeva Adom) siren system API provides      ║
║    exact timestamps for each alert. Unofficial archives      ║
║    exist: oref.org.il / tzevaadom.co.il                      ║
║    This is the BEST source for time-of-day analysis.         ║
║                                                              ║
║  Option C — News scraping                                    ║
║    Scrape timestamps from news wire reports (AP, Reuters)    ║
║    about specific attack events. Most granular but slowest.  ║
╚══════════════════════════════════════════════════════════════╝
""")


# ─────────────────────────────────────────────
# RUN ALL
# ─────────────────────────────────────────────
if __name__ == "__main__":
    print("UNDER FIRE — Temporal EDA")
    print("─" * 40)

    try:
        df = load()
        print(f"✓ Loaded {len(df):,} events\n")

        print("Running plots...")
        plot_timeline(df)
        plot_escalation_curve(df)
        plot_day_of_week(df)
        plot_seasonality(df)
        plot_actor_timeline(df)

        statistical_tests(df)
        note_on_time_of_day()

        print("\n✓ EDA complete — check data/plots/")
        print("Next: run 03_eda_spatial.py")

    except FileNotFoundError as e:
        print(f"\n⚠  {e}")
