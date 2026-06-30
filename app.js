import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, ROOM_KEY } from './supabase.js';

const LOCAL_STORAGE_KEY = 'hidden-notes-notes';
const DEVICE_ID_KEY = 'hidden-notes-device-id';
const USER_NAME_KEY = 'chat-user-name';
const KNOWN_NAMES_KEY = 'chat-known-names';
const NOTE_COLORS = ['yellow', 'blue', 'taupe', 'rose'];
const defaultNotes = [
  {
    id: crypto.randomUUID(),
    title: 'Weekend travel ideas',
    body: 'Research flights, pack list, and route details for the cabin trip.',
    tag: 'Personal',
    color: 'yellow',
    updatedAt: Date.now(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Project milestones',
    body: 'Finalize brief, design review, and launch checklist by Friday.',
    tag: 'Work',
    color: 'blue',
    updatedAt: Date.now(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Grocery list',
    body: '• Bread\n• Almond milk\n• Eggs\n• Mushrooms\n• Honey',
    tag: 'Lists',
    color: 'taupe',
    updatedAt: Date.now(),
  },
  {
    id: crypto.randomUUID(),
    title: 'Gift ideas',
    body: 'Small candles, a warm scarf, and a notebook for writing.',
    tag: 'Personal',
    color: 'rose',
    updatedAt: Date.now(),
  },
];

const sampleMessages = [
  { id: 'sep-1', type: 'separator', label: 'TODAY' },
  {
    id: 'msg-1',
    type: 'message',
    side: 'incoming',
    text: 'Hey, I found the hidden app. This is the private chat now.',
    senderName: 'Sam',
  },
  {
    id: 'msg-2',
    type: 'message',
    side: 'outgoing',
    text: 'Nice. The notes view looks ready, and the unlock works too.',
    reaction: '❤️ 1',
    senderName: 'Me',
  },
  {
    id: 'msg-3',
    type: 'message',
    side: 'incoming',
    text: 'Perfect. We can add the real-time sync next.',
    senderName: 'Sam',
  },
];

const notesGrid = document.getElementById('notesGrid');
const searchInput = document.getElementById('searchInput');
const searchForm = document.getElementById('searchForm');
const filterChips = document.getElementById('filterChips');
const createNoteButton = document.getElementById('createNoteButton');
const noteModalOverlay = document.getElementById('noteModalOverlay');
const noteForm = document.getElementById('noteForm');
const noteTitle = document.getElementById('noteTitle');
const noteBody = document.getElementById('noteBody');
const noteTag = document.getElementById('noteTag');
const closeModalButton = document.getElementById('closeModalButton');
const cancelNoteButton = document.getElementById('cancelNoteButton');
const logoButton = document.getElementById('logoButton');
const chatScreen = document.getElementById('chatScreen');
const chatMessages = document.getElementById('chatMessages');
const composerInput = document.getElementById('composerInput');
const searchActionButton = document.querySelector('#searchForm button[type="submit"]');
const sendMessageButton = document.getElementById('sendMessageButton');
const chatBackButton = document.getElementById('chatBackButton');
const chatStatusEl = document.querySelector('.chat-status');
const encryptionToggle = document.getElementById('encryptionToggle');
const themeToggle = document.getElementById('themeToggle');
const replyPreview = document.getElementById('replyPreview');
const replyTargetName = document.getElementById('replyTargetName');
const replySnippet = document.getElementById('replySnippet');
const cancelReplyButton = document.getElementById('cancelReplyButton');
const attachButton = document.getElementById('attachButton');
const recordButton = document.getElementById('recordButton');
const attachmentInput = document.getElementById('attachmentInput');
const attachmentPreview = document.getElementById('attachmentPreview');

let notes = [];
let activeFilter = 'All';
let editingNoteId = null;
let logoTapCount = 0;
let logoTapTimer = null;
let view = 'notes';
let messages = sampleMessages.slice();
let lastShakeTime = 0;
let replyToMessageId = null;
let pendingAttachment = null;
let isRecording = false;
let recorder = null;
let audioChunks = [];
let recordTimer = null;
let recordStartTime = null;
let recordingStopResolver = null;
let supabase = null;
let realtimeChannel = null;
let pollTimer = null;
let typingTimeout = null;
let typingSent = false;
const readers = {}; // messageId -> Set of reader deviceIds
const reactionsPicker = ['👍','❤️','😂','😮','😢','👎'];
let encryptionEnabled = false;
let sessionPassphrase = null;
let myName = localStorage.getItem(USER_NAME_KEY) || null;
let knownNames = {};
try { knownNames = JSON.parse(localStorage.getItem(KNOWN_NAMES_KEY) || '{}'); } catch (e) { knownNames = {}; }
let pendingExpiry = null; // seconds
let scheduledSendAt = null; // timestamp ms
const themes = ['messenger','dark','compact'];
let currentTheme = localStorage.getItem('theme') || 'messenger';
document.body.dataset.theme = currentTheme;

if (themeToggle) themeToggle.addEventListener('click', () => {
  const next = themes[(themes.indexOf(currentTheme) + 1) % themes.length];
  currentTheme = next;
  document.body.dataset.theme = currentTheme;
  localStorage.setItem('theme', currentTheme);
});
const deviceId = getDeviceId();
const STORAGE_BUCKET = 'attachments'; // ensure this bucket exists in your Supabase project

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
}

async function deleteMessage(messageId) {
  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return;
  if (!confirm('Delete this message?')) return;
  try {
    if (supabase) {
      const { error } = await supabase.from('messages').delete().eq('id', messageId);
      if (error) console.error('Delete message error', error);
    }
  } catch (e) {
    console.error('deleteMessage failed', e);
  }
  messages = messages.filter((m) => m.id !== messageId);
  renderChatMessages();
}

async function editMessage(messageId) {
  const msg = messages.find((m) => m.id === messageId);
  if (!msg) return;
  if (msg.type !== 'message' && msg.type !== 'text') {
    alert('Only text messages can be edited');
    return;
  }
  const newText = prompt('Edit message', msg.text || '');
  if (newText == null) return;
  try {
    if (supabase) {
      const { error } = await supabase.from('messages').update({ content: newText }).eq('id', messageId);
      if (error) console.error('Edit message error', error);
    }
  } catch (e) {
    console.error('editMessage failed', e);
  }
  msg.text = newText;
  renderChatMessages();
}

function isSupabaseConfigured() {
  return !SUPABASE_URL.includes('YOUR_PROJECT') && !SUPABASE_ANON_KEY.includes('YOUR_ANON_KEY');
}

async function initializeSupabase() {
  if (!isSupabaseConfigured()) {
    console.warn('Supabase is not configured. Live chat disabled.');
    return;
  }
  console.log('Initializing Supabase', { SUPABASE_URL, ROOM_KEY });
  supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);
  requestNotificationPermission();
  await fetchChatHistory();
  await subscribeToChat();
}

