import { createClient } from 'https://cdn.jsdelivr.net/npm/@supabase/supabase-js/+esm';
import { SUPABASE_URL, SUPABASE_ANON_KEY, ROOM_KEY } from './supabase.js';

const LOCAL_STORAGE_KEY = 'hidden-notes-notes';
const DEVICE_ID_KEY = 'hidden-notes-device-id';
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
  },
  {
    id: 'msg-2',
    type: 'message',
    side: 'outgoing',
    text: 'Nice. The notes view looks ready, and the unlock works too.',
    reaction: '❤️ 1',
  },
  {
    id: 'msg-3',
    type: 'message',
    side: 'incoming',
    text: 'Perfect. We can add the real-time sync next.',
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
const sendMessageButton = document.getElementById('sendMessageButton');
const chatBackButton = document.getElementById('chatBackButton');
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
const deviceId = getDeviceId();

function getDeviceId() {
  let id = localStorage.getItem(DEVICE_ID_KEY);
  if (!id) {
    id = crypto.randomUUID();
    localStorage.setItem(DEVICE_ID_KEY, id);
  }
  return id;
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

  return {
    id: row.id,
    type: row.type || 'text',
    side: row.sender === deviceId ? 'outgoing' : 'incoming',
    text: row.type === 'text' ? parsedContent : '',
    content: parsedContent,
    reaction: row.reactions && Array.isArray(row.reactions) ? row.reactions[0] : undefined,
    replyTo: row.reply_to,
    createdAt: row.created_at,
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
  replyTargetName.textContent = 'Sam';
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
      // If this is audio and we don't yet have a duration, probe it first
      if (pendingAttachment.type.startsWith('audio/') && !pendingAttachment.duration) {
        const seconds = await getBlobDuration(pendingAttachment.file);
        pendingAttachment.duration = seconds ? formatDuration(seconds) : undefined;
        attachmentData.duration = pendingAttachment.duration || undefined;
      }
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
  };

  if (replyToMessageId) {
    newMessage.replyTo = replyToMessageId;
  }

  messages.push(newMessage);
  renderChatMessages();
  composerInput.value = '';
  clearAttachment();
  clearReplyPreview();

  if (!supabase) return;

  const insertPayload = {
    room: payload.room,
    sender: payload.sender,
    type: payload.type,
    content: payload.content,
    reply_to: payload.reply_to,
  };

  console.log('Inserting chat message', insertPayload);
  const { data: insertData, error } = await supabase.from('messages').insert([insertPayload]);

  if (error) {
    console.error('Supabase insert error', error);
  } else {
    console.log('Supabase insert succeeded', insertData);
  }
}

async function toggleReaction(messageId) {
  const message = messages.find((item) => item.id === messageId);
  if (!message || !supabase) return;

  const existing = Array.isArray(message.reactions) ? message.reactions : message.reaction ? [message.reaction] : [];
  const hasLiked = existing.includes('Liked') || existing.includes('❤️');
  const updated = hasLiked ? [] : ['Liked'];

  const { error } = await supabase.from('messages').update({ reactions: updated }).eq('id', messageId);
  if (error) {
    console.error('Supabase reaction error', error);
    return;
  }

  message.reaction = updated[0];
  renderChatMessages();
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
    .on(
      'postgres_changes',
      { event: '*', schema: 'public', table: 'messages', filter: `room=eq.${ROOM_KEY}` },
      async (payload) => {
        console.log('Realtime payload', payload);
        if (payload.new || payload.old) {
          await fetchChatHistory();
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

    if (message.replyTo) {
      const original = messages.find((item) => item.id === message.replyTo);
      const replyLabel = document.createElement('div');
      replyLabel.className = 'chat-reply-preview';
      replyLabel.textContent = original ? `↩ replying to ${original.type === 'text' || original.type === 'message' ? original.text : original.type}` : '↩ replying';
      wrapper.appendChild(replyLabel);
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
        audioEl.src = contentUrl;
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
    reactionButton.addEventListener('click', () => toggleReaction(message.id));
    actions.appendChild(reactionButton);

    bubble.appendChild(actions);

    if (message.reaction) {
      const reaction = document.createElement('span');
      reaction.className = 'reaction';
      reaction.textContent = message.reaction;
      bubble.appendChild(reaction);
    }

    wrapper.appendChild(bubble);
    chatMessages.appendChild(wrapper);
  });
  chatMessages.scrollTop = chatMessages.scrollHeight;
}

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

function setView(viewName) {
  view = viewName;
  document.getElementById('notesScreen').classList.toggle('hidden', view !== 'notes');
  chatScreen.classList.toggle('hidden', view !== 'chat');
  if (view === 'notes') {
    searchInput.value = '';
    renderNotes();
    stopChatPolling();
  } else {
    renderChatMessages();
    if (supabase && !realtimeChannel) {
      subscribeToChat();
    }
    fetchChatHistory();
    startChatPolling();
  }
}

function handleSecretOpen() {
  setView('chat');
}

searchInput.addEventListener('input', renderNotes);

searchForm.addEventListener('submit', (event) => {
  event.preventDefault();
  if (searchInput.value.trim() === '##open') {
    handleSecretOpen();
    return;
  }
  renderNotes();
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
  if (event.key === 'Enter') {
    event.preventDefault();
    if (isRecording && recorder) {
      try { recorder.requestData(); } catch (e) { console.warn('requestData failed', e); }
      recorder.stop();
      await new Promise((resolve) => (recordingStopResolver = resolve));
      await addChatMessage(composerInput.value);
      return;
    }
    await addChatMessage(composerInput.value);
  }
});

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
