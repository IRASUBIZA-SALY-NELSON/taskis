'use client';

import React, { useCallback, useEffect, useRef, useState } from 'react';
import { Phone, PhoneOff, Video, VideoOff, Mic, MicOff, SwitchCamera } from 'lucide-react';
import { Room, RoomEvent, Track, VideoPresets, AudioPresets, type RemoteTrack } from 'livekit-client';
import { apiUrl } from '@/lib/api';
import { subscribe } from '@/lib/ws';
import { playRing } from '@/lib/calls';

// 1-to-1 voice and video calls. The server rings the other person over the live connection; the audio
// and video themselves go through LiveKit.

type Phase = 'incoming' | 'calling' | 'connecting' | 'active';
interface CallState {
  callId: string;
  channel: string;
  video: boolean;
  phase: Phase;
  peer: string;
  peerName: string;
  url?: string;
  token?: string;
}

const authHeaders = () => ({ Authorization: `Bearer ${localStorage.getItem('token')}`, 'Content-Type': 'application/json' });
const post = (path: string, body?: unknown) =>
  fetch(apiUrl(path), { method: 'POST', headers: authHeaders(), body: body === undefined ? undefined : JSON.stringify(body) });

const fmt = (s: number) => `${Math.floor(s / 60)}:${String(s % 60).padStart(2, '0')}`;

