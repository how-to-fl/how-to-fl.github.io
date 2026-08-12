# Contributing

You do not need to know how to code. Most of this guide will be written by people
who have never opened a terminal, and that is the point.

---

## If GitHub is not loading

**Start here, because for a lot of you this is the relevant section.**

`github.com` runs at roughly 60% disruption from mainland China. If it's timing out,
that is not your fault and there is nothing to fix — just use one of these instead:

- **WeChat** — message a maintainer. A voice note is fine. Genuinely.
- **Email** — send it to the shared address in the cohort chat.
- **A contribution sprint** — see below. Easiest of the lot.

A maintainer enters it for you. Your name still goes on it.

**Never** let "I couldn't get GitHub to load" be the reason something didn't get
written down. The information in your head is the scarce thing here; the tooling is not.

---

## The four ways to contribute

### 1. Add a place to the map

Open an [issue form](../../issues/new/choose), fill in five fields, submit. A maintainer
adds it to `data/places.yaml` and the map rebuilds.

If you're comfortable editing files, you can also edit
[`data/places.yaml`](data/places.yaml) directly in GitHub's web editor — the format is
documented at the top of the file.

> **The one rule that matters: coordinates must be WGS-84.**
>
> China mandates an offset coordinate system. Amap (高德) and Tencent use GCJ-02;
> Baidu uses BD-09. This map, OpenStreetMap and GPS all use WGS-84.
>
> A coordinate copied out of a Chinese map app lands **300–500 metres** from where you
> meant — far enough to point at the wrong side of a six-lane road, close enough that
> nobody notices until someone is lost.
>
> **Safe method:** find the place on [openstreetmap.org](https://www.openstreetmap.org),
> right-click the spot, choose "Show address". The numbers in the URL are WGS-84.
>
> If you're not sure, leave the coordinates blank and describe where it is. CI rejects
> anything outside greater Beijing, so a mistake gets caught — but a blank is safer
> than a wrong number.

### 2. Write or fix a page

Every page is a Markdown file in `src/content/docs/`. Click the pencil icon on any page
on the site to edit it directly in your browser.

Pages marked **stub** have the intended headings already written. Replacing
`_To be written._` under one heading is a complete, useful contribution. You do not
have to write the whole page.

### 3. Report something wrong

Restaurants close. Visa rules change. Apps get redesigned. Use the
[correction form](../../issues/new/choose) — this is the most valuable thing you can send.

### 4. Own a section

Put your name in a page's frontmatter as `owner`, and re-check it each May. A section
with a name attached gets updated; a section belonging to everyone rots.

---

## Page frontmatter

```yaml
---
title: Opening a bank account
description: One sentence — this shows in search results.
last_verified: 2026-08     # YYYY-MM. When you last confirmed this is true.
owner: cohort-6-toni       # Who re-checks it in May.
status: live               # stub | draft | live
---
```

`last_verified` is not bookkeeping. Pages older than twelve months render a visible
warning to the reader. **Bump it when you check a page, not when you edit it** — those
are different things, and the date is a promise about the first.

---

## House rules

**Self-host everything.** No Google Fonts, no CDN scripts, no `raw.githubusercontent.com`
(blocked by some Chinese ISPs), no YouTube embeds. These don't degrade gracefully —
they hang, and the page never finishes loading. CI fails the build if it finds one.

**Write short and specific.** "Best 麻辣烫 near campus, open till 3am, ¥25" beats a
paragraph of enthusiasm.

**Include Chinese.** Names and addresses in characters, always. Someone is going to
show this to a taxi driver.

**Say when you're unsure.** "I think this changed in 2026 but check" is useful.
Confident wrongness is not.

### Judgment

This is a public site about living in China, written by students on a PKU scholarship,
with our names on it. Nearly all of it is logistics and restaurant recommendations,
which is fine. A few deliberate lines:

- Keep VPN content **descriptive, not instructional**.
- Don't publish specifics that could expose venues or people in the queer scene. Write
  it for the reader who needs it without making it a directory.
- No photos of classmates without asking them.
- No political commentary. It isn't what this guide is for.

---

## Contribution sprints

Ninety minutes, pizza, one laptop that's already logged in, everyone calls out places
while someone types. Two of these produce more than six months of asking nicely in the
group chat — and they work regardless of what the firewall is doing that day.

Run one in the second week of each semester, while the newest cohort's "everything is
confusing" memories are still fresh. **Ask them the questions, not the answers** —
Cohort 7 in week one knows exactly what's confusing; Cohort 6 has already forgotten.

---

## Running the site locally

Only needed if you want to change how the site works, rather than what it says.

```bash
npm install
npm run dev       # local preview
npm run validate  # the checks CI runs
npm run build     # production build
```