async function ensureNoOldServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  try {
    const registrations = await navigator.serviceWorker.getRegistrations();
    for (const registration of registrations) {
      await registration.unregister();
      console.log('Unregistered old service worker', registration);
    }
  } catch (error) {
    console.warn('Service worker cleanup failed', error);
  }
}

function normalizeMessageRow(row) {
  let parsedContent = row.content;
  if (row.type && row.type !== 'text') {
    try {
      parsedContent = JSON.parse(row.content);
    } catch (error) {
      parsedContent = row.content;
    }
  }
  const senderId = row.sender;
  const storedName = row.sender_name || null;
  if (storedName && senderId !== deviceId) saveKnownName(senderId, storedName);
  return {
    id: row.id,
    type: row.type || 'text',
    side: senderId === deviceId ? 'outgoing' : 'incoming',
    text: row.type === 'text' ? parsedContent : '',
    content: parsedContent,
    reaction: row.reactions && Array.isArray(row.reactions) ? row.reactions[0] : undefined,
    replyTo: row.reply_to,
    createdAt: row.created_at,
    senderName: getSenderName(senderId, storedName),
    senderId,
  };
}

function getReplySnippet(message) {
  if (!message.replyTo) return null;
  const original = messages.find((item) => item.id === message.replyTo);
  if (!original) return null;
  if (original.type === 'text') return original.text;
  if (original.type === 'image') return 'Image';
  if (original.type === 'audio') return 'Voice message';
  if (original.type === 'file') return original.content?.name || 'Attachment';
  return 'Shared content';
}

function showReplyPreview(message) {
  replyToMessageId = message.id;
  replyTargetName.textContent = message.senderName || (message.side === 'outgoing' ? myName || 'You' : 'Them');
  replySnippet.textContent = getReplySnippet(message) || '';
  replyPreview.classList.remove('hidden');
}

function clearReplyPreview() {
  replyToMessageId = null;
  replyPreview.classList.add('hidden');
  replySnippet.textContent = '';
}

function renderAttachmentPreview() {
  if (!pendingAttachment) {
    attachmentPreview.classList.add('hidden');
    attachmentPreview.innerHTML = '';
    return;
  }

  attachmentPreview.classList.remove('hidden');
  const file = pendingAttachment;
  attachmentPreview.innerHTML = '';

  const previewTag = document.createElement('div');
  previewTag.className = 'attachment-preview-tag';

  if (file.type.startsWith('image/')) {
    const image = document.createElement('img');
    image.src = file.url;
    image.alt = file.name;
    image.className = 'attachment-image-preview';
    attachmentPreview.appendChild(image);
  }

  const info = document.createElement('div');
  info.className = 'attachment-info';
  info.innerHTML = `<strong>${escapeText(file.name)}</strong><span>${file.type}</span>`;
  previewTag.appendChild(info);
  attachmentPreview.appendChild(previewTag);
}

function clearAttachment() {
  pendingAttachment = null;
  attachmentInput.value = '';
  renderAttachmentPreview();
}

async function encodeBlobAsDataUrl(blob) {
  return await new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(reader.result);
    reader.onerror = reject;
    reader.readAsDataURL(blob);
  });
}

async function uploadBlobToStorage(blob, destPath, contentType) {
  if (!supabase) throw new Error('Supabase not initialized');
  try {
    console.log('Uploading to storage', destPath, 'type', contentType);
    const options = { upsert: true };
    if (contentType) options.contentType = contentType;
    const { data, error } = await supabase.storage.from(STORAGE_BUCKET).upload(destPath, blob, options);
    if (error) {
      console.error('Storage upload error', error);
      throw error;
    }
    // get public URL
    const urlData = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(destPath);
    const publicUrl = (urlData && (urlData.publicUrl || urlData.publicURL)) || null;
    console.log('Uploaded to storage publicUrl', publicUrl);
    return { path: destPath, publicUrl };
  } catch (err) {
    console.error('uploadBlobToStorage failed', err);
    throw err;
  }
}

function formatDuration(seconds) {
  const minutes = Math.floor(seconds / 60);
  const rest = Math.floor(seconds % 60);
  return `${minutes}:${rest.toString().padStart(2, '0')}`;
}

async function getBlobDuration(blob) {
  // Prefer decoding via AudioContext for accurate duration
  try {
    const arrayBuffer = await blob.arrayBuffer();
    const AudioCtx = window.AudioContext || window.webkitAudioContext;
    if (!AudioCtx) throw new Error('No AudioContext');
    const ac = new AudioCtx();
    const audioBuffer = await new Promise((resolve, reject) => {
      ac.decodeAudioData(arrayBuffer.slice(0), resolve, reject);
    });
    const duration = audioBuffer.duration || 0;
    try { ac.close && ac.close(); } catch (e) { /* ignore */ }
    return duration;
  } catch (err) {
    // Fallback to metadata on audio element
    return await new Promise((resolve) => {
      const url = URL.createObjectURL(blob);
      const audio = document.createElement('audio');
      audio.src = url;
      audio.addEventListener('loadedmetadata', () => {
        const d = audio.duration || 0;
        URL.revokeObjectURL(url);
        resolve(d);
      });
      // safety: if metadata never fires, resolve after 5s with 0
      setTimeout(() => resolve(0), 5000);
    });
  }
}

async function handleFileSelection(event) {
  const file = event.target.files?.[0];
  if (!file) return;

  const objectUrl = URL.createObjectURL(file);
  pendingAttachment = {
    name: file.name,
    type: file.type,
    file,
    url: objectUrl,
  };
  renderAttachmentPreview();
}

