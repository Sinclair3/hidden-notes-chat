# Handoff: Hidden Notes — a disguised Notes app with a secret real-time chat

## Overview
A privacy/safety app. On the surface it is a **fully working Notes app**. A hidden trigger (a secret code typed in the search bar, a phone shake, or a 5× tap on the logo) instantly swaps the screen to a **private real-time chat** shared between two devices. The Notes app must genuinely work — that is what makes the disguise convincing.

## About the design files
The files in this bundle are **design references created in HTML** — prototypes that show the intended look, layout, and behavior. They are **not** production code to ship directly. The task is to **recreate these designs** in the chosen environment. For this project the explicitly requested stack is **plain HTML + CSS + vanilla JavaScript (no framework)** with a **Supabase** backend, shipped as a **PWA on Netlify**. Use the HTML mock as the visual source of truth.

Open and study before coding:
- `Hidden Notes — First Page Wireframe.dc.html` — the home screen (Frame ①) and a chat sample (Frame ②), with annotations.

> Note: the `.dc.html` files are "Design Components" — open them in a browser to view. Read them as visual references; you do not need their runtime.

## Fidelity
**Mid / high fidelity.** Colors, type, radii, and spacing below are final-ish and should be matched closely. Layout and component structure are settled. Treat the wireframe as the visual target.

## Build phases
Implement in this order (detailed copy-paste prompts are in `CLAUDE_CODE_PROMPTS.md`):
0. Project scaffold
1. Notes app (real create/edit/delete/search, localStorage) — matches Frame ①
2. Secret unlock (`##open` in search + Enter, devicemotion shake, 5× logo tap) → swap to chat
3. Chat UI shell with sample messages — matches Frame ②
4. Supabase realtime sync (shared hard-coded room key, no login)
5. Rich messaging: image/file sharing, voice messages, reactions, threaded replies
6. PWA manifest + service worker + Netlify deploy

## Supabase setup
Use this SQL in Supabase SQL editor to create the `messages` table:

```sql
create table public.messages (
  id uuid primary key default gen_random_uuid(),
  room text not null,
  sender text not null,
  type text not null,
  content text not null,
  reply_to uuid null,
  reactions jsonb null,
  created_at timestamptz not null default now()
);

alter table public.messages enable row level security;

create policy "public messages read" on public.messages
  for select using (true);

create policy "public messages insert" on public.messages
  for insert with check (true);
```

Then enable realtime for the `messages` table and use the `anon` public API key.

## Screens / views

