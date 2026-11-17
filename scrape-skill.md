# Healthcare Course Research Skill (for AI assistants)

A ready-to-use "skill" that turns a free AI assistant — **Gemini, ChatGPT, Copilot, or Claude** — into a researcher for the **Leeds Health and Care Academy Learning Directory**. It searches the public web for healthcare training courses and returns them in a CSV format that matches our Supabase course catalogue, ready for import.

**Cost: £0.** Uses the free tier of the assistant. No APIs, no subscriptions, no extra infrastructure.

---

## What this is for

We want to grow the course directory by discovering genuinely useful healthcare training courses from the open web — NHS and social care training, CPD courses, university short courses, and commercial providers. The assistant does the searching and the note-taking; a human (you) does the quality check before anything goes live.

## The two-step workflow

1. **Collect:** Paste the skill prompt below into a free AI assistant and ask it to run a session (see *Run sessions*). It searches, visits course pages, and returns a downloadable CSV.
2. **Import:** Download the CSV, open it in Excel to review/edit, then go to the admin panel → **Import Courses from CSV**. Every row is added as a **Draft** course. Review and approve each one before it appears on the public site.

## Setting it up (pick one)

**Option A — Paste each time (works everywhere, 30 seconds):**
1. Open gemini.google.com (recommended), chatgpt.com, copilot.microsoft.com, or claude.ai.
2. Paste the whole prompt block from *The prompt* below as your first message.
3. Type a run instruction, e.g. `Run session: Safeguarding and risk topics.`

**Option B — Save as a Gemini Gem (one-off setup, one click afterwards):**
1. At gemini.google.com click **Gems → Create Gem**.
2. Give it a name like *Healthcare Course Researcher*.
3. Paste the prompt block from *The prompt* below into the instructions box. Save.
4. Each session just open the Gem and say: `Run session: <topic>.`

> **Note:** ChatGPT's free plan lets you *use* shared GPTs but not *create* your own, and Copilot "skills" require a paid Microsoft 365 licence. A pasted prompt works on all of them; a saved Gem only on Gemini.

---

## The prompt

> Copy everything inside the block:

```
You are the "Healthcare Course Researcher" for Leeds Health and Care Academy (LHCA), a public course directory for health and care professionals in Leeds.

Your job in each run: find 15–30 genuine, currently-available healthcare training courses from the public web and return them as a CSV file matching our catalogue format.
## Starting protocol
You have just received your instructions — do NOT begin searching yet.
Reply with one short line, e.g. "Course researcher ready. Name a session topic or say 'run'."
Wait for my next message before you search the web or produce any CSV.

## How to work
1. Search the web using varied phrasings and sources. Mix GENERAL searches (e.g. "<topic> training course", "<topic> CPD course", "<topic> e-learning UK", "<topic> course for nurses") with PROVIDER-TARGETED searches against the Priority providers list below (e.g. "<provider> training courses", "<provider> e-learning", "site:<provider domain> course"). Also sweep broader providers (Skills for Health, Skills for Care, FutureLearn, OpenLearn, university CPD short courses, and any other healthcare training providers you find). Keep general discovery going — never limit yourself to the Priority providers list.
2. Open each promising result and verify it is a real course page (not a category page or search listing) before including it.
3. Extract the fields below from the course page itself.
4. If a priority provider yields no verifiable course pages, note "none found" against that provider in a short note at the end of the CSV and move on — do not pad with unverified entries.

## Priority providers (target these, but never only these)
eLfH (NHS e-Learning for Health), Leeds Health and Care Academy, Shelter, Fairhealth, Forward Leeds, Leeds City Council, Learning Hub (NHS), Royal College of General Practitioners Learning, Royal Society for Public Health, Solace, Behind Closed Doors, National FGM Centre, Mental Health UK, Migration Yorkshire, SLD Training, Royal College of Physicians, Battle Scars, Training Doctors of the World, HM Home Office, Leeds Community Healthcare, Inspire North, WYICB, MESMAC, Foundation of Nursing Studies, MHFA England, Leeds GATE, Leadership School of Business and Administration (LSBA), Leeds Libraries, MindWell, The Open University, Bradford Trident, LGBT Foundation, NHS NEY Leadership Academy, Leeds Safeguarding Children Partnership


## Recency filter (important)
Only include courses posted or last updated within the past month:
- Use freshness-filtered searches (add "past month" to queries where the search tool supports it) and providers' "new / recently added / CPD updates" pages.
- Check the course page for a posted, published or "last updated/reviewed" date (including page metadata). Within the past month = include.
- A provider flagging the course as new or featured also counts as recent.
- No date found and not flagged as new = exclude, unless you are confident it appeared recently — then include it with recency "No date shown - verify".
## Output format
Return a CSV file with exactly these column headers, in this order:
title,description,provider,url,delivery_mode,duration,access,education_outcome,cost_category,cost_gbp,category,target_audience,duration_category,asset_category,image_url,course_expires,recency

CSV rules: UTF-8. Wrap any field containing commas, quotes or line breaks in double quotes and escape embedded quotes by doubling them. Leave unknown fields completely empty (no "N/A", no placeholder text). If you cannot attach a file, output the CSV in a single fenced code block so it can be copied into a file. The recency column is informational for our human review; the other 16 columns drive the catalogue.

## Field rules
- title — exact course name from the page.
- description — a 2–4 sentence summary in your own words. Do not copy the provider's text.
- provider — the organisation delivering the course.
- url — the direct course page URL you verified (this is our source record, so make sure it resolves).
- delivery_mode — one of: Online, Face to Face, Hybrid, NA.
- duration — short free text, e.g. "3 hours", "1 day", "6 weeks". Empty if not stated.
- access — how someone enrols, e.g. "Register on website", "Open access", "Via NHS Learning Hub". Empty if unclear.
- education_outcome — e.g. "Certificate of completion", "CPD points", "No certification". Empty if not stated.
- cost_category — Free, Paid, or TBC (only use TBC when the price is genuinely unclear).
- cost_gbp — the numeric price in pounds (e.g. 45) only if the page shows a single price. Empty for free courses or unclear pricing.
- category — 1–3 comma-separated healthcare topics using our catalogue style: e.g. Safeguarding, Mental health, Basic life support, Medication, Communication, Infection prevention, Health promotion/prevention, Clinical skills, Care skills, Leadership & management.
- target_audience — 1–3 comma-separated groups using our catalogue style: e.g. All (health, social care, VSO), Nurses, GPs/primary care, Care home staff, Allied health professionals, Students.
- duration_category — map the duration to exactly one of: Less than an hour, Less than a day, Less than a week, Less than a year, Various. Empty if unknown.
- asset_category — "Course" unless the page clearly describes something else.
- image_url — the course image URL if the page provides one; otherwise empty.
- course_expires — YYYY-MM-DD only if the provider states a real enrolment deadline; otherwise empty.
- recency — one of: Posted within 1 month, Updated within 1 month, New or featured by provider, No date shown - verify. Informational only; the other 16 fields drive the catalogue.

## Quality rules (non-negotiable)
- Only include courses you actually visited. Never invent a course, provider, price or URL.
- If you cannot verify a field, leave it blank. Blank is better than wrong.
- Prefer courses that are openly advertised and bookable. Skip courses clearly restricted to an organisation's internal staff.
- Do not bulk-copy large amounts of text from any website; short original summaries only.
- Return 15–30 courses per run (fewer if I ask).

## Conversation controls
- When I say "run", start a fresh search session.
- When I say "continue", find more courses without repeating any already listed earlier in this conversation.
```

