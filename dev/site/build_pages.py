"""Build every Aether app's GitHub Pages site and README product section.

    python3 dev/site/build_pages.py            # READMEs + assets/branding in each repo, sites in ../aether-pages
    python3 dev/site/build_pages.py --check    # exit 1 if any output is stale
    python3 dev/site/build_pages.py --publish  # commit each site to its gh-pages branch and push (explicit)

Sites deploy from each repo's gh-pages branch (root); ../aether-pages/<repo>/ is the
local copy of exactly what that branch should contain. Logos come from
AetherStudio/core/assets/branding and live in each repo under assets/branding/.

Design: the Jaeger page design (jaeger.css, cloned from the JROS site) with
Aether content from apps.py. README: everything above the first `---` line is
regenerated; everything below it is kept verbatim under "Developer notes".
"""
import html
import shutil
import subprocess
import sys
import tempfile
from pathlib import Path

sys.path.insert(0, str(Path(__file__).parent))
from apps import APPS, ORG, RELEASE, SUITE, TAG  # noqa: E402

HERE = Path(__file__).parent
GITHUB = HERE.parents[2]  # .../GITHUB (sibling repositories)
CSS = (HERE / "jaeger.css").read_text()
BRANDING = HERE.parents[1] / "core/assets/branding"
PAGES = GITHUB / "aether-pages"
JR_LOGO = "https://jenkinsrobotics.com/wp-content/uploads/2021/04/cropped-cropped-Jenkins-logo-transparent-1.png"
e = html.escape

EXTRA_CSS = """
  /* ── Aether additions: alpha notice, status columns, run-it-your-way, family ── */
  section > .wrap, .hero > .wrap { width: 100%; }
  .badge .dot.alpha { background: var(--warn); box-shadow: 0 0 8px var(--warn); }
  .alpha-note { max-width: 760px; margin: 28px auto 0; padding: 12px 16px; border: 1px solid rgba(210,153,34,.35); background: rgba(210,153,34,.07); border-radius: var(--radius); color: var(--fg); font-size: 14px; text-align: left; }
  .alpha-note strong { color: var(--warn); font-family: var(--mono); font-size: 12px; letter-spacing: .08em; text-transform: uppercase; margin-right: 8px; }
  .feature .pill.ok { color: var(--green); background: rgba(63,185,80,.08); border-color: rgba(63,185,80,.3); }
  .feature .pill.prog { color: var(--accent2); }
  .feature .note { display: block; margin-top: 8px; font-size: 12px; color: var(--muted); font-family: var(--mono); }
  #features .feature, #suite .feature, #family .feature { opacity: 1; transform: none; }
  .status-key { display: flex; gap: 18px; justify-content: center; flex-wrap: wrap; margin-top: 18px; font-family: var(--mono); font-size: 12px; color: var(--muted); }
  .status-key span::before { content: ""; display: inline-block; width: 8px; height: 8px; border-radius: 50%; margin-right: 6px; vertical-align: middle; }
  .status-key .k-ok::before { background: var(--green); } .status-key .k-prog::before { background: var(--accent); } .status-key .k-plan::before { border: 1px dashed var(--warn); }
  .ai-list { margin: 22px 0 0; padding: 0; list-style: none; display: grid; gap: 12px; max-width: 760px; }
  .ai-list li { padding: 14px 16px 14px 44px; position: relative; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); color: var(--fg); font-size: 14.5px; }
  .ai-list li::before { content: "→"; position: absolute; left: 16px; color: var(--accent); font-family: var(--mono); }
  .arch-box ul { margin: 12px 0 0; padding-left: 18px; color: var(--muted); font-size: 14px; line-height: 1.7; }
  .arch-box.primary { border-color: var(--accent3); box-shadow: 0 0 0 1px rgba(31,111,235,.25), 0 18px 50px rgba(0,0,0,.35); }
  .family { display: grid; grid-template-columns: repeat(auto-fill, minmax(230px, 1fr)); gap: 14px; margin-top: 36px; }
  .family a { display: flex; gap: 12px; align-items: flex-start; padding: 14px; background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); color: var(--fg); transition: border-color .15s ease, transform .15s ease; }
  .family a:hover { border-color: var(--accent); transform: translateY(-2px); color: var(--fg); }
  .family a.here { border-color: var(--accent3); }
  .family img { width: 40px; height: 40px; border-radius: 9px; flex: none; }
  .family b { display: block; color: var(--heading); font-size: 14.5px; }
  .family small { color: var(--muted); font-size: 12.5px; line-height: 1.45; }
  .faq { margin-top: 32px; display: grid; gap: 10px; max-width: 820px; }
  .faq details { background: var(--panel); border: 1px solid var(--border); border-radius: var(--radius); padding: 14px 18px; }
  .faq summary { cursor: pointer; color: var(--heading); font-weight: 600; }
  .faq p { margin: 10px 0 0; color: var(--muted); font-size: 14px; }
  .hero-mark.app { border-radius: 22px; }
  .hero-wordmark { margin: 8px 0 6px; } .hero-wordmark img { height: clamp(52px, 9vw, 88px); max-width: 100%; filter: drop-shadow(0 6px 26px var(--glow)); }
  .brand img { filter: drop-shadow(0 0 8px var(--glow)); }
"""