### Frame ① — Notes Home (the disguise)
- **Purpose:** the cover app. Browse/search/create/edit/delete notes.
- **Layout (mobile, ~378px wide screen):** vertical stack — status bar, app header, search bar, filter chips, scrollable 2-column masonry grid, floating + button, bottom nav.
- **Components:**
  - **App header:** round bullseye logo (26px circle, 1.6px #1d1d1f border, 9px filled dot center) + title `Notes` (23px, weight 700, letter-spacing −0.02em). Right side: a grid/list toggle icon (36px grey circle) and an avatar circle (`JS`, 36px, bg #cfd6c7, text #3d4a32).
  - **Search bar (IMPORTANT — this is the secret unlock input):** full-width pill, bg #f3f2f0, **1.5px #f5c63b border**, 14px radius, soft yellow glow `0 0 0 4px rgba(245,198,59,0.14)`, magnifier icon (#9b9ba0), placeholder `Search your notes` (15.5px #9b9ba0), a list/filter icon on the right.
  - **Filter chips:** `All` (active: bg #fff1b8, text #1d1d1f, weight 600) · `Personal` · `Work` · `Lists` (inactive: bg #f3f2f0, text #6b6b70). 99px radius, 13px.
  - **Note cards (masonry, 2 col, 11px gap):** 16px radius, 14px padding, 1px border. White cards = #fff border #eceae6. Tinted variants used: warm yellow (#fff8e1 / border #f3e6b8), blue-grey (#e9f3f5 / #d3e6ea), taupe (#f1ece6 / #e3dbd1), rose (#fdeceb / #f3d6d3). Card title 14.5px weight 600 #1d1d1f; preview 13px #6b6b70 line-height 1.5. Tag pills 11px, e.g. `travel`. A checklist note shows round/square checkboxes; checked = #f5c63b fill with a #1d1d1f check, struck-through grey text.
  - **Floating + button (FAB):** 58px, 20px radius, bg #f5c63b, #1d1d1f plus icon, shadow `0 10px 24px -6px rgba(245,198,59,0.7)`. Bottom-right, ~22px inset, above nav.
  - **Bottom nav:** 64px, translucent white + blur, 1px top border #eceae6. Items: `Notes` (active #1d1d1f), `Reminders`, `Archive` (#9b9ba0). Icon 22px, label 10.5px.

### Frame ② — Hidden Chat
- **Purpose:** the private 1:1 chat revealed by the unlock.
- **Layout:** status bar → chat header → scrollable message list → composer → encryption caption.
- **Components:**
  - **Header:** bg #f6f5f3, 1px bottom border #eceae6. Back chevron (#6b6b70), 36px avatar (`SA`, bg #d8c5a3, text #5a4628), name `Sam` (15px/600), status `● active now` (#9b9ba0, green dot #3aa56b), and a **`private` pill** (bg rgba(245,198,59,0.18), text #7a5a18, lock icon, 99px radius).
  - **Bubbles:** incoming = bg #ececea, text #1d1d1f, left-aligned; outgoing = bg **#f5c63b**, text #1d1d1f, right-aligned. 18px radius with a 5px "tail" corner on the last of a group. Font 14.5px, line-height 1.4, max-width ~74%.
  - **Date separators:** centered pill, 10.5px #9b9ba0, bg #f3f2f0, e.g. `YESTERDAY`, `TODAY`.
  - **Reaction:** small white pill (`❤️ 1`) overlapping the bottom-right of a bubble, 1px #eceae6 border, soft shadow.
  - **Threaded reply:** above the new bubble, an `↩ replying to Sam` label + a quoted snippet with a 3px #f5c63b left border on bg #faf6ea.
  - **Image attachment:** ~200×140 rounded media block (16px radius, 5px tail), filename chip with a photo icon.
  - **Voice message:** outgoing yellow bubble with a 30px dark round play button (#1d1d1f, #f5c63b triangle), a bar-style waveform (3px bars, #1d1d1f, varied heights/opacity), and a duration `0:14`.
  - **Typing indicator:** grey bubble with 3 animated dots.
  - **Composer:** pill bg #f3f2f0, 22px radius — attach `+` icon, `Message…` placeholder (#9b9ba0), mic icon, and a 34px #f5c63b round send button (#1d1d1f paper-plane). Caption under it: `end-to-end encrypted · shared room · no account` (10.5px #9b9ba0).

## Interactions & behavior
- **Notes:** + opens editor (title + body); tap card to edit; delete action per note; live search filters by title/body. Persist to `localStorage`.
- **Unlock (all three swap instantly, no animation):**
  1. Search input value `== "##open"` on Enter → show chat, hide notes.
  2. `devicemotion` strong shake → show chat.
  3. Bullseye logo tapped 5× quickly → show chat.
  - Back from chat returns to Notes **and clears the search field**. Any non-code search behaves normally.
- **Chat realtime:** fetch room history on load, subscribe to Supabase Realtime for inserts/updates, send = insert row. Device identity = random id in `localStorage` to distinguish me/them.
- **Rich features:** image/file → Supabase Storage + inline preview; voice → MediaRecorder upload + waveform/duration/play; reactions → emoji stored on `reactions`; replies → `reply_to` with quoted original.

## State management
- `notes[]` (id, title, body, tag, color, updatedAt) in localStorage.
- `view` = `'notes' | 'chat'`.
- `deviceId` (localStorage), `ROOM_KEY` (hard-coded constant shared by both devices).
- `messages[]` from Supabase (id, room, sender, type, content, created_at, reply_to, reactions).
- Realtime subscription handle.

## Design tokens
- **Colors:** text #1d1d1f · text-2 #6b6b70 · text-3 #9b9ba0 · accent/yellow **#f5c63b** · accent-soft #fff1b8 / #fff8e1 · surface #ffffff · surface-alt #f6f5f3 / #f3f2f0 · divider #eceae6 · incoming bubble #ececea · tints: #fff8e1, #e9f3f5, #f1ece6, #fdeceb · green dot #3aa56b · code/dark surface #16140f–#1d1d1f.
- **Radii:** chips/pills 99px · inputs 14px · cards/bubbles 16–18px · FAB 20px · phone screen 36px.
- **Type:** UI = system sans (`-apple-system, BlinkMacSystemFont, "Segoe UI", system-ui, sans-serif`). Mono accents = Geist Mono. Sizes: titles 23px/700, card title 14.5/600, body 13–14.5, captions 10.5–11.5.
- **Shadows:** FAB `0 10px 24px -6px rgba(245,198,59,0.7)`; cards subtle; search glow `0 0 0 4px rgba(245,198,59,0.14)`.

## Assets
- No external image assets — all icons are inline SVG (Lucide-style, 1.6–2.2px stroke). Recreate with an icon set or inline SVG. App icons for the PWA need to be generated (Phase 6).

## Files in this bundle
- `README.md` — this spec.
- `CLAUDE_CODE_PROMPTS.md` — copy-paste prompts, phase by phase.
- `Hidden Notes — First Page Wireframe.dc.html` — the visual reference (open in a browser).