async function addChatMessage(text) {
  const trimmed = text.trim();
  if (!trimmed && !pendingAttachment) return;

  const payload = {
    room: ROOM_KEY,
    sender: deviceId,
    sender_name: myName || 'Me',
    type: 'text',
    content: trimmed,
    reply_to: replyToMessageId,
  };

  let attachmentData = null;

  if (pendingAttachment) {
    payload.type = pendingAttachment.type.startsWith('image/')
      ? 'image'
      : pendingAttachment.type.startsWith('audio/')
      ? 'audio'
      : 'file';

    attachmentData = {
      name: pendingAttachment.name,
      url: pendingAttachment.url,
      type: pendingAttachment.type,
      duration: pendingAttachment.duration || undefined,
    };

    if (pendingAttachment.file) {
      let fileToUpload = pendingAttachment.file;
      let encryptedMeta = null;

      // If this is audio and we don't yet have a duration, probe it first
      if (pendingAttachment.type.startsWith('audio/') && !pendingAttachment.duration) {
        const seconds = await getBlobDuration(pendingAttachment.file);
        pendingAttachment.duration = seconds ? formatDuration(seconds) : undefined;
        attachmentData.duration = pendingAttachment.duration || undefined;
      }

      // If image, compress before encoding
      if (pendingAttachment.type.startsWith('image/')) {
        try {
          pendingAttachment.file = await compressImageFile(pendingAttachment.file, 1280, 0.8);
          const objUrl = URL.createObjectURL(pendingAttachment.file);
          pendingAttachment.url = objUrl;
          fileToUpload = pendingAttachment.file;
        } catch (e) {
          console.warn('image compression failed', e);
        }
      }

      try {
        if (sessionPassphrase && pendingAttachment.file) {
          const arrayBuf = await pendingAttachment.file.arrayBuffer();
          const enc = await encryptArrayBufferWithPassword(arrayBuf, sessionPassphrase);
          fileToUpload = new Blob([base64ToArrayBuffer(enc.data)], { type: pendingAttachment.type });
          encryptedMeta = { iv: enc.iv, salt: enc.salt };
        }

        const filename = `${crypto.randomUUID()}-${pendingAttachment.name.replace(/[^a-zA-Z0-9.\-_]/g, '_')}`;
        const path = `${ROOM_KEY}/${filename}`;
        const { publicUrl, path: storagePath } = await uploadBlobToStorage(fileToUpload, path, pendingAttachment.type);
        if (publicUrl) {
          attachmentData.url = publicUrl;
          attachmentData.storage_path = storagePath;
          if (encryptedMeta) attachmentData.encrypted = encryptedMeta;
        } else {
          const dataUrl = await encodeBlobAsDataUrl(pendingAttachment.file);
          attachmentData.url = dataUrl;
        }
      } catch (err) {
        console.warn('Attachment upload failed; falling back to data URL', err);
        const dataUrl = await encodeBlobAsDataUrl(pendingAttachment.file);
        attachmentData.url = dataUrl;
      }
    } else {
      const dataUrl = await encodeBlobAsDataUrl(pendingAttachment.file);
      attachmentData.url = dataUrl;
    }

    payload.content = JSON.stringify(attachmentData);

    if (!trimmed) {
      payload.content = JSON.stringify(attachmentData);
    }
  }

  const newMessage = {
    id: crypto.randomUUID(),
    type: payload.type === 'text' ? 'message' : payload.type,
    side: 'outgoing',
    text: payload.type === 'text' ? trimmed : '',
    content: payload.type === 'text' ? trimmed : attachmentData || JSON.parse(payload.content),
    reaction: undefined,
    replyTo: payload.reply_to,
    senderName: myName || 'Me',
    senderId: deviceId,
  };

  if (replyToMessageId) {
    newMessage.replyTo = replyToMessageId;
  }

  messages.push(newMessage);
  renderChatMessages();
  composerInput.value = '';
  clearAttachment();
  clearReplyPreview();

  // If encryption enabled, encrypt text payload content
  if (encryptionEnabled && sessionPassphrase && payload.type === 'text' && payload.content) {
    try {
      const enc = await encryptStringWithPassword(payload.content, sessionPassphrase);
      payload.content = JSON.stringify({ encrypted: true, data: enc.data, iv: enc.iv, salt: enc.salt });
      payload.type = 'text';
    } catch (e) {
      console.warn('encrypt text failed', e);
    }
  }

  if (!supabase) return;

  const insertPayload = {
    room: payload.room,
    sender: payload.sender,
    sender_name: payload.sender_name,
    type: payload.type,
    content: payload.content,
    reply_to: payload.reply_to,
  };

  // handle self-destruct expiry
  if (pendingExpiry) {
    const expiresAt = new Date(Date.now() + pendingExpiry * 1000).toISOString();
    insertPayload.expires_at = expiresAt;
  }

  console.log('Inserting chat message', insertPayload);
  const { data: insertData, error } = await supabase.from('messages').insert([insertPayload]).select();

  if (error) {
    console.error('Supabase insert error', error);
  } else {
    console.log('Supabase insert succeeded', insertData);
    try {
      const inserted = Array.isArray(insertData) ? insertData[0] : insertData;
      if (inserted) {
        // Replace temp UUID with real DB id so the realtime echo is recognised and skipped
        const tempMsg = messages.find(m => m.id === newMessage.id);
        if (tempMsg) tempMsg.id = inserted.id;

        if (inserted.expires_at) {
          const until = new Date(inserted.expires_at).getTime() - Date.now();
          if (until > 0) {
            setTimeout(async () => {
              try {
                await supabase.from('messages').delete().eq('id', inserted.id);
                messages = messages.filter(m => m.id !== inserted.id);
                renderChatMessages();
              } catch (e) { console.warn('auto-delete failed', e); }
            }, until);
          }
        }
      }
    } catch (e) { console.warn('post-insert expiry handling failed', e); }
  }
  pendingExpiry = null;
}

async function toggleReaction(messageId) {
  const message = messages.find((item) => item.id === messageId);
  if (!message || !supabase) return;
  // legacy toggle without explicit emoji
  const existing = Array.isArray(message.reactions) ? message.reactions : message.reaction ? [message.reaction] : [];
  const updated = existing.length ? [] : ['Liked'];
  const { error } = await supabase.from('messages').update({ reactions: updated }).eq('id', messageId);
  if (error) {
    console.error('Supabase reaction error', error);
    return;
  }
  message.reaction = updated[0];
  renderChatMessages();
}

async function setReaction(messageId, emoji) {
  const message = messages.find((m) => m.id === messageId);
  if (!message || !supabase) return;
  const updated = emoji ? [emoji] : [];
  const { error } = await supabase.from('messages').update({ reactions: updated }).eq('id', messageId);
  if (error) {
    console.error('Supabase setReaction error', error);
    return;
  }
  message.reaction = updated[0];
  renderChatMessages();
}

function showReactionPicker(messageId, anchorEl) {
  // remove existing picker
  const existing = document.querySelector('.reaction-picker');
  if (existing) existing.remove();
  const picker = document.createElement('div');
  picker.className = 'reaction-picker';
  reactionsPicker.forEach((emoji) => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'reaction-emoji';
    btn.textContent = emoji;
    btn.addEventListener('click', () => {
      setReaction(messageId, emoji);
      picker.remove();
    });
    picker.appendChild(btn);
  });
  const rect = anchorEl.getBoundingClientRect();
  picker.style.position = 'absolute';
  picker.style.left = `${rect.left}px`;
  picker.style.top = `${rect.top - 44}px`;
  document.body.appendChild(picker);
  setTimeout(() => document.addEventListener('click', removePickerOnce));

  function removePickerOnce(e) {
    if (!picker.contains(e.target) && e.target !== anchorEl) picker.remove();
    document.removeEventListener('click', removePickerOnce);
  }
}