STATUS = {"works": ("ok", "works today"), "progress": ("prog", "in progress"), "planned": ("dev", "planned")}


def icon(aid: str) -> str:
    return f"assets/branding/aether-{aid}-icon.png"


def suite_icon(aid: str) -> str:
    return f"assets/branding/suite/aether-{aid}-icon.png"


def wordmark(aid: str, surface: str = "dark") -> str:
    return f"assets/branding/aether-{aid}-wordmark-{surface}.png"


def pages_url(repo: str) -> str:
    return f"https://{ORG.lower()}.github.io/{repo}/"


def gh(repo: str, path: str = "") -> str:
    return f"https://github.com/{ORG}/{repo}{path}"


def cards(items, status, note_for=None):
    cls, label = STATUS[status]
    out = []
    for item in items:
        title, desc = item[0], item[1]
        note = item[3] if len(item) > 3 and item[3] else None
        out.append(
            f'      <div class="feature{" dev" if status == "planned" else ""}">\n'
            f"        <h3>{e(title)}</h3>\n        <p>{e(desc)}</p>\n"
            f'        <span class="pill {cls}">{label}</span>'
            + (f'<span class="note">{e(note)}</span>' if note else "")
            + "\n      </div>"
        )
    return "\n".join(out)


def page(app: dict) -> str:
    name, repo, aid = app["name"], app["repo"], app["id"]
    is_studio = aid == "studio"
    plain, accent = app["h1"]
    desc = f'{app["line"]} {app["alt"]}'
    feature_groups = [("works", app["works"], "Works today"), ("progress", app["progress"], "In progress"), ("planned", app["planned"], "Planned")]
    groups_html = ""
    for status, items, heading in feature_groups:
        if not items:
            continue
        divider = f'    <div class="ondeck-divider"><span>// {heading.lower()}</span></div>\n'
        groups_html += divider + f'    <div class="feature-grid" style="margin-top:0">\n{cards(items, status)}\n    </div>\n'
    ai_cls, ai_label = STATUS[app["ai_status"]]
    ai_items = "\n".join(f"      <li>{e(x)}</li>" for x in app["ai"])
    example_is_cmd = app["ai_example"].startswith("aether-agent")
    example = (f'<div class="term" style="margin:28px 0 0"><div class="term-bar"><div class="lights"><span></span><span></span><span></span></div><span class="ttl">agent — bash</span><span style="width:48px"></span></div><pre><span class="pmt">$</span> {e(app["ai_example"])}</pre></div>'
               if example_is_cmd else
               f'<div class="term" style="margin:28px 0 0"><div class="term-bar"><div class="lights"><span></span><span></span><span></span></div><span class="ttl">AI advisor — {e(name)}</span><span style="width:48px"></span></div><pre><span class="cm"># you</span>\n{e(app["ai_example"])}\n<span class="ok">✓ applied through the app’s own tools · undo available</span></pre></div>')
    suite_cards = cards([(t, d, None, n) for t, d, s, n in SUITE], "works")
    family = "\n".join(
        f'      <a href="{pages_url(a["repo"])}"{" class=\"here\"" if a is app else ""}><img src="{suite_icon(a["id"])}" alt=""><span><b>{e(a["name"])}</b><small>{e(a["line"])}</small></span></a>'
        for a in APPS)
    milestones = "\n".join(
        f'      <div class="milestone{" done" if i == 0 else " next" if i == 1 else ""}">\n        <h4>{e(v)}{" — released" if i == 0 else ""}</h4>\n        <h3>{e(t)}</h3>\n        <p>{e(d)}</p>\n      </div>'
        for i, (v, t, d) in enumerate(app["roadmap"]))
    what = "\n".join(f'    <p class="sub"{" style=\"margin-top:18px\"" if i else ""}>{e(p)}</p>' for i, p in enumerate(app["what"]))
    clone = f"""<span class="cm"># Check out the {RELEASE} release and fetch its verified packages.</span>
<span class="pmt">$</span> git clone --branch {TAG} --single-branch {gh(repo)}.git
<span class="pmt">$</span> cd {repo}
<span class="pmt">$</span> python3 tools/fetch-vendor.py<span class="blink">▎</span>"""
    studio_section = "" if is_studio else f"""
<!-- ─────────────────────── RUN IT YOUR WAY ─────────────────────── -->
<section id="studio">
  <div class="wrap">
    <div class="eyebrow">// run it your way</div>
    <h2 class="h">On its own, or with Aether Studio.</h2>
    <p class="sub">{e(name)} keeps its core features on a single machine. Connect it to <a href="{pages_url("AetherStudio")}">Aether Studio</a> — your own server — and it gains everything a team needs.</p>
    <div class="arch">
      <div class="arch-box">
        <h4>// standalone</h4>
        <h3>{e(name)} on one machine</h3>
        <p>Work locally and offline with the app’s core features. Your files stay on your disk in open formats.</p>
        <ul><li>Every core feature of the app</li><li>Local files you own</li><li>Today: a local install; a downloadable desktop app is planned</li></ul>
      </div>
      <div class="arch-box primary">
        <h4>// with aether studio</h4>
        <h3>{e(name)} on your server</h3>
        <p>{e(app["studio_extra"])}</p>
        <ul><li>Open it from any device with a browser</li><li>Built-in AI through one connection</li><li>PDM: versions, branches and releases</li><li>Multi-user: accounts, sharing, comments and tasks</li></ul>
      </div>
    </div>
  </div>
</section>
"""
    nav_studio = "" if is_studio else '      <a href="#studio">Aether Studio</a>\n'
    return f"""<!DOCTYPE html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="description" content="{e(name)} — {e(desc)} Part of the open-source Aether apps by Jenkins Robotics.">
<meta property="og:title" content="{e(name)} — {e(app["tagline"])}">
<meta property="og:description" content="{e(desc)}">
<meta property="og:type" content="website">
<meta property="og:image" content="{icon(aid)}">
<meta name="theme-color" content="#0d1117">
<title>{e(name)} — {e(app["line"].rstrip("."))}</title>
<link rel="icon" type="image/png" href="{icon(aid)}">
<!-- Generated by AetherStudio/dev/site/build_pages.py from apps.py — edit there, not here. -->
<style>
{CSS}{EXTRA_CSS}</style>
</head>
<body>

<!-- ─────────────────────── NAV ─────────────────────── -->
<nav>
  <div class="wrap">
    <a class="brand" href="#top">
      <img src="{wordmark(aid)}" alt="{e(name)}" height="28" style="display:block">
    </a>
    <div class="nav-links">
      <a href="#features">Features</a>
      <a href="#ai">AI</a>
{nav_studio}      <a href="#roadmap">Roadmap</a>
      <a class="btn" href="{gh(repo)}" target="_blank" rel="noopener">GitHub →</a>
    </div>
  </div>
</nav>

<!-- ─────────────────────── HERO ─────────────────────── -->
<header class="hero" id="top">
  <div class="hero-bg" aria-hidden="true">
    <div class="orb one"></div><div class="orb two"></div><div class="orb three"></div><div class="scan"></div>
    <div class="dot a"></div><div class="dot b"></div><div class="dot c"></div><div class="dot d"></div><div class="dot e"></div>
  </div>
  <div class="wrap">
    <div class="badge"><span class="dot alpha"></span> {RELEASE} · {TAG} · Apache-2.0</div>

    <h2 class="hero-wordmark"><img src="{wordmark(aid)}" alt="{e(name)}"></h2>

    <p class="slogan">// {e(app["tagline"])}</p>

    <h1>{e(plain)} <span class="grad">{e(accent)}</span></h1>

    <p class="lede">{e(app["lede"])}</p>

    <div class="hero-cta">
      <a class="btn primary" href="{gh(repo, "/releases/tag/" + TAG)}" target="_blank" rel="noopener">Download {RELEASE} →</a>
      <a class="btn" href="#features">See what works</a>
      <a class="btn" href="{gh(repo)}" target="_blank" rel="noopener">
        <svg width="14" height="14" viewBox="0 0 24 24" fill="currentColor" aria-hidden="true"><path d="M12 .3a12 12 0 0 0-3.8 23.4c.6.1.8-.3.8-.6v-2c-3.3.7-4-1.6-4-1.6-.5-1.4-1.3-1.7-1.3-1.7-1.1-.7.1-.7.1-.7 1.2.1 1.8 1.2 1.8 1.2 1.1 1.8 2.8 1.3 3.5 1 .1-.8.4-1.3.8-1.6-2.6-.3-5.4-1.3-5.4-5.8 0-1.3.5-2.3 1.2-3.1-.1-.3-.5-1.5.1-3.2 0 0 1-.3 3.3 1.2a11.5 11.5 0 0 1 6 0c2.3-1.5 3.3-1.2 3.3-1.2.7 1.7.2 2.9.1 3.2.8.8 1.2 1.9 1.2 3.1 0 4.6-2.8 5.5-5.5 5.8.4.4.8 1.1.8 2.2v3.3c0 .3.2.7.8.6A12 12 0 0 0 12 .3"/></svg>
        Star on GitHub
      </a>
    </div>

    <div class="term" aria-label="get the source">
      <div class="term-bar"><div class="lights"><span></span><span></span><span></span></div><span class="ttl">get started — bash</span><span style="width:48px"></span></div>
<pre>{clone}</pre>
    </div>

    <p class="alpha-note"><strong>{RELEASE}</strong>{e(name)} is alpha software: features are incomplete, file formats may change between alphas, and it is not yet qualified for production work. Below, every feature is marked as working today, in progress or planned. <a href="{gh(repo, "/blob/" + TAG + "/ALPHA_0_1.md")}" target="_blank" rel="noopener">Release notes and current limits →</a></p>
  </div>
</header>

<!-- ─────────────────────── WHAT IT IS ─────────────────────── -->
<section id="what">
  <div class="wrap">
    <div class="eyebrow">// what it is</div>
    <h2 class="h">{e(app["line"])}</h2>
{what}
    <p class="sub" style="margin-top:18px">{e(app["alt"])} Part of the <a href="#family">Aether apps</a>: open-source tools for designing, animating and running real-world shows and machines.</p>
  </div>
</section>

<!-- ─────────────────────── FEATURES ─────────────────────── -->
<section id="features">
  <div class="wrap">
    <div class="center">
      <div class="eyebrow">// features</div>
      <h2 class="h">What {e(name)} does — honestly marked.</h2>
      <p class="sub">An alpha is a promise in progress. Each card says whether it works today, is being built now, or is on the roadmap.</p>
      <div class="status-key"><span class="k-ok">works today</span><span class="k-prog">in progress</span><span class="k-plan">planned</span></div>
    </div>
{groups_html}  </div>
</section>

<!-- ─────────────────────── AI ─────────────────────── -->
<section id="ai">
  <div class="wrap">
    <div class="eyebrow">// built-in ai</div>
    <h2 class="h">Your AI, using {"the server’s" if is_studio else "the app’s"} own tools.</h2>
    <p class="sub">Connect ChatGPT, Claude or Gemini once in Aether Studio. Agents work through the same commands you use — validated, undoable and recorded — never through screen-scraping. AI is optional: nothing you save ever needs it. <span class="feature" style="display:inline;padding:0;border:0;background:none"><span class="pill {ai_cls}" style="margin:0 0 0 6px">{ai_label}</span></span></p>
    <ul class="ai-list">
{ai_items}
      <li>The same tools are available from the command line and as MCP tools, with scoped permissions and safe retries.</li>
    </ul>
    {example}
  </div>
</section>
{studio_section}
<!-- ─────────────────────── WHAT EVERY AETHER APP GETS ─────────────────────── -->
<section id="suite">
  <div class="wrap">
    <div class="center">
      <div class="eyebrow">// the aether difference</div>
      <h2 class="h">What every Aether app brings.</h2>
      <p class="sub">The apps are independent — each one runs on its own — and they share one server, one account, one file system, one design language and one way for AI to help.</p>
    </div>
    <div class="feature-grid">
{suite_cards}
    </div>
  </div>
</section>

<!-- ─────────────────────── ROADMAP ─────────────────────── -->
<section id="roadmap">
  <div class="wrap">
    <div class="eyebrow">// roadmap</div>
    <h2 class="h">Where {e(name)} goes next.</h2>
    <div class="roadmap">
{milestones}
    </div>
    <div class="faq">
      <details><summary>Can I use it for real work yet?</summary><p>Try it, test it and tell us what breaks — but keep copies of anything important. Alpha file formats can change, and features marked in progress or planned are not finished.</p></details>
      <details><summary>Do I need a server?</summary><p>No. Each app keeps its core features on one machine. Aether Studio adds sharing, versions, multi-user work, AI connections and access from any device.</p></details>
      <details><summary>Do I need AI?</summary><p>No. AI is an optional helper that uses the app’s own tools. Everything you make opens, edits and plays without it.</p></details>
      <details><summary>Who owns my files?</summary><p>You do. Apache-2.0 software, open formats, and storage on hardware you choose.</p></details>
    </div>
  </div>
</section>

<!-- ─────────────────────── FAMILY ─────────────────────── -->
<section id="family">
  <div class="wrap">
    <div class="center">
      <div class="eyebrow">// the aether apps</div>
      <h2 class="h">One suite, one server, every app.</h2>
      <p class="sub">Open-source tools for designing, animating and running real-world shows and machines.</p>
    </div>
    <div class="family">
{family}
    </div>
  </div>
</section>

<!-- ─────────────────────── FOOTER ─────────────────────── -->
<footer>
  <div class="wrap">
    <div class="foot-brand">
      <img src="{JR_LOGO}" alt="Jenkins Robotics" width="42" height="42" loading="lazy">
      <div>
        <div class="foot-line">{e(name)} · {RELEASE} · Apache-2.0</div>
        <div class="foot-sub">A <a href="https://jenkinsrobotics.com" target="_blank" rel="noopener">Jenkins Robotics</a> project — one of the open-source <a href="{pages_url("AetherStudio")}">Aether apps</a>.</div>
        <div class="foot-motto">&ldquo;Engineering the future, one robot at a time.&rdquo;</div>
      </div>
    </div>
    <div class="foot-cols">
      <div class="foot-col">
        <div class="foot-h">Project</div>
        <a href="{gh(repo)}" target="_blank" rel="noopener">GitHub repo</a>
        <a href="{gh(repo, "/blob/master/README.md")}" target="_blank" rel="noopener">README</a>
        <a href="{gh(repo, "/issues")}" target="_blank" rel="noopener">Issues</a>
      </div>
      <div class="foot-col">
        <div class="foot-h">Aether</div>
        <a href="{pages_url("AetherStudio")}">Aether Studio</a>
        <a href="{pages_url("Aether-CAD")}">Aether CAD</a>
        <a href="{pages_url("Aether-Animation")}">Aether Animation</a>
        <a href="{pages_url("Aether-Map")}">Aether Map</a>
      </div>
      <div class="foot-col">
        <div class="foot-h">Jenkins Robotics</div>
        <a href="https://jenkinsrobotics.com" target="_blank" rel="noopener">jenkinsrobotics.com</a>
        <a href="https://jenkinsrobotics.github.io" target="_blank" rel="noopener">Project index</a>
        <a href="https://discord.gg/sAnE5pRVyT" target="_blank" rel="noopener">Discord</a>
      </div>
    </div>
  </div>
</footer>

<script>
  // Intersection-observer reveal — fades each section in once.
  const reveal = (entries) => {{ for (const e of entries) if (e.isIntersecting) e.target.classList.add('in'); }};
  if ('IntersectionObserver' in window) {{
    const io = new IntersectionObserver(reveal, {{ threshold: 0.12, rootMargin: '0px 0px -10% 0px' }});
    document.querySelectorAll('.hero, section').forEach(el => io.observe(el));
  }} else {{
    document.querySelectorAll('.hero, section').forEach(el => el.classList.add('in'));
  }}
</script>

</body>
</html>
"""


