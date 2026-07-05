"""One-off builder: renders arsenal.html's static reference sections from
data/processed/arsenal.json. Rerun after editing arsenal.json:
  python3 build_page.py /path/to/repo
"""
import json
import sys
from html import escape
from pathlib import Path

ROOT = Path(sys.argv[1] if len(sys.argv) > 1 else '.')
d = json.load(open(ROOT / 'data/processed/arsenal.json', encoding='utf-8'))
ACTORS = d['meta']['actors']
ORDER = ['hamas', 'hezbollah', 'houthis', 'iran']


def fmt_range(r):
    if not r:
        return '—'
    lo, hi = r
    return f'{lo:,}–{hi:,} km' if lo != hi else f'~{hi:,} km'


def fmt_kg(w):
    if w is None:
        return 'undisclosed'
    if isinstance(w, list):
        lo, hi = w
        return f'{lo:,}–{hi:,} kg' if lo != hi else f'~{hi:,} kg'
    return f'~{w:,} kg'


def fmt_usd(c):
    def one(x):
        if x >= 1_000_000:
            v = x / 1_000_000
            return f'${v:g}M'
        if x >= 1_000:
            return f'${x/1000:g}k'
        return f'${x:g}'
    if c is None:
        return None
    if isinstance(c, list):
        return f'{one(c[0])}–{one(c[1])}'
    return one(c)


def srcs(urls):
    links = ' '.join(f'<a href="{escape(u)}" target="_blank" rel="noopener">[{i+1}]</a>'
                     for i, u in enumerate(urls))
    return f'<span class="src-links">Sources: {links}</span>'


parts = []
for actor in ORDER:
    meta = ACTORS[actor]
    systems = [s for s in d['systems'] if s['actor'] == actor]
    parts.append(f'''
    <div class="actor-section" id="{actor}" style="--actor-color:{meta['color']};">
      <div class="section-label" style="margin-bottom:.5rem;color:{meta['color']};">{escape(meta['label'])}</div>
      <h2 class="section-title" style="font-size:1.8rem;margin-bottom:1rem;">{len(systems)} systems</h2>
      <div class="sys-grid">''')
    for s in systems:
        aka = ' · '.join(s['aka'][:2])
        cost = fmt_usd(s['est_unit_cost_usd'])
        rows = [
            ('Class', escape(s['class'])),
            ('Range', fmt_range(s.get('range_km'))),
            ('Warhead', fmt_kg(s.get('warhead_kg'))),
            ('Guidance', escape(s['guidance'])),
        ]
        if cost:
            rows.append(('Est. cost / round', cost))
        rows.append(('First used vs Israel', escape(s['first_used_vs_israel'])))
        rows_html = ''.join(
            f'<div class="sys-row"><span>{k}</span><span>{v}</span></div>' for k, v in rows)
        sim_btn = ('' if s['class'] == 'ATGM' else
                   f'<button class="sim-link" type="button" data-sim="{s["id"]}">'
                   f'▶ Fire it in the simulator</button>')
        parts.append(f'''
        <article class="sys-card" id="sys-{s['id']}">
          <h3 class="sys-name">{escape(s['name'])}</h3>
          <div class="sys-aka">{escape(aka)}</div>
          <div class="sys-stats">{rows_html}</div>
          <p class="sys-notes"><strong>Warhead:</strong> {escape(s['warhead_notes'])}</p>
          <p class="sys-notes"><strong>In action:</strong> {escape(s['salvo_notes'])}</p>
          <p class="sys-notes">{escape(s['notes'])} {srcs(s['sources'])}</p>
          {sim_btn}
        </article>''')
    parts.append('</div></div>')
systems_html = ''.join(parts)

def_parts = []
for df in d['defenses']:
    cost = fmt_usd(df['est_interceptor_cost_usd'])
    if df['name'] == 'Iron Beam':
        cost = '~$2–5 / shot (electricity)'
    def_parts.append(f'''
      <article class="sys-card def-card">
        <div class="sys-aka">{escape(df['layer'])}</div>
        <h3 class="sys-name">{escape(df['name'])}</h3>
        <div class="sys-stats">
          <div class="sys-row"><span>Intercepts</span><span class="wrap">{escape(df['intercepts'])}</span></div>
          <div class="sys-row"><span>Cost / interceptor</span><span>{cost}</span></div>
        </div>
        <p class="sys-notes">{escape(df['record'])} {srcs(df['sources'])}</p>
      </article>''')
defenses_html = ''.join(def_parts)

est_parts = []
for e in d['actor_arsenal_estimates']:
    meta = ACTORS[e['actor']]
    est_parts.append(f'''
      <div class="est-block" style="border-left:2px solid {meta['color']};">
        <div class="est-actor" style="color:{meta['color']};">{escape(meta['label'])}</div>
        <p>{escape(e['estimate'])} {srcs(e['sources'])}</p>
      </div>''')
estimates_html = ''.join(est_parts)

ev_parts = []
for ev in d['notable_events']:
    y, m, day = ev['date'].split('-')
    months = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']
    label = f'{months[int(m)-1]} {int(day)}, {y}'
    ev_parts.append(f'''
      <li class="ev-item">
        <span class="ev-date">{label}</span>
        <span class="ev-text">{escape(ev['event'])} {srcs(ev['sources'])}</span>
      </li>''')
events_html = ''.join(ev_parts)

page = open(ROOT / 'scripts' / '_arsenal_template.html', encoding='utf-8').read()
page = page.replace('<!--SYSTEMS-->', systems_html)
page = page.replace('<!--DEFENSES-->', defenses_html)
page = page.replace('<!--ESTIMATES-->', estimates_html)
page = page.replace('<!--EVENTS-->', events_html)
open(ROOT / 'arsenal.html', 'w', encoding='utf-8').write(page)
print(f'arsenal.html written ({len(page):,} bytes)')