async function handleAudioRecording() {
  if (isRecording) {
    try {
      // request final data chunk then stop to ensure complete capture
      recorder.requestData();
    } catch (e) {
      console.warn('requestData() failed', e);
    }
    recorder.stop();
    return;
  }

  if (!navigator.mediaDevices || !navigator.mediaDevices.getUserMedia) {
    return;
  }

  try {
    const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    recorder = new MediaRecorder(stream);
    audioChunks = [];

    recorder.addEventListener('dataavailable', (event) => {
      if (event.data.size > 0) {
        audioChunks.push(event.data);
        console.log('chunk received', audioChunks.length, 'bytes', event.data.size, 'type', event.data.type);
      }
    });

    recorder.addEventListener('start', () => {
      console.log('recorder started');
      recordStartTime = Date.now();
    });

    recorder.addEventListener('pause', () => console.log('recorder paused'));
    recorder.addEventListener('resume', () => console.log('recorder resumed'));

    recorder.addEventListener('error', (e) => console.error('recorder error', e));

    recorder.addEventListener('stop', async () => {
      const chunkType = (audioChunks[0] && audioChunks[0].type) || 'audio/webm';
      const totalBytes = audioChunks.reduce((s, c) => s + (c.size || 0), 0);
      console.log('recording stopped — chunks:', audioChunks.length, 'totalBytes:', totalBytes, 'chunkType:', chunkType);
      const blob = new Blob(audioChunks, { type: chunkType });
      // Probe full duration and create data URL preview
      const seconds = await getBlobDuration(blob).catch((e) => {
        console.warn('getBlobDuration failed', e);
        return 0;
      });
      const duration = seconds ? formatDuration(seconds) : undefined;
      const url = URL.createObjectURL(blob);
      pendingAttachment = {
        name: 'Voice message.webm',
        type: blob.type,
        file: blob,
        url,
        duration,
      };
      console.log('Recorded blob size:', blob.size, 'duration seconds:', seconds);
      renderAttachmentPreview();
      if (typeof recordingStopResolver === 'function') {
        recordingStopResolver();
        recordingStopResolver = null;
      }
      // safety fallback: ensure UI updated even if metadata doesn't fire
      setTimeout(() => {
        if (!pendingAttachment) {
          pendingAttachment = {
            name: 'Voice message.webm',
            type: blob.type,
            file: blob,
            url,
            duration: undefined,
          };
          console.warn('loadedmetadata did not fire; using fallback pendingAttachment');
          renderAttachmentPreview();
          if (typeof recordingStopResolver === 'function') {
            recordingStopResolver();
            recordingStopResolver = null;
          }
        }
      }, 1200);
      isRecording = false;
      stopRecordingUI();
    });

    // Start with 1s timeslice to ensure chunks are emitted frequently
    try {
      recorder.start(1000);
    } catch (err) {
      recorder.start();
    }
    isRecording = true;
    startRecordingUI();
  } catch (error) {
    console.error('Recording failed', error);
  }
}

function startRecordingUI() {
  if (!recordButton) return;
  recordStartTime = Date.now();
  recordButton.classList.add('recording');
  const el = document.getElementById('recordTimer');
  if (!el) return;
  el.classList.remove('hidden');
  el.textContent = '00:00';
  if (recordTimer) clearInterval(recordTimer);
  recordTimer = setInterval(() => {
    const elapsed = Math.floor((Date.now() - recordStartTime) / 1000);
    const minutes = Math.floor(elapsed / 60).toString().padStart(2, '0');
    const seconds = (elapsed % 60).toString().padStart(2, '0');
    el.textContent = `${minutes}:${seconds}`;
  }, 250);
}

function stopRecordingUI() {
  if (!recordButton) return;
  recordButton.classList.remove('recording');
  const el = document.getElementById('recordTimer');
  if (el) {
    el.classList.add('hidden');
    el.textContent = '';
  }
  if (recordTimer) {
    clearInterval(recordTimer);
    recordTimer = null;
  }
  recordStartTime = null;
}

async function handleSend() {
  await addChatMessage(composerInput.value);
}

function startChatPolling() {
  if (pollTimer) return;
  pollTimer = setInterval(() => {
    if (view === 'chat') {
      fetchChatHistory();
    }
  }, 2500);
}

function stopChatPolling() {
  if (!pollTimer) return;
  clearInterval(pollTimer);
  pollTimer = null;
}

async function fetchChatHistory() {
  if (!supabase) return;
  const { data, error } = await supabase
    .from('messages')
    .select('*')
    .eq('room', ROOM_KEY)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('Supabase fetch error', error);
    return;
  }

  console.log('Fetched chat history', data);
  messages = [{ id: 'sep-1', type: 'separator', label: 'TODAY' }, ...data.map(normalizeMessageRow)];
  renderChatMessages();
}

function requestNotificationPermission() {
  if (!('Notification' in window)) return;
  if (Notification.permission === 'default') Notification.requestPermission().then((p) => console.log('Notification permission', p));
}

function showDesktopNotification(title, body, icon) {
  if (!('Notification' in window) || Notification.permission !== 'granted') return;
  try {
    const n = new Notification(title, { body, icon });
    setTimeout(() => n.close(), 5000);
  } catch (e) {
    console.warn('showDesktopNotification failed', e);
  }
}

async function subscribeToChat() {
  if (!supabase) return;

  if (realtimeChannel) {
    try {
      await realtimeChannel.unsubscribe();
    } catch (error) {
      console.warn('Realtime unsubscribe failed', error);
    }
    realtimeChannel = null;
  }

  realtimeChannel = supabase
    .channel('room-messages')
    .on('broadcast', { event: 'name' }, (payload) => {
      try {
        const p = payload.payload || payload;
        if (p && p.deviceId && p.name && p.deviceId !== deviceId) {
          saveKnownName(p.deviceId, p.name);
          updateChatHeader();
          renderChatMessages();
        }
      } catch (e) {
        console.warn('name broadcast error', e, payload);
      }
    })
    .on('broadcast', { event: 'typing' }, (payload) => {
      try {
        const p = payload.payload || payload;
        if (!p || p.sender === deviceId) return;
        if (p.typing) {
          if (chatStatusEl) chatStatusEl.textContent = 'typing...';
        } else {
          if (chatStatusEl) chatStatusEl.textContent = 'active now';
        }
      } catch (e) {
        console.warn('typing payload error', e, payload);
      }
    })
    .on('broadcast', { event: 'read' }, (payload) => {
      try {
        const p = payload.payload || payload;
        if (!p || p.reader === deviceId) return;
        const ids = Array.isArray(p.messageIds) ? p.messageIds : [p.messageId].filter(Boolean);
        ids.forEach((id) => {
          if (!readers[id]) readers[id] = new Set();
          readers[id].add(p.reader);
        });
        renderChatMessages();
      } catch (e) {
        console.warn('read payload error', e, payload);
      }
    })
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `room=eq.${ROOM_KEY}` },
      (payload) => {
        const eventType = payload.eventType; // 'INSERT' | 'UPDATE' | 'DELETE'
        if (eventType === 'INSERT' && payload.new) {
          const row = payload.new;
          // Show desktop notification for incoming messages
          try {
            if (row.sender && row.sender !== deviceId) {
              const title = 'Hidden chat';
              let body = row.type === 'text' ? (row.content?.substring?.(0, 120) || 'New message')
                       : row.type === 'audio' ? 'Voice message'
                       : row.type === 'image' ? 'Image attachment'
                       : 'New message';
              if (!document.hasFocus()) showDesktopNotification(title, body);
            }
          } catch (e) { console.warn('notify failed', e); }
          // Skip echo of our own messages (id already updated to real DB id after insert)
          if (messages.some(m => m.id === row.id)) return;
          messages.push(normalizeMessageRow(row));
          renderChatMessages();
        } else if (eventType === 'UPDATE' && payload.new) {
          const idx = messages.findIndex(m => m.id === payload.new.id);
          if (idx >= 0) {
            messages[idx] = normalizeMessageRow(payload.new);
            renderChatMessages();
          }
        } else if (eventType === 'DELETE') {
          const oldId = payload.old?.id;
          if (oldId) {
            messages = messages.filter(m => m.id !== oldId);
            renderChatMessages();
          }
        }
      }
    );

  console.log('Subscribing to realtime channel', realtimeChannel);
  const { error } = await realtimeChannel.subscribe();
  if (error) {
    console.error('Realtime subscribe error', error);
    realtimeChannel = null;
    return;
  }
  console.log('Realtime subscribed', realtimeChannel.state);
}