def readme_top(app: dict) -> str:
    name, repo, aid = app["name"], app["repo"], app["id"]
    md = lambda items, mark: "\n".join(f"- {mark} **{t}** — {d}" for t, d, *_ in items)  # noqa: E731
    rows = "\n".join(
        f'| <img src="{suite_icon(a["id"])}" width="32" alt=""> | '
        + (f'**{a["name"]}** | **{a["line"]}** · you are here' if a is app else f'{a["name"]} | {a["line"]}')
        + f' | [Site]({pages_url(a["repo"])}) · [GitHub]({gh(a["repo"])}) |'
        for a in APPS)
    sections = [f"### Works today\n\n{md(app['works'], '✅')}"]
    if app["progress"]:
        sections.append(f"### In progress\n\n{md(app['progress'], '🔨')}")
    sections.append(f"### Planned\n\n{md(app['planned'], '🗺️')}")
    ai = "\n".join(f"- {x}" for x in app["ai"])
    ai_state = {"works": "Works today", "progress": "In progress", "planned": "Planned"}[app["ai_status"]]
    suite = "\n".join(f"- **{t}.** {d}" + (f" _({n})_" if n else "") for t, d, s, n in SUITE)
    roadmap = "\n".join(f"| {v} | {t} | {d} |" for v, t, d in app["roadmap"])
    studio = "" if aid == "studio" else f"""
## On its own, or with Aether Studio

{name} keeps its core features on a single machine. Connect it to
[Aether Studio]({pages_url("AetherStudio")}), your own server, and it gains what a
team needs: access from any device, built-in AI, PDM with versions, branches and
releases, and multi-user sharing, comments and tasks. {app["studio_extra"]}
"""
    get_started = f"""```sh
git clone --branch v0.1.0-alpha.1 --single-branch {gh(repo)}.git
cd {repo}
python3 tools/fetch-vendor.py
```

See [Alpha 0.1 setup and current limits](ALPHA_0_1.md) for frontend build and
server requirements. The web download is a frontend bundle, not a desktop installer."""
    return f"""<!-- Product section generated by AetherStudio/dev/site/build_pages.py (apps.py). Edit there; developer notes below the line are kept. -->

> **Alpha 0.1:** [release setup, shared UI and current limitations](ALPHA_0_1.md). Fetch the checksum-locked vendor packages before installing dependencies.

<p align="center"><img src="{icon(aid)}" width="112" alt=""></p>

<h1 align="center">
  <picture>
    <source media="(prefers-color-scheme: dark)" srcset="{wordmark(aid, "dark")}">
    <img src="{wordmark(aid, "light")}" height="64" alt="{name}">
  </picture>
</h1>

<p align="center">{app["line"]}</p>

<p align="center">
  <a href="{gh(repo, "/releases/tag/" + TAG)}"><img alt="{RELEASE}" src="https://img.shields.io/badge/release-{TAG.replace("-", "--")}-d29922"></a>
  <img alt="Apache-2.0" src="https://img.shields.io/badge/license-Apache--2.0-58a6ff">
  <a href="{pages_url(repo)}"><img alt="Website" src="https://img.shields.io/badge/site-{repo.replace("-", "--")}-1f6feb"></a>
</p>

{app["lede"]} {app["alt"]}

> **{RELEASE} — early access.** {name} is alpha software: features are incomplete,
> file formats may change between alphas, and it is not yet qualified for production
> work. Every feature below is marked as working today, in progress or planned.

## Features

{(chr(10) * 2).join(sections)}

## Built-in AI · {ai_state}

Connect ChatGPT, Claude or Gemini once in Aether Studio (**Plugins → My connections**).
Agents use the app's own commands — validated, undoable and recorded. AI is optional:
nothing you save ever needs it.

{ai}
- The same tools are available from the command line and as MCP tools, with scoped permissions and safe retries.

Example: {app["ai_example"]}
{studio}
## What every Aether app brings

{suite}

## Roadmap

| Release | Focus | What it means |
|---|---|---|
{roadmap}

## Get started

{get_started}

See the [website]({pages_url(repo)}) for the full tour.

## The Aether apps

| | App | What it's for | Links |
|---|---|---|---|
{rows}
"""