export default function CallManager() {
  const [call, setCall] = useState<CallState | null>(null);
  const [notice, setNotice] = useState('');
  const [micOn, setMicOn] = useState(true);
  const [camOn, setCamOn] = useState(true);
  const [seconds, setSeconds] = useState(0);
  const [mirror, setMirror] = useState(true); // front camera is shown mirrored, like a mirror

  const callRef = useRef<CallState | null>(null);
  const roomRef = useRef<Room | null>(null);
  const remoteVideo = useRef<HTMLVideoElement>(null);
  const localVideo = useRef<HTMLVideoElement>(null);
  const audioEls = useRef<HTMLElement[]>([]);
  const stopRing = useRef<(() => void) | null>(null);
  const facing = useRef<'user' | 'environment'>('user');

  const update = useCallback((c: CallState | null) => { callRef.current = c; setCall(c); }, []);

  const stopSound = () => { stopRing.current?.(); stopRing.current = null; };

  const cleanup = useCallback((message = '') => {
    stopSound();
    audioEls.current.forEach((el) => el.remove());
    audioEls.current = [];
    roomRef.current?.disconnect();
    roomRef.current = null;
    update(null);
    setSeconds(0);
    setMicOn(true);
    setCamOn(true);
    facing.current = 'user';
    setMirror(true);
    if (message) { setNotice(message); setTimeout(() => setNotice(''), 2500); }
  }, [update]);

  // ---- LiveKit ----
  const connect = useCallback(async (c: CallState) => {
    if (!c.url || !c.token) return;
    const room = new Room({
      adaptiveStream: true,
      dynacast: true,
      videoCaptureDefaults: { resolution: VideoPresets.h720.resolution, facingMode: 'user' },
      audioCaptureDefaults: { echoCancellation: true, noiseSuppression: true, autoGainControl: true },
      publishDefaults: { videoEncoding: { maxBitrate: 2_500_000, maxFramerate: 30 }, simulcast: true, dtx: true, red: true, audioPreset: AudioPresets.speech },
    });
    roomRef.current = room;

    const goActive = () => {
      const cur = callRef.current;
      if (cur && cur.phase !== 'active') { stopSound(); update({ ...cur, phase: 'active' }); }
    };
    room
      .on(RoomEvent.TrackSubscribed, (track: RemoteTrack) => {
        if (track.kind === Track.Kind.Video && remoteVideo.current) track.attach(remoteVideo.current);
        else if (track.kind === Track.Kind.Audio) {
          const el = track.attach();
          el.style.display = 'none';
          document.body.appendChild(el);
          audioEls.current.push(el);
        }
        goActive();
      })
      .on(RoomEvent.ParticipantConnected, goActive)
      .on(RoomEvent.ParticipantDisconnected, () => {
        const cur = callRef.current;
        if (cur) { post(`/api/calls/${cur.callId}/end`).catch(() => {}); cleanup('Call ended'); }
      })
      .on(RoomEvent.Disconnected, () => { if (callRef.current && roomRef.current === room) cleanup('Call ended'); });

    try {
      await room.connect(c.url, c.token);
      await room.localParticipant.setMicrophoneEnabled(true);
      if (c.video) {
        await room.localParticipant.setCameraEnabled(true);
        const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
        if (pub?.videoTrack && localVideo.current) pub.videoTrack.attach(localVideo.current);
      }
      if (room.remoteParticipants.size > 0) goActive();
    } catch (e) {
      const msg = e instanceof Error && /permission|denied|NotAllowed/i.test(e.message)
        ? 'Allow the microphone' + (c.video ? ' and camera' : '') + ' to make calls.'
        : 'Could not connect the call.';
      post(`/api/calls/${c.callId}/end`).catch(() => {});
      cleanup(msg);
    }
  }, [cleanup, update]);

  // ---- starting, answering, ending ----
  const start = useCallback(async (channel: string, video: boolean) => {
    if (callRef.current) return;
    try {
      const res = await post('/api/calls/start', { channel, video });
      if (!res.ok) { setNotice(res.status === 409 ? 'They are on another call.' : await res.text() || 'Could not start the call.'); setTimeout(() => setNotice(''), 2500); return; }
      const d = await res.json();
      const c: CallState = { callId: d.callId, channel, video, phase: 'calling', peer: d.peer, peerName: d.peerName, url: d.url, token: d.token };
      update(c);
      stopRing.current = playRing('outgoing');
      connect(c);
    } catch { setNotice('Could not start the call.'); setTimeout(() => setNotice(''), 2500); }
  }, [connect, update]);

  const accept = async () => {
    const c = callRef.current;
    if (!c) return;
    stopSound();
    const res = await post(`/api/calls/${c.callId}/accept`);
    if (!res.ok) { cleanup('The call ended.'); return; }
    const d = await res.json();
    const next: CallState = { ...c, phase: 'connecting', url: d.url, token: d.token };
    update(next);
    connect(next);
  };

  const decline = async () => {
    const c = callRef.current;
    if (!c) return;
    post(`/api/calls/${c.callId}/decline`).catch(() => {});
    cleanup();
  };

  const hangUp = () => {
    const c = callRef.current;
    if (!c) return;
    post(`/api/calls/${c.callId}/end`).catch(() => {});
    cleanup();
  };

  // ---- signals from the server ----
  useEffect(() => {
    const showIncoming = (d: { callId: string; channel: string; video: boolean; from: string; fromName: string }) => {
      if (callRef.current) {
        if (callRef.current.callId !== d.callId) post(`/api/calls/${d.callId}/decline`).catch(() => {}); // already on a call
        return;
      }
      update({ callId: d.callId, channel: d.channel, video: d.video, phase: 'incoming', peer: d.from, peerName: d.fromName });
      stopRing.current = playRing('incoming');
    };

    const off = subscribe('/user/queue/calls', (m: { type: string; callId: string }) => {
      const cur = callRef.current;
      if (m.type === 'incoming') return showIncoming(m as never);
      if (!cur || cur.callId !== m.callId) return;
      if (m.type === 'accepted') { stopSound(); update({ ...cur, phase: 'connecting' }); }
      else if (m.type === 'declined') cleanup('Declined');
      else if (m.type === 'cancelled') cleanup('Missed call');
      else if (m.type === 'missed') cleanup(cur.phase === 'calling' ? 'No answer' : 'Missed call');
      else if (m.type === 'ended') cleanup('Call ended');
    });

    // Opened the app from a ring notification: the call may already be ringing.
    const checkPending = () => {
      if (callRef.current) return;
      fetch(apiUrl('/api/calls/pending'), { headers: authHeaders() })
        .then((r) => (r.ok ? r.json() : null))
        .then((d: { callId: string; channel: string; video: boolean; from: string; fromName: string } | null) => { if (d?.callId) showIncoming(d); })
        .catch(() => {});
    };
    checkPending();
    const onVisible = () => { if (document.visibilityState === 'visible') checkPending(); };
    document.addEventListener('visibilitychange', onVisible);

    const onStart = (e: Event) => { const d = (e as CustomEvent).detail; if (d?.channel) start(d.channel, !!d.video); };
    window.addEventListener('start-call', onStart);

    return () => { off(); document.removeEventListener('visibilitychange', onVisible); window.removeEventListener('start-call', onStart); };
  }, [cleanup, start, update]);

  // call timer
  useEffect(() => {
    if (call?.phase !== 'active') return;
    const t = setInterval(() => setSeconds((s) => s + 1), 1000);
    return () => clearInterval(t);
  }, [call?.phase]);

  // leaving the page ends the call cleanly
  useEffect(() => {
    const onUnload = () => { const c = callRef.current; if (c) navigator.sendBeacon?.(apiUrl(`/api/calls/${c.callId}/end`)); };
    window.addEventListener('pagehide', onUnload);
    return () => window.removeEventListener('pagehide', onUnload);
  }, []);

  // ---- controls ----
  const toggleMic = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isMicrophoneEnabled;
    await room.localParticipant.setMicrophoneEnabled(next);
    setMicOn(next);
  };
  const toggleCam = async () => {
    const room = roomRef.current;
    if (!room) return;
    const next = !room.localParticipant.isCameraEnabled;
    await room.localParticipant.setCameraEnabled(next);
    setCamOn(next);
    if (next) {
      const pub = room.localParticipant.getTrackPublication(Track.Source.Camera);
      if (pub?.videoTrack && localVideo.current) pub.videoTrack.attach(localVideo.current);
    }
  };
  const flipCamera = async () => {
    const room = roomRef.current;
    const track = room?.localParticipant.getTrackPublication(Track.Source.Camera)?.videoTrack;
    if (!track) return;
    facing.current = facing.current === 'user' ? 'environment' : 'user';
    setMirror(facing.current === 'user');
    try { await track.restartTrack({ facingMode: facing.current }); } catch { /* single-camera device */ }
  };

  if (!call && !notice) return null;

  const initial = (call?.peerName || '?').slice(0, 1).toUpperCase();
  const status = !call ? '' : call.phase === 'incoming' ? (call.video ? 'Incoming video call' : 'Incoming voice call')
    : call.phase === 'calling' ? 'Calling…' : call.phase === 'connecting' ? 'Connecting…' : fmt(seconds);
  const round = 'w-14 h-14 rounded-full grid place-items-center text-white border-0 cursor-pointer transition-transform active:scale-95';

  return (
    <>
      {notice && !call && (
        <div className="fixed left-1/2 -translate-x-1/2 top-5 z-[600] px-4 py-2.5 rounded-xl text-[13.5px] font-medium text-white" style={{ background: 'rgba(20,20,24,0.92)' }}>{notice}</div>
      )}
      {call && (
        <div className="fixed inset-0 z-[600] flex flex-col text-white select-none" style={{ background: '#0b0b0e' }} role="dialog" aria-label="Call">
          {call.video && call.phase !== 'incoming' && (
            <video ref={remoteVideo} autoPlay playsInline className="absolute inset-0 w-full h-full object-cover" />
          )}
          {/* peer + status */}
          <div className="relative z-10 flex flex-col items-center pt-[max(3rem,env(safe-area-inset-top))] px-6 text-center">
            {(!call.video || call.phase !== 'active') && (
              <div className="w-24 h-24 rounded-full grid place-items-center text-4xl font-semibold mb-4" style={{ background: 'rgba(255,255,255,0.12)' }}>{initial}</div>
            )}
            <div className="text-[22px] font-semibold drop-shadow">{call.peerName}</div>
            <div className="text-[14px] opacity-80 mt-1 drop-shadow">{status}</div>
          </div>

          <div className="flex-1" />

          {/* my camera */}
          {call.video && call.phase !== 'incoming' && camOn && (
            <video ref={localVideo} autoPlay playsInline muted
              className="absolute z-10 right-4 bottom-32 w-[110px] h-[150px] sm:w-[160px] sm:h-[210px] object-cover rounded-2xl border border-white/20 bg-black"
              style={{ transform: mirror ? 'scaleX(-1)' : undefined }} />
          )}

          {/* controls */}
          <div className="relative z-10 flex items-center justify-center gap-5 pb-[max(2.5rem,env(safe-area-inset-bottom))] pt-6">
            {call.phase === 'incoming' ? (
              <>
                <button onClick={decline} className={round} style={{ background: '#e5484d', width: 64, height: 64 }} aria-label="Decline"><PhoneOff className="w-7 h-7" /></button>
                <button onClick={accept} className={round} style={{ background: '#30a46c', width: 64, height: 64 }} aria-label="Accept">
                  {call.video ? <Video className="w-7 h-7" /> : <Phone className="w-7 h-7" />}
                </button>
              </>
            ) : (
              <>
                <button onClick={toggleMic} className={round} style={{ background: micOn ? 'rgba(255,255,255,0.16)' : '#fff', color: micOn ? '#fff' : '#111' }} aria-label={micOn ? 'Mute' : 'Unmute'}>
                  {micOn ? <Mic className="w-6 h-6" /> : <MicOff className="w-6 h-6" />}
                </button>
                {call.video && (
                  <>
                    <button onClick={toggleCam} className={round} style={{ background: camOn ? 'rgba(255,255,255,0.16)' : '#fff', color: camOn ? '#fff' : '#111' }} aria-label={camOn ? 'Turn camera off' : 'Turn camera on'}>
                      {camOn ? <Video className="w-6 h-6" /> : <VideoOff className="w-6 h-6" />}
                    </button>
                    <button onClick={flipCamera} className={round} style={{ background: 'rgba(255,255,255,0.16)' }} aria-label="Switch camera"><SwitchCamera className="w-6 h-6" /></button>
                  </>
                )}
                <button onClick={hangUp} className={round} style={{ background: '#e5484d', width: 64, height: 64 }} aria-label="End call"><PhoneOff className="w-7 h-7" /></button>
              </>
            )}
          </div>
        </div>
      )}
    </>
  );
}