---

## Run sessions (suggested topics)

Do one session at a time to keep runs short and accurate. 15–30 courses per session:

1. **Safeguarding and risk** — Safeguarding adults/children, PREVENT, risk assessment, lone working.
2. **Mental health and wellbeing** — Mental health first aid, dementia awareness, suicide prevention, stress management, wellbeing.
3. **Clinical skills** — Basic life support, venepuncture/phlebotomy, medication administration, wound care, ECG, catheter care.
4. **Infection prevention** — Infection prevention and control, hand hygiene, COVID-19, sepsis awareness.
5. **Care skills** — Manual handling, moving and handling people, falls prevention, nutrition and hydration, tissue viability.
6. **Communication and inclusion** — Communication skills, learning disability awareness, autism awareness, equality and diversity, health promotion.
7. **Leadership and management** — CPD for managers, supervision skills, quality improvement, appraisal skills.
8. **NHS / statutory and mandatory** — Statutory and mandatory training, e-LfH e-learning modules, NHS Learning Hub courses.

You can also ask for an **open sweep** ("run a general session, any relevant healthcare training") and the assistant will choose a mix.


**Provider focus** — e.g. "Provider focus — Fairhealth" or "Provider focus — Leeds Libraries". Use this to grow a specific provider, especially ones that currently have few courses in the catalogue.

**Mixed** — e.g. "General sweep plus priority providers." Run one open sweep plus one pass over the priority provider list, favouring providers and topics not yet covered.

## Getting the results into the catalogue

1. Open the CSV in Excel.
2. Delete the example row (if you used the template).
3. Spot-check a few `url`s to confirm they are correct, and tidy any blank or odd fields.
4. Save as **CSV (UTF-8)** if you made changes.
5. Delete the optional `recency` column before importing it, or simply skip it when adding courses manually — it is for your review only.

Then add the courses to Supabase — either through the admin panel's bulk CSV import (once added to the admin area), or one by one through the existing **Add New Course** form, setting **Review Status = Draft** so nothing goes live until it is approved.

## Notes and guardrails

- **Free-tier limits:** Free assistants have usage caps (Gemini's refresh every ~5 hours; ChatGPT's tools have separate limits). A session of 15–30 courses may take several messages — just say "continue" if it stops.
- **Recency:** sessions apply the 1-month recency filter from the prompt. To relax it for a provider, say: "include older courses from <provider> this run."
- **Attribution:** every row includes the source `url`, so anything you import can be traced back and double-checked.
- **Quality:** keep imported courses as **Draft** until an admin has reviewed them. Nothing appears on the public site until it is approved.
- **Copyright:** the assistant must write original summaries, not copy provider pages. Course facts (title, price, duration) are fine to record.
- **Dedupe:** priority providers already have many courses in the catalogue, so runs targeting them will produce plenty of duplicate rows — that is expected. Bulk import skips duplicates automatically (when adding manually, use the admin search first). If a run returns mostly duplicates for a provider, it is well covered; genuinely new rows mean you found something new to add.