def readme(app: dict, current: str) -> str:
    marker = "\n---\n"
    notes = current.split(marker, 1)[1].lstrip("\n") if marker in current else ""
    if notes.startswith("## Developer notes"):
        notes = notes.split("\n", 1)[1].lstrip("\n")
    body = readme_top(app)
    if notes:
        body += f"\n---\n\n## Developer notes\n\n{notes}"
    return body


SITE_MD = """# {name} website

This branch (`gh-pages`) is the published site for {name}: GitHub → Settings →
Pages → Deploy from a branch → `gh-pages` / `(root)`. It is live at {url}.

Generated by `AetherStudio/dev/site/build_pages.py` from `apps.py` (content) and
`jaeger.css` (the Jaeger page design). Edit there and rebuild; do not hand-edit.
Logos come from `AetherStudio/core/assets/branding`.
"""


def resized(src: Path, dest: Path, size: int) -> None:
    """Copy a square PNG at `size` px (sips, built into macOS); plain copy elsewhere."""
    dest.parent.mkdir(parents=True, exist_ok=True)
    if shutil.which("sips"):
        subprocess.run(["sips", "-Z", str(size), str(src), "--out", str(dest)], check=True, capture_output=True)
    else:  # ponytail: full-size copy off macOS; add Pillow if CI builds the sites
        shutil.copyfile(src, dest)


