# Adding to the guide

You don't need to know how to code. Most of this was written by people who don't, and
that's the whole point.

---

## If GitHub won't load

**Start here, because for a lot of us this is the bit that matters.**

`github.com` runs at roughly 60% disruption from mainland China. If it's timing out on you,
that's not something you've done wrong and there's nothing for you to fix. Use one of these
instead:

- **WeChat** — message one of us. A voice note is completely fine.
- **Email** — the shared address is in the cohort chat.
- **Come to a contribution session** — easiest of the lot, see below.

One of us types it in. Your name still goes on it.

Please don't let "I couldn't get GitHub to load" be the reason something never gets written
down. What's in your head is the scarce thing here. The tooling isn't.

---

## Four ways to help

### 1. Put a place on the map

[Fill in the form](../../issues/new/choose) — five fields, then one of us adds it to
`data/places.yaml` and the map rebuilds itself.

If you're comfortable editing files, you can also edit
[`data/places.yaml`](data/places.yaml) straight in GitHub's web editor. The format is
documented at the top of the file.

> **The one rule worth being fussy about: coordinates have to be WGS-84.**
>
> China mandates an offset coordinate system. Amap (高德) and Tencent use GCJ-02, Baidu uses
> BD-09. Our map, OpenStreetMap and GPS all use WGS-84.
>
> Anything you copy out of a Chinese map app lands **300–500 metres** off — far enough to
> put someone on the wrong side of a six-lane road, close enough that nobody notices until
> they're standing there lost.
>
> **How to get one that works:** find the place on
> [openstreetmap.org](https://www.openstreetmap.org), right-click the spot, choose "Show
> address". The numbers in the URL are WGS-84.
>
> Not sure? **Leave them blank** and describe where it is. Our build rejects anything
> outside greater Beijing so a wild mistake gets caught, but a blank is safer than a wrong
> number — and much less work for us than tracking down why a pin is in a lake.

### 2. Write or fix a page

Every page is a Markdown file in `src/content/docs/`. Click the pencil at the bottom of any
page to edit it in your browser.

Pages marked **stub** already have their headings laid out. Replacing `_To be written._`
under a single heading is a proper contribution — you don't owe us the whole page.

### 3. Tell us we're wrong

Restaurants close. Visa rules change. Apps get redesigned and the button moves. Use the
[correction form](../../issues/new/choose) — genuinely the most useful thing you can send
us, because it's the thing that keeps the rest trustworthy.

### 4. Look after a section

Put your name in a page's frontmatter as `owner` and re-check it each May. A section with a
name on it gets updated; a section belonging to everybody quietly rots.

---

## The admin panel

If you'd rather not touch Markdown at all, there's a proper editor. Clone the repo, then:

```bash
npm install
npm run admin
```

That opens `http://localhost:4400` with forms for every place on the map and every page on
the site. It edits the real files on your laptop — no login, no internet needed, and it
works fine behind the firewall because it never leaves your machine.

When you're happy:

```bash
git add -A && git commit -m "Add some places" && git push
```

---

## Page frontmatter

```yaml
---
title: Opening a bank account
description: One line — this is what shows up in search results.
last_verified: 2026-08     # YYYY-MM. When you last confirmed this is true.
owner: cohort-7-name       # Who re-checks it each May.
status: live               # stub | draft | live
---
```

`last_verified` isn't admin. Pages older than a year show the reader a warning. **Bump it
when you've checked something, not when you've reworded it** — those are different things,
and the date is a promise about the first one.

---

## House rules

**Everything self-hosted.** No Google Fonts, no CDN scripts, no `raw.githubusercontent.com`
(blocked by some Chinese ISPs), no YouTube embeds. These don't fail gracefully — they hang,
and the page never finishes loading. Our build fails if it spots one.

**Short and specific.** "Best 麻辣烫 near campus, open till 3am, ¥25" beats a paragraph of
enthusiasm every time.

**Include the Chinese.** Names and addresses in characters, always. Someone's going to hold
this up to a taxi driver.

**Say when you're not sure.** "I think this changed in 2026 but check" is useful.
Confidently wrong is not.

### Things worth being careful about

This is a public site about living in China, written by students on a PKU scholarship, with
our names on it. Nearly all of it is logistics and restaurant recommendations, which is
fine. A few things we've agreed between us:

- Keep anything about VPNs **descriptive, not instructional**.
- Don't publish details that could expose venues or people in the queer scene. Write it for
  the person who needs it without turning it into a directory.
- No photos of each other without asking first.
- No political commentary. That's not what this is for.

---

## Contribution sessions

Ninety minutes, pizza, one laptop that's already logged in, everyone shouting out places
while somebody types. Two of these get more done than six months of asking nicely in the
group chat — and they work whatever the firewall is doing that day.

Run one in the second week of each semester, while the newest arrivals still remember being
confused. **Ask them the questions, not the answers** — in week one they know exactly
what's baffling. By week six they've forgotten it ever was.

---

## Running the site locally

Only needed if you want to change how the site works, rather than what it says.

```bash
npm install
npm run dev       # local preview
npm run admin     # the editing panel
npm run validate  # the checks our build runs
npm run build     # production build
```
