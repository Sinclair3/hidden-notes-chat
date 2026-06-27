# Claude Code Prompts — Hidden Notes

Run these **one phase at a time**, in order. Test each phase before moving on. Ask Claude Code to commit to git between phases so you can always roll back.

**Before you start** you need three free accounts: Claude Code (installed), Supabase (supabase.com — make one empty project), and Netlify (netlify.com — only for Phase 6).

> Tip: keep this folder inside your project so Claude Code can read the design files. You can always say "make it match the design".

---

## PHASE 0 — Set up the project
*After this: an empty, organised scaffold — no features yet.*

```
I'm building a privacy app: on the surface it's a fully working Notes app, but it secretly hides a real-time chat. There are HTML design files in this folder — open "Hidden Notes — First Page Wireframe.dc.html" and the README/prompts in the design_handoff folder, and study the layout, colors, and components before writing any code.

Stack: plain HTML, CSS, and vanilla JavaScript — no frameworks. Backend: Supabase free tier with NO user login (both phones share one hard-coded room key and sync in real time). Deploy target: an installable PWA hosted on Netlify.

For now, just scaffold the project — don't build features. Create: index.html, styles.css, app.js, supabase.js (config), manifest.webmanifest, and sw.js (service worker). Use the design's palette: white background, near-black text #1d1d1f, yellow accent #f5c63b, system sans font. Show me the file structure when done.
```

---

## PHASE 1 — The Notes app (the disguise)
*After this: a real notes app — create, edit, delete, search — matching Frame ①.*

```
Build the Notes home screen to match Frame ① in the wireframe: a top bar with the title "Notes" and a round bullseye logo, a prominent search bar, filter chips (All / Personal / Work / Lists), a 2-column masonry grid of note cards (some softly tinted), and a yellow + floating button bottom-right.

The notes must really work:
- The + button opens an editor to create a note (title + body).
- Tapping a card opens it to edit.
- Each note has a delete action.
- Typing in the search bar filters notes by title/body in real time.
- Persist all notes in localStorage so they survive a refresh.

Match the colors, corner radii, and spacing to the design. Don't add the chat or any secret behavior yet.
```

---

## PHASE 2 — The secret unlock
*After this: typing the code, shaking, or a 5× logo tap flips to a placeholder chat screen.*

```
Add the hidden unlock. There are three triggers, and each one instantly swaps the whole screen to a chat view — no animation, no flicker, no trace:

1. The user types the exact code ##open into the search bar and presses Enter.
2. A strong phone shake (listen to the devicemotion event).
3. A discreet fallback: tapping the bullseye logo 5 times quickly.

Add a way back to Notes that also clears the search field. Any normal search (anything other than ##open) must still just filter notes as usual. For now the chat view can be an empty placeholder — we build it next.
```

---

## PHASE 3 — The chat screen
*After this: the chat UI from Frame ②, working locally with sample messages.*

```
Build the chat screen to match Frame ② in the wireframe: a header (back arrow, avatar, contact name, "active now" dot, and a "private" lock pill), a scrolling message list, and a composer at the bottom (attach + button, text input, mic button, send button).

Messages: incoming bubbles are grey and left-aligned; outgoing bubbles are yellow (#f5c63b) and right-aligned. Add date separators (e.g. TODAY). Support emoji in text. For now use a few sample messages held in JavaScript — no backend yet. Sending a message should append it to the list locally. Match the bubble shapes, fonts, and spacing to the design.
```

---

## PHASE 4 — Real-time sync (Supabase)
*After this: two phones, same room key, messages appearing live — no login. Have your Supabase URL + anon key ready.*

```
Wire the chat to Supabase so two phones sync live with NO login. Use the supabase-js client.

- Give me the SQL to create a "messages" table: id, room (text), sender (text), type (text), content (text), created_at (timestamp), reply_to (id, nullable), reactions (jsonb).
- Hard-code one shared ROOM_KEY constant in the app so both devices join the same room.
- On load, fetch existing messages for that room, ordered by time.
- Subscribe to Supabase Realtime so new inserts and updates appear instantly.
- Sending a message writes a row.
- Generate a stable random sender id once per device and store it in localStorage, so we can tell "me" from "them".
- Put my Supabase project URL and anon key in supabase.js — I'll paste the real values in. Tell me exactly where to get them and where to paste them.
```

---

## PHASE 5 — Images, voice, reactions, replies
*After this: the full rich chat from the wireframe — everything real-time.*

```
Add the rich messaging features from the design, all kept real-time:

- Image & file sharing: upload to a Supabase Storage bucket and show an inline thumbnail/preview in the bubble (like the wireframe).
- Voice messages: record with MediaRecorder, upload the audio, and render a bubble with a waveform, duration, and a play button.
- Reactions: long-press a bubble to pick an emoji; store it on the message's reactions field and show it on the bubble.
- Threaded replies: swipe or long-press a message to reply, quoting the original above the new message (use the reply_to field).

Give me any extra SQL / Storage bucket setup I need, with step-by-step instructions.
```

---

## PHASE 6 — Install & deploy (PWA + Netlify)
*After this: a live URL you can install to your phone's home screen like a real app.*

```
Make it an installable PWA and deploy it.

- Fill in manifest.webmanifest: app name "Notes", short_name, theme_color #f5c63b, background white, display standalone, and icons (generate simple placeholder icons that look like a notes app — give me the files).
- Register the service worker (sw.js) to cache the app shell so it loads offline and is installable.
- Confirm it passes the "installable" checks (linked manifest, valid icons, HTTPS, service worker).

Then give me step-by-step instructions to deploy this folder to Netlify for free — both the drag-and-drop way and the Netlify CLI way — and explain how to install the app to an Android phone's home screen from the browser once it's live.
```

---

### If something breaks
- Paste the error back to Claude Code: "this didn't work, here's the error" — it fixes its own code.
- Test shake / camera / microphone **on a real phone** — those sensors don't exist on a laptop.
- Keep the wireframe file in the project so you can say "make it match the design" anytime.