def branding(app: dict, root: Path) -> None:
    """The app's own logos plus small suite icons, named per app, in assets/branding."""
    aid, out = app["id"], root / "assets/branding"
    resized(BRANDING / f"apps/{aid}.png", out / f"aether-{aid}-icon.png", 512)
    resized(BRANDING / f"marks/{aid}.png", out / f"aether-{aid}-mark.png", 512)
    for surface in ("dark", "light"):
        for ext in ("png", "svg"):
            shutil.copyfile(BRANDING / f"wordmarks/{aid}-{surface}.{ext}", out / f"aether-{aid}-wordmark-{surface}.{ext}")
    for other in APPS:
        resized(BRANDING / f"apps/{other['id']}.png", out / f"suite/aether-{other['id']}-icon.png", 128)
    (out / "README.md").write_text(
        f"# {app['name']} branding\n\nCopied from `AetherStudio/core/assets/branding` by `dev/site/build_pages.py`; "
        "change the originals there, then rebuild.\n\n"
        f"- `aether-{aid}-icon.png` — square app icon (512 px)\n"
        f"- `aether-{aid}-mark.png` — transparent A mark (512 px)\n"
        f"- `aether-{aid}-wordmark-dark.*` — horizontal logo for dark surfaces\n"
        f"- `aether-{aid}-wordmark-light.*` — horizontal logo for light surfaces\n"
        "- `suite/` — 128 px icons of every Aether app, for cross-links\n")