function loadNotes() {
  try {
    const stored = localStorage.getItem(LOCAL_STORAGE_KEY);
    notes = stored ? JSON.parse(stored) : [];
  } catch (error) {
    notes = [];
  }
  if (!notes.length) {
    notes = defaultNotes.slice();
    saveNotes();
  }
}

function saveNotes() {
  localStorage.setItem(LOCAL_STORAGE_KEY, JSON.stringify(notes));
}

function getFilteredNotes() {
  const searchTerm = searchInput.value.trim().toLowerCase();
  return notes.filter((note) => {
    const matchesFilter = activeFilter === 'All' || note.tag === activeFilter;
    const matchesSearch =
      note.title.toLowerCase().includes(searchTerm) || note.body.toLowerCase().includes(searchTerm);
    return matchesFilter && matchesSearch;
  });
}

function renderNotes() {
  notesGrid.innerHTML = '';
  const visibleNotes = getFilteredNotes();
  if (!visibleNotes.length) {
    notesGrid.innerHTML = '<p class="empty-state">No notes match your search.</p>';
    return;
  }

  visibleNotes.forEach((note) => {
    const card = document.createElement('article');
    card.className = 'note-card';
    card.dataset.color = note.color || 'yellow';
    card.dataset.id = note.id;
    card.innerHTML = `
      <div>
        <h3 class="note-title">${escapeText(note.title)}</h3>
        <p class="note-body">${escapeText(note.body)}</p>
      </div>
      <div class="note-footer">
        <span class="note-tag">${escapeText(note.tag)}</span>
        <button class="note-delete" aria-label="Delete note">×</button>
      </div>
    `;

    card.addEventListener('click', (event) => {
      if (event.target.closest('.note-delete')) return;
      openEditor(note.id);
    });

    const deleteButton = card.querySelector('.note-delete');
    deleteButton.addEventListener('click', (event) => {
      event.stopPropagation();
      deleteNote(note.id);
    });

    notesGrid.appendChild(card);
  });
}

