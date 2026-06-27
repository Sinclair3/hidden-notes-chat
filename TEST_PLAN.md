# Hidden Notes Chat Test Plan

## 1. Core chat functionality
- [ ] Open hidden chat via secret input or logo tap login flow
- [ ] Send a text message
- [ ] Receive a text message on the other device
- [ ] Edit a sent text message and verify the update syncs
- [ ] Delete a sent message and verify it disappears

## 2. Voice message flow
- [ ] Record a voice message longer than 10 seconds
- [ ] Send voice message from sender device
- [ ] Receive voice message on receiver device
- [ ] Play full voice message on receiver
- [ ] Confirm message stored as https URL in Supabase and not data URI

## 3. Typing and read status
- [ ] Show "typing..." when other user is typing
- [ ] Show read receipt on outgoing message after receiver opens chat

## 4. Reactions
- [ ] Tap reaction button and choose emoji
- [ ] Verify reaction appears on message
- [ ] Verify reaction persists after refresh and on other device

## 5. End-to-end encryption
- [ ] Enable encryption toggle and enter passphrase
- [ ] Send a text message while encryption is enabled
- [ ] Receive and decrypt text message on other device (must use same passphrase)
- [ ] Send a voice attachment while encryption is enabled
- [ ] Verify receiver can decrypt/play the voice attachment

## 6. Stealth / decoy mode
- [ ] Set a decoy PIN on the first open
- [ ] Enter correct PIN and confirm chat opens
- [ ] Enter wrong PIN and confirm decoy notes are shown

## 7. Self-destruct / scheduled messages
- [ ] Type `/expire 5` and send next message
- [ ] Confirm message deletes itself after 5 seconds
- [ ] Type `/sendat YYYY-MM-DD HH:MM:SS` to schedule a message
- [ ] Confirm message sends at the scheduled time

## 8. Notifications and theming
- [ ] Grant notification permission when chat initializes
- [ ] Send a message while app is out of focus and confirm desktop notification appears
- [ ] Tap theme button and confirm theme changes
- [ ] Refresh page and confirm theme persists

## 9. Attachments and compression
- [ ] Attach an image and send
- [ ] Confirm image is compressed and displays properly
- [ ] Attach a file and send
- [ ] Confirm attachment preview appears

## 10. Storage and backend
- [ ] Verify Supabase Storage bucket contains uploaded voice/audio files
- [ ] Verify `publicUrl` is stored in message content
- [ ] Confirm Supabase `messages` table accepts `expires_at` and deletes expired rows