def site_files(app: dict) -> dict:
    return {"index.html": page(app), "SITE.md": SITE_MD.format(name=app["name"], url=pages_url(app["repo"]))}


def build(check: bool) -> int:
    stale = []
    for app in APPS:
        root, site = GITHUB / app["repo"], PAGES / app["repo"]
        readme_path = root / "README.md"
        outputs = {readme_path: readme(app, readme_path.read_text() if readme_path.exists() else "")}
        outputs.update({site / name: text for name, text in site_files(app).items()})
        for path, text in outputs.items():
            if not path.exists() or path.read_text() != text:
                stale.append(path)
                if not check:
                    path.parent.mkdir(parents=True, exist_ok=True)
                    path.write_text(text)
        if not check:
            branding(app, root)
            shutil.rmtree(site / "assets", ignore_errors=True)
            shutil.copytree(root / "assets", site / "assets")
    for path in stale:
        print(("stale: " if check else "wrote: ") + str(path.relative_to(GITHUB)))
    return 1 if check and stale else 0


def publish() -> int:
    """Commit each local site to its gh-pages branch and push. Run explicitly."""
    for app in APPS:
        repo, site = GITHUB / app["repo"], PAGES / app["repo"]
        with tempfile.TemporaryDirectory() as tmp:
            work = Path(tmp) / "gh-pages"
            git = lambda *a, cwd=repo: subprocess.run(["git", *a], cwd=cwd, check=True)  # noqa: E731
            git("fetch", "origin", "gh-pages")
            git("worktree", "add", "--detach", str(work), "origin/gh-pages")
            try:
                for child in work.iterdir():
                    if child.name != ".git":
                        shutil.rmtree(child) if child.is_dir() else child.unlink()
                shutil.copytree(site, work, dirs_exist_ok=True)
                git("add", "-A", cwd=work)
                if subprocess.run(["git", "diff", "--cached", "--quiet"], cwd=work).returncode:
                    git("commit", "-m", f"Website: {app['name']} {RELEASE}", cwd=work)
                    git("push", "origin", "HEAD:gh-pages", cwd=work)
            finally:
                git("worktree", "remove", "--force", str(work))
    return 0


if __name__ == "__main__":
    sys.exit(publish() if "--publish" in sys.argv else build("--check" in sys.argv))