function renderChatMessages() {
  chatMessages.innerHTML = '';
  messages.forEach((message) => {
    if (message.type === 'separator') {
      const separator = document.createElement('div');
      separator.className = 'message-separator';
      separator.textContent = message.label;
      chatMessages.appendChild(separator);
      return;
    }

    const wrapper = document.createElement('div');
    wrapper.className = `chat-message ${message.side}`;

    // For incoming: avatar + body column (name label → reply → bubble)
    // For outgoing: reply → bubble (right-aligned, no avatar)
    let bubbleContainer = wrapper;

    if (message.side === 'incoming') {
      const avatar = document.createElement('div');
      avatar.className = 'message-avatar';
      avatar.textContent = getInitials(message.senderName);
      wrapper.appendChild(avatar);

      const body = document.createElement('div');
      body.className = 'message-body';

      const nameEl = document.createElement('div');
      nameEl.className = 'message-sender-name';
      nameEl.textContent = message.senderName || 'Them';
      body.appendChild(nameEl);

      if (message.replyTo) {
        const original = messages.find((item) => item.id === message.replyTo);
        const replyLabel = document.createElement('div');
        replyLabel.className = 'chat-reply-preview';
        replyLabel.textContent = original ? `↩ replying to ${original.type === 'text' || original.type === 'message' ? original.text : original.type}` : '↩ replying';
        body.appendChild(replyLabel);
      }

      wrapper.appendChild(body);
      bubbleContainer = body;
    } else {
      if (message.replyTo) {
        const original = messages.find((item) => item.id === message.replyTo);
        const replyLabel = document.createElement('div');
        replyLabel.className = 'chat-reply-preview';
        replyLabel.textContent = original ? `↩ replying to ${original.type === 'text' || original.type === 'message' ? original.text : original.type}` : '↩ replying';
        wrapper.appendChild(replyLabel);
      }
    }

    const bubble = document.createElement('div');
    bubble.className = `chat-bubble ${message.side}`;

    if (message.type === 'text' || message.type === 'message') {
      bubble.innerHTML = `<span>${escapeText(message.text)}</span>`;
    } else if (message.type === 'image' && message.content?.url && !message.content.url.startsWith('blob:')) {
      bubble.innerHTML = `<img class="chat-image" src="${escapeText(message.content.url)}" alt="${escapeText(message.content.name || 'Image')}" />`;
      if (message.content.name) {
        bubble.insertAdjacentHTML('beforeend', `<div class="chat-attachment-label">${escapeText(message.content.name)}</div>`);
      }
    } else if (message.type === 'audio' && message.content?.url) {
      // Render audio. If the URL is a data: URI, convert to a Blob URL for more reliable playback across devices.
      const audioEl = document.createElement('audio');
      audioEl.controls = true;
      const contentUrl = message.content.url;
      const contentType = message.content.type || '';
      if (contentUrl.startsWith('data:')) {
        try {
          const blob = dataUrlToBlob(contentUrl);
          const blobUrl = URL.createObjectURL(blob);
          audioEl.src = blobUrl;
          console.log('receiver created blobUrl', message.id, 'blobBytes', blob.size, 'type', blob.type);
          audioEl.addEventListener('loadedmetadata', () => {
            console.log('receiver loadedmetadata', message.id, 'duration', audioEl.duration, 'blobBytes', blob.size, 'type', blob.type);
          });
          const support = audioEl.canPlayType(contentType || blob.type || 'audio/webm');
          console.log('receiver canPlayType', message.id, contentType || blob.type, support);
          if (!support) {
            console.warn('receiver cannot play this MIME type, adding download fallback', message.id);
            const link = document.createElement('a');
            link.href = blobUrl;
            link.download = message.content?.name || 'voice-message.webm';
            link.textContent = 'Download audio (play locally)';
            link.className = 'download-fallback';
            bubble.appendChild(link);
          }
          audioEl.addEventListener('error', (e) => console.error('audio playback error (receiver)', message.id, e));
          // Revoke blob URL when element is removed later (not handled here) — small memory tradeoff
        } catch (e) {
          console.warn('dataUrlToBlob failed, falling back to data URI', e);
          audioEl.src = contentUrl;
        }
      } else {
        // normal http(s) or already blob: URL
        if (message.content.encrypted && sessionPassphrase) {
          // fetch encrypted bytes, decrypt and play
          fetch(contentUrl)
            .then((r) => r.arrayBuffer())
            .then(async (buf) => {
              try {
                const plain = await decryptArrayBufferWithPassword(buf, message.content.encrypted.iv, message.content.encrypted.salt, sessionPassphrase);
                const blob = new Blob([plain], { type: message.content.type || 'audio/webm' });
                const blobUrl = URL.createObjectURL(blob);
                audioEl.src = blobUrl;
              } catch (e) {
                console.error('decrypt failed for attachment', e);
                audioEl.src = contentUrl; // fallback
              }
            })
            .catch((e) => {
              console.error('fetch encrypted attachment failed', e);
              audioEl.src = contentUrl;
            });
        } else {
          audioEl.src = contentUrl;
        }
        audioEl.addEventListener('loadedmetadata', () => {
          console.log('receiver loadedmetadata', message.id, 'duration', audioEl.duration);
        });
        const support = audioEl.canPlayType(contentType || 'audio/webm');
        console.log('receiver canPlayType', message.id, contentType || 'audio/webm', support);
        if (!support) {
          console.warn('receiver cannot play this MIME type for URL', message.id);
          const link = document.createElement('a');
          link.href = contentUrl;
          link.download = message.content?.name || 'voice-message.webm';
          link.textContent = 'Download audio (play locally)';
          link.className = 'download-fallback';
          bubble.appendChild(link);
        }
        audioEl.addEventListener('error', (e) => console.error('audio playback error (receiver)', message.id, e));
      }
      bubble.appendChild(audioEl);
      if (message.content.duration) {
        bubble.insertAdjacentHTML('beforeend', `<div class="chat-attachment-label">${escapeText(message.content.duration)}</div>`);
      }
    } else if (message.type === 'file') {
      bubble.innerHTML = `<div class="chat-file"><span>${escapeText(message.content?.name || message.text || 'Attachment')}</span></div>`;
    } else {
      bubble.innerHTML = `<span>${escapeText(message.text || 'Unsupported message')}</span>`;
    }

    const actions = document.createElement('div');
    actions.className = 'message-actions';

    const replyButton = document.createElement('button');
    replyButton.type = 'button';
    replyButton.className = 'reaction-toggle';
    replyButton.textContent = '↩';
    replyButton.addEventListener('click', () => showReplyPreview(message));
    actions.appendChild(replyButton);

    const reactionButton = document.createElement('button');
    reactionButton.type = 'button';
    reactionButton.className = 'reaction-toggle';
    reactionButton.textContent = message.reaction || '⋯';
    reactionButton.addEventListener('click', (e) => showReactionPicker(message.id, e.currentTarget));
    actions.appendChild(reactionButton);

    const editButton = document.createElement('button');
    editButton.type = 'button';
    editButton.className = 'reaction-toggle';
    editButton.textContent = 'Edit';
    editButton.addEventListener('click', () => editMessage(message.id));
    actions.appendChild(editButton);

    const deleteButtonMsg = document.createElement('button');
    deleteButtonMsg.type = 'button';
    deleteButtonMsg.className = 'reaction-toggle';
    deleteButtonMsg.textContent = 'Delete';
    deleteButtonMsg.addEventListener('click', () => deleteMessage(message.id));
    actions.appendChild(deleteButtonMsg);

    bubble.appendChild(actions);

    // Long press to show/hide action bar
    let pressTimer = null;
    bubble.addEventListener('touchstart', (e) => {
      pressTimer = setTimeout(() => {
        document.querySelectorAll('.bubble.show-actions').forEach(b => b !== bubble && b.classList.remove('show-actions'));
        bubble.classList.toggle('show-actions');
      }, 450);
    }, { passive: true });
    bubble.addEventListener('touchend', () => clearTimeout(pressTimer));
    bubble.addEventListener('touchmove', () => clearTimeout(pressTimer));
    bubble.addEventListener('contextmenu', (e) => {
      e.preventDefault();
      document.querySelectorAll('.bubble.show-actions').forEach(b => b !== bubble && b.classList.remove('show-actions'));
      bubble.classList.toggle('show-actions');
    });

    if (message.reaction) {
      const reaction = document.createElement('span');
      reaction.className = 'reaction';
      reaction.textContent = message.reaction;
      bubble.appendChild(reaction);
    }

    // Read receipts indicator for outgoing messages
    if (message.side === 'outgoing') {
      const readersSet = readers[message.id] || new Set();
      const readersArr = Array.from(readersSet);
      if (readersArr.length) {
        const readEl = document.createElement('div');
        readEl.className = 'message-read';
        const readerNames = readersArr.map((id) => knownNames[id] || 'Them');
        readEl.textContent = `Read by ${readerNames.join(', ')}`;
        bubble.appendChild(readEl);
      }
    }

    bubbleContainer.appendChild(bubble);
    chatMessages.appendChild(wrapper);
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
  // send read receipts for visible incoming messages
  sendReadReceipts();
}

function sendReadReceipts() {
  if (!realtimeChannel) return;
  const visible = messages.filter((m) => m.side === 'incoming' && !((readers[m.id] || new Set()).has(deviceId)) );
  if (!visible.length) return;
  const messageIds = visible.map((m) => m.id);
  try {
    realtimeChannel.send({ type: 'broadcast', event: 'read', payload: { reader: deviceId, messageIds } });
    messageIds.forEach((id) => {
      if (!readers[id]) readers[id] = new Set();
      readers[id].add(deviceId);
    });
    renderChatMessages();
  } catch (e) {
    console.warn('sendReadReceipts failed', e);
  }
}

function utf8ToBase64(str) { return btoa(unescape(encodeURIComponent(str))); }
function base64ToUtf8(b64) { return decodeURIComponent(escape(atob(b64))); }

async function deriveKeyFromPassword(password, salt) {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey('raw', enc.encode(password), 'PBKDF2', false, ['deriveKey']);
  const key = await crypto.subtle.deriveKey({ name: 'PBKDF2', salt: salt, iterations: 250000, hash: 'SHA-256' }, keyMaterial, { name: 'AES-GCM', length: 256 }, false, ['encrypt','decrypt']);
  return key;
}

async function encryptStringWithPassword(plain, password) {
  const enc = new TextEncoder();
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassword(password, salt.buffer);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, enc.encode(plain));
  return { data: arrayBufferToBase64(cipher), iv: arrayBufferToBase64(iv), salt: arrayBufferToBase64(salt) };
}

async function decryptStringWithPassword(encB64, ivB64, saltB64, password) {
  const dec = new TextDecoder();
  const salt = base64ToArrayBuffer(saltB64);
  const iv = base64ToArrayBuffer(ivB64);
  const data = base64ToArrayBuffer(encB64);
  const key = await deriveKeyFromPassword(password, salt);
  const plainBuf = await crypto.subtle.decrypt({ name: 'AES-GCM', iv }, key, data);
  return dec.decode(plainBuf);
}

function arrayBufferToBase64(buffer) {
  const bytes = new Uint8Array(buffer);
  let binary = '';
  for (let i = 0; i < bytes.byteLength; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64) {
  const binary = atob(b64);
  const len = binary.length;
  const bytes = new Uint8Array(len);
  for (let i = 0; i < len; i++) bytes[i] = binary.charCodeAt(i);
  return bytes.buffer;
}

async function encryptArrayBufferWithPassword(arrayBuffer, password) {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const iv = crypto.getRandomValues(new Uint8Array(12));
  const key = await deriveKeyFromPassword(password, salt.buffer);
  const cipher = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, arrayBuffer);
  return { data: arrayBufferToBase64(cipher), iv: arrayBufferToBase64(iv), salt: arrayBufferToBase64(salt) };
}

async function decryptArrayBufferWithPassword(arrayBuffer, ivB64, saltB64, password) {
  const iv = base64ToArrayBuffer(ivB64);
  const salt = base64ToArrayBuffer(saltB64);
  const key = await deriveKeyFromPassword(password, salt);
  const plain = await crypto.subtle.decrypt({ name: 'AES-GCM', iv: new Uint8Array(iv) }, key, arrayBuffer);
  return plain;
}

encryptionToggle && encryptionToggle.addEventListener('click', async () => {
  if (!encryptionEnabled) {
    const pass = prompt('Enter passphrase for end-to-end encryption (session only)');
    if (!pass) return;
    sessionPassphrase = pass;
    encryptionEnabled = true;
    encryptionToggle.textContent = '🔓';
  } else {
    encryptionEnabled = false;
    sessionPassphrase = null;
    encryptionToggle.textContent = '🔒';
  }
});

function dataUrlToBlob(dataUrl) {
  const parts = dataUrl.split(',');
  const meta = parts[0] || '';
  const base64 = parts[1] || '';
  const isBase64 = meta.indexOf(';base64') !== -1;
  const mimeMatch = meta.match(/data:([^;]+)/);
  const mime = (mimeMatch && mimeMatch[1]) || 'application/octet-stream';
  if (!isBase64) {
    // percent-encoded
    const bytes = decodeURIComponent(base64);
    const arr = new Uint8Array(bytes.length);
    for (let i = 0; i < bytes.length; i++) arr[i] = bytes.charCodeAt(i);
    return new Blob([arr], { type: mime });
  }
  const binary = atob(base64);
  const len = binary.length;
  const buffer = new Uint8Array(len);
  for (let i = 0; i < len; i++) buffer[i] = binary.charCodeAt(i);
  return new Blob([buffer], { type: mime });
}

async function compressImageFile(file, maxWidth = 1280, quality = 0.8) {
  if (!file.type.startsWith('image/')) return file;
  const bitmap = await createImageBitmap(file);
  const ratio = Math.min(1, maxWidth / bitmap.width);
  const width = Math.round(bitmap.width * ratio);
  const height = Math.round(bitmap.height * ratio);
  const canvas = document.createElement('canvas');
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext('2d');
  ctx.drawImage(bitmap, 0, 0, width, height);
  return await new Promise((resolve) => canvas.toBlob((b) => resolve(b), 'image/jpeg', quality));
}
function escapeText(value) {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/\n/g, '<br>');
}

function openEditor(noteId = null) {
  editingNoteId = noteId;
  const note = notes.find((item) => item.id === noteId);
  noteTitle.value = note?.title || '';
  noteBody.value = note?.body || '';
  noteTag.value = note?.tag || 'Personal';
  noteModalOverlay.classList.remove('hidden');
  noteTitle.focus();
}

function closeEditor() {
  editingNoteId = null;
  noteModalOverlay.classList.add('hidden');
  noteForm.reset();
}

function deleteNote(noteId) {
  notes = notes.filter((note) => note.id !== noteId);
  saveNotes();
  renderNotes();
}

function selectFilter(filter) {
  activeFilter = filter;
  filterChips.querySelectorAll('.chip').forEach((chip) => {
    chip.classList.toggle('active', chip.dataset.filter === filter);
  });
  renderNotes();
}

function assignColorForTag(tag) {
  if (tag === 'Personal') return 'yellow';
  if (tag === 'Work') return 'blue';
  if (tag === 'Lists') return 'taupe';
  return NOTE_COLORS[Math.floor(Math.random() * NOTE_COLORS.length)];
}

function getInitials(name) {
  if (!name) return '?';
  return name.trim().split(/\s+/).map((w) => w[0]).join('').toUpperCase().slice(0, 2);
}

function getSenderName(senderId, storedName) {
  if (senderId === deviceId) return myName || 'Me';
  return storedName || knownNames[senderId] || 'Them';
}

function saveKnownName(senderId, name) {
  if (!name || senderId === deviceId) return;
  knownNames[senderId] = name;
  try { localStorage.setItem(KNOWN_NAMES_KEY, JSON.stringify(knownNames)); } catch (e) {}
}

function updateChatHeader() {
  const others = Object.entries(knownNames).filter(([id]) => id !== deviceId);
  const otherName = others.length ? others[0][1] : null;
  const chatNameEl = document.querySelector('.chat-name');
  const chatAvatarEl = document.querySelector('.chat-avatar');
  if (chatNameEl) chatNameEl.textContent = otherName || 'Chat';
  if (chatAvatarEl) chatAvatarEl.textContent = getInitials(otherName || 'Chat');
}

function broadcastMyName() {
  if (!realtimeChannel || !myName) return;
  try {
    realtimeChannel.send({ type: 'broadcast', event: 'name', payload: { deviceId, name: myName } });
  } catch (e) {
    console.warn('broadcastMyName failed', e);
  }
}

async function setView(viewName) {
  if (viewName === 'chat' && !myName) {
    const name = await showPinDialog('What should we call you in this chat?', {
      inputType: 'text',
      placeholder: 'Your name',
    });
    myName = (name || '').trim() || 'Me';
    localStorage.setItem(USER_NAME_KEY, myName);
  }
  view = viewName;
  document.getElementById('notesScreen').classList.toggle('hidden', view !== 'notes');
  chatScreen.classList.toggle('hidden', view !== 'chat');
  if (view === 'notes') {
    searchInput.value = '';
    renderNotes();
    stopChatPolling();
  } else {
    renderChatMessages();
    updateChatHeader();
    if (supabase && !realtimeChannel) {
      await subscribeToChat();
    }
    broadcastMyName();
    fetchChatHistory();
    startChatPolling();
  }
}

function showPinDialog(message, { inputType = 'password', placeholder = 'PIN (leave blank to skip)' } = {}) {
  return new Promise((resolve) => {
    const overlay = document.getElementById('pinOverlay');
    const input = document.getElementById('pinInput');
    const msg = document.getElementById('pinMessage');
    const cancelBtn = document.getElementById('pinCancelButton');
    const confirmBtn = document.getElementById('pinConfirmButton');

    msg.textContent = message;
    input.type = inputType;
    input.placeholder = placeholder;
    input.value = '';
    overlay.classList.remove('hidden');
    setTimeout(() => input.focus(), 50);

    function done(value) {
      overlay.classList.add('hidden');
      cancelBtn.removeEventListener('click', onCancel);
      confirmBtn.removeEventListener('click', onConfirm);
      input.removeEventListener('keydown', onKey);
      resolve(value);
    }
    function onCancel() { done(null); }
    function onConfirm() { done(input.value.trim() || null); }
    function onKey(e) { if (e.key === 'Enter') done(input.value.trim() || null); }

    cancelBtn.addEventListener('click', onCancel);
    confirmBtn.addEventListener('click', onConfirm);
    input.addEventListener('keydown', onKey);
  });
}

async function handleSecretOpen() {
  setView('chat');
}


async function tryHandleSecretSearch(value, event) {
  const normalized = value.trim().toLowerCase();
  if (normalized === '##open' || normalized.includes('##open')) {
    if (event) event.preventDefault();
    await handleSecretOpen();
    return true;
  }
  return false;
}

searchInput.addEventListener('input', renderNotes);

searchForm.addEventListener('submit', async (event) => {
  const value = searchInput.value;
  if (await tryHandleSecretSearch(value, event)) return;
  event.preventDefault();
  renderNotes();
});

if (searchActionButton) {
  searchActionButton.addEventListener('click', async (event) => {
    if (await tryHandleSecretSearch(searchInput.value, event)) return;
  });
}

searchInput.addEventListener('keydown', async (event) => {
  if (event.key === 'Enter') {
    if (await tryHandleSecretSearch(searchInput.value, event)) return;
  }
});



filterChips.addEventListener('click', (event) => {
  const chip = event.target.closest('.chip');
  if (!chip) return;
  selectFilter(chip.dataset.filter);
});

createNoteButton.addEventListener('click', () => openEditor());
closeModalButton.addEventListener('click', closeEditor);
cancelNoteButton.addEventListener('click', closeEditor);

noteForm.addEventListener('submit', (event) => {
  event.preventDefault();
  const title = noteTitle.value.trim();
  const body = noteBody.value.trim();
  const tag = noteTag.value;
  if (!title && !body) return;

  if (editingNoteId) {
    notes = notes.map((note) =>
      note.id === editingNoteId
        ? { ...note, title, body, tag, color: assignColorForTag(tag), updatedAt: Date.now() }
        : note
    );
  } else {
    notes.unshift({
      id: crypto.randomUUID(),
      title,
      body,
      tag,
      color: assignColorForTag(tag),
      updatedAt: Date.now(),
    });
  }

  saveNotes();
  renderNotes();
  closeEditor();
});

logoButton.addEventListener('click', () => {
  logoTapCount += 1;
  clearTimeout(logoTapTimer);
  logoTapTimer = setTimeout(() => {
    logoTapCount = 0;
  }, 800);

  if (logoTapCount >= 5) {
    logoTapCount = 0;
    handleSecretOpen();
  }
});

chatBackButton.addEventListener('click', () => setView('notes'));
sendMessageButton.addEventListener('click', async () => {
  if (isRecording && recorder) {
    try { recorder.requestData(); } catch (e) { console.warn('requestData failed', e); }
    recorder.stop();
    await new Promise((resolve) => (recordingStopResolver = resolve));
    await addChatMessage(composerInput.value);
    return;
  }
  await addChatMessage(composerInput.value);
});

composerInput.addEventListener('keydown', async (event) => {
  if (event.key !== 'Enter') return;
  event.preventDefault();

  const trimmed = composerInput.value.trim();

  if (trimmed.startsWith('/expire ')) {
    const parts = trimmed.split(' ');
    const secs = parseInt(parts[1], 10);
    if (!isNaN(secs) && secs > 0) {
      pendingExpiry = secs;
      alert('Next message will expire in ' + secs + ' seconds');
      composerInput.value = '';
      return;
    }
  } else if (trimmed.startsWith('/sendat ')) {
    const when = trimmed.substring(8).trim();
    const ts = Date.parse(when);
    if (!isNaN(ts)) {
      scheduledSendAt = ts;
      const delay = ts - Date.now();
      if (delay <= 0) {
        alert('Time is in the past');
        return;
      }
      setTimeout(async () => {
        await addChatMessage(composerInput.value || '(scheduled)');
        scheduledSendAt = null;
      }, delay);
      alert('Message scheduled for ' + new Date(ts).toLocaleString());
      composerInput.value = '';
      return;
    }
  } else if (trimmed === '/clear-schedule') {
    scheduledSendAt = null;
    pendingExpiry = null;
    alert('Cleared schedule and expiry');
    composerInput.value = '';
    return;
  }

  if (isRecording && recorder) {
    try { recorder.requestData(); } catch (e) { console.warn('requestData failed', e); }
    recorder.stop();
    await new Promise((resolve) => (recordingStopResolver = resolve));
    await addChatMessage(composerInput.value);
    return;
  }

  await addChatMessage(composerInput.value);
});

// Typing indicators: send typing broadcast when user types
composerInput.addEventListener('input', () => {
  if (!realtimeChannel) return;
  if (!typingSent) {
    try {
      realtimeChannel.send({ type: 'broadcast', event: 'typing', payload: { sender: deviceId, typing: true } });
      typingSent = true;
    } catch (e) {
      console.warn('typing send failed', e);
    }
  }
  if (typingTimeout) clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    try {
      realtimeChannel.send({ type: 'broadcast', event: 'typing', payload: { sender: deviceId, typing: false } });
    } catch (e) {
      console.warn('typing clear send failed', e);
    }
    typingSent = false;
  }, 1500);
});

document.addEventListener('touchstart', (e) => {
  if (!e.target.closest('.bubble')) {
    document.querySelectorAll('.bubble.show-actions').forEach(b => b.classList.remove('show-actions'));
  }
}, { passive: true });

attachButton.addEventListener('click', () => attachmentInput.click());
attachmentInput.addEventListener('change', handleFileSelection);
cancelReplyButton.addEventListener('click', clearReplyPreview);
recordButton.addEventListener('click', handleAudioRecording);

window.addEventListener('devicemotion', (event) => {
  const accel = event.accelerationIncludingGravity || event.acceleration;
  if (!accel) return;
  const magnitude = Math.sqrt((accel.x || 0) ** 2 + (accel.y || 0) ** 2 + (accel.z || 0) ** 2);
  const now = Date.now();
  if (magnitude > 18 && now - lastShakeTime > 800) {
    lastShakeTime = now;
    handleSecretOpen();
  }
});

// Service worker registration removed to prevent stale cached app shell on GitHub Pages.

loadNotes();
renderNotes();
ensureNoOldServiceWorker().then(() => initializeSupabase());
