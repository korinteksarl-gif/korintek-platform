import { useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';

// Écran public de salle d'attente — aucune authentification requise (lecture seule).
// Deux types d'annonces sonores distincts :
//   1. Appel en salle d'examen — carillon 4 notes façon aéroport + voix
//   2. Formalités d'admission (T-15min) — carillon 3 notes montantes + voix "montez
//      avec vos effets personnels" + bandeau visuel temporaire en haut de l'écran.
// Panneau publicitaire configurable (gauche/droite) : ajouter ?ads=left à l'URL.
// Bandeau d'information déroulant en bas d'écran (heure, slogan, statistiques du jour).

const SOUND_PREF_KEY = 'korintek_display_sound_unlocked';

// Carillon façon annonce d'aéroport — motif "ding-dong, ding-dong" descendant en
// 4 notes, immédiatement reconnaissable et conçu pour capter l'attention avant
// l'annonce vocale de l'appel en salle d'examen.
function playChime(audioCtx) {
  const notes = [
    { freq: 783.99, start: 0, duration: 0.28 },     // Sol5 — "ding"
    { freq: 659.25, start: 0.26, duration: 0.4 },   // Mi5 — "dong"
    { freq: 783.99, start: 0.75, duration: 0.28 },  // Sol5 — "ding"
    { freq: 523.25, start: 1.01, duration: 0.55 },  // Do5 — "dong" (plus long, final)
  ];
  notes.forEach(({ freq, start, duration }) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'sine';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const t0 = audioCtx.currentTime + start;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.4, t0 + 0.04);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  });
}

function playAdmissionChime(audioCtx) {
  const notes = [
    { freq: 392.0, start: 0, duration: 0.22 },
    { freq: 523.25, start: 0.2, duration: 0.22 },
    { freq: 659.25, start: 0.4, duration: 0.4 },
  ];
  notes.forEach(({ freq, start, duration }) => {
    const osc = audioCtx.createOscillator();
    const gain = audioCtx.createGain();
    osc.type = 'triangle';
    osc.frequency.value = freq;
    osc.connect(gain);
    gain.connect(audioCtx.destination);
    const t0 = audioCtx.currentTime + start;
    gain.gain.setValueAtTime(0, t0);
    gain.gain.linearRampToValueAtTime(0.3, t0 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  });
}

function speakAnnouncement(text) {
  if (!('speechSynthesis' in window)) return;
  window.speechSynthesis.cancel();
  const utterance = new SpeechSynthesisUtterance(text);
  utterance.lang = 'fr-FR';
  utterance.rate = 0.95;
  const voices = window.speechSynthesis.getVoices();
  const frenchVoice = voices.find((v) => v.lang === 'fr-FR') || voices.find((v) => v.lang?.startsWith('fr'));
  if (frenchVoice) utterance.voice = frenchVoice;
  window.speechSynthesis.speak(utterance);
}

function AdPanel({ ads }) {
  const [index, setIndex] = useState(0);

  useEffect(() => {
    if (ads.length < 2) return;
    const t = setInterval(() => setIndex((i) => (i + 1) % ads.length), 8000);
    return () => clearInterval(t);
  }, [ads.length]);

  if (!ads.length) {
    return (
      <div className="h-full flex flex-col items-center justify-center gap-4 bg-[#062028] border-l border-white/5">
        <img src="/logo-korintek.png" alt="KORINTEK" width={56} height={56} className="opacity-40" />
        <p className="text-white/20 text-xs uppercase tracking-[0.25em]">Certifications Change Lives</p>
      </div>
    );
  }

  const ad = ads[index];
  const isVideo = ad.imageData?.startsWith('data:video');
  const content = isVideo ? (
    <video
      key={ad.id}
      src={ad.imageData}
      className="w-full h-full object-cover"
      autoPlay
      muted
      loop
      playsInline
    />
  ) : (
    <img src={ad.imageData} alt={ad.title || 'Publicité'} className="w-full h-full object-cover" />
  );

  return (
    <div className="h-full relative overflow-hidden bg-black">
      {ad.linkUrl ? (
        <a href={ad.linkUrl} target="_blank" rel="noreferrer" className="block h-full">{content}</a>
      ) : content}
      {ads.length > 1 && (
        <div className="absolute bottom-4 left-0 right-0 flex justify-center gap-1.5">
          {ads.map((_, i) => (
            <span
              key={i}
              className={`h-1.5 rounded-full transition-all ${i === index ? 'w-6 bg-korintek-teal' : 'w-1.5 bg-white/30'}`}
            />
          ))}
        </div>
      )}
    </div>
  );
}

// Bandeau d'information défilant — heure en direct, slogan, statistiques du jour.
// Le contenu est dupliqué une fois pour permettre une boucle de défilement continue
// sans saut visible (animation CSS translateX(-50%) sur un contenu répété x2).
function InfoTicker({ stats }) {
  const [clock, setClock] = useState('');

  useEffect(() => {
    function updateClock() {
      setClock(
        new Date().toLocaleString('fr-FR', {
          weekday: 'long', day: '2-digit', month: 'long', hour: '2-digit', minute: '2-digit',
        })
      );
    }
    updateClock();
    const t = setInterval(updateClock, 1000);
    return () => clearInterval(t);
  }, []);

  const items = [
    `🕐 ${clock}`,
    'KORINTEK — Certifications Change Lives',
    stats ? `👥 ${stats.waiting + stats.admission} candidat(s) en attente aujourd'hui` : null,
    stats ? `✅ ${stats.completed} examen(s) terminé(s) aujourd'hui` : null,
    'Merci de patienter, votre tour sera annoncé à l\'écran',
  ].filter(Boolean);

  const content = items.join('     •     ') + '     •     ';

  return (
    <div className="h-11 bg-[#062028] border-t border-white/10 flex items-center overflow-hidden">
      <div className="ticker-track text-white/70 text-sm font-medium">
        <span className="px-4">{content}</span>
        <span className="px-4">{content}</span>
      </div>
    </div>
  );
}

export default function Display() {
  const [current, setCurrent] = useState(null);
  const [pulse, setPulse] = useState(false);
  const [admissionNotice, setAdmissionNotice] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [ads, setAds] = useState([]);
  const [publicStats, setPublicStats] = useState(null);
  const lastId = useRef(null);
  const lastAdmissionId = useRef(null);
  const audioCtxRef = useRef(null);

  const params = new URLSearchParams(window.location.search);
  const adsOnLeft = params.get('ads') === 'left';

  function enableSound(announce = true) {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtxRef.current = new AudioContextClass();
    if (announce) {
      playChime(audioCtxRef.current);
      speakAnnouncement('Annonces sonores activées.');
    }
    setSoundEnabled(true);
    localStorage.setItem(SOUND_PREF_KEY, '1');
  }

  // Tente de réactiver automatiquement le son après une actualisation de la page,
  // si l'écran a déjà été débloqué une première fois sur cet appareil. Fonctionne de
  // façon fiable si le navigateur est lancé en mode kiosque avec le flag
  // --autoplay-policy=no-user-gesture-required (recommandé pour un poste TV dédié) ;
  // sinon, le navigateur peut malgré tout redemander une interaction selon sa politique.
  useEffect(() => {
    if (localStorage.getItem(SOUND_PREF_KEY) === '1') {
      try {
        enableSound(false);
      } catch {
        // le navigateur a refusé la création automatique — le bouton restera visible
      }
    }
    // Débloque aussi au premier clic/tap n'importe où sur l'écran, en secours.
    function unlockOnFirstInteraction() {
      if (!audioCtxRef.current) enableSound(false);
      window.removeEventListener('click', unlockOnFirstInteraction);
    }
    window.addEventListener('click', unlockOnFirstInteraction);
    return () => window.removeEventListener('click', unlockOnFirstInteraction);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    async function loadAds() {
      try {
        const { data } = await apiClient.get('/ads');
        setAds(data.ads);
      } catch {
        // écran continue de fonctionner même si les pubs ne chargent pas
      }
    }
    loadAds();
    const adsInterval = setInterval(loadAds, 5 * 60 * 1000);
    return () => clearInterval(adsInterval);
  }, []);

  useEffect(() => {
    async function loadStats() {
      try {
        const { data } = await apiClient.get('/queue/public-stats');
        setPublicStats(data);
      } catch {
        // silencieux
      }
    }
    loadStats();
    const t = setInterval(loadStats, 30000);
    return () => clearInterval(t);
  }, []);

  // Poll de l'appel en salle d'examen — la clé de suivi combine id + callCount pour
  // détecter aussi bien un nouveau candidat qu'une simple répétition (rappel manuel
  // ou automatique toutes les minutes) du même candidat.
  useEffect(() => {
    async function poll() {
      try {
        const { data } = await apiClient.get('/queue/current');
        const key = data.candidate ? `${data.candidate.id}:${data.candidate.callCount ?? 1}` : null;
        if (key && key !== lastId.current) {
          lastId.current = key;
          setPulse(true);
          setTimeout(() => setPulse(false), 1500);

          if (soundEnabled && audioCtxRef.current) {
            playChime(audioCtxRef.current);
            setTimeout(() => {
              speakAnnouncement(
                `Candidat ${data.candidate.numero}. ${data.candidate.prenom} ${data.candidate.nom}. Veuillez vous présenter à l'accueil.`
              );
            }, 1750);
          }
        }
        setCurrent(data.candidate);
      } catch {
        // silencieux
      }
    }
    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  useEffect(() => {
    async function pollAdmission() {
      try {
        const { data } = await apiClient.get('/queue/admission-current');
        if (data.candidate && data.candidate.id !== lastAdmissionId.current) {
          lastAdmissionId.current = data.candidate.id;
          setAdmissionNotice(data.candidate);

          if (soundEnabled && audioCtxRef.current) {
            playAdmissionChime(audioCtxRef.current);
            setTimeout(() => {
              speakAnnouncement(
                `Candidat ${data.candidate.numero}. ${data.candidate.prenom} ${data.candidate.nom}. Merci de vous présenter à l'accueil pour les formalités d'admission. Munissez-vous de tous vos effets personnels.`
              );
            }, 900);
          }

          setTimeout(() => setAdmissionNotice((n) => (n?.id === data.candidate.id ? null : n)), 12000);
        }
      } catch {
        // silencieux
      }
    }
    pollAdmission();
    const interval = setInterval(pollAdmission, 5000);
    return () => clearInterval(interval);
  }, [soundEnabled]);

  const mainContent = (
    <div className="flex-1 min-w-0 bg-[#04141A] text-white flex flex-col relative">
      <div className="flex-1 flex flex-col items-center justify-center px-8 relative">
        {!soundEnabled && (
          <button
            onClick={() => enableSound(true)}
            className="absolute top-6 right-6 bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-semibold rounded-full px-5 py-2.5 shadow-lg flex items-center gap-2 animate-pulse"
          >
            🔊 Activer le son
          </button>
        )}
        {soundEnabled && (
          <span className="absolute top-6 right-6 text-white/30 text-xs uppercase tracking-widest">🔊 Son activé</span>
        )}

        {admissionNotice && (
          <div className="absolute top-0 left-0 right-0 bg-amber-500 text-[#04141A] px-6 py-3 text-center font-semibold shadow-lg animate-pulse">
            ⏰ {admissionNotice.numero} — {admissionNotice.prenom} {admissionNotice.nom} : merci de monter à l'accueil avec vos effets personnels
          </div>
        )}

        <div className="flex items-center gap-2 mb-6">
          <img src="/logo-korintek.png" alt="KORINTEK" width={32} height={32} />
          <p className="font-heading text-korintek-teal text-2xl font-extrabold tracking-[0.15em]">KORINTEK</p>
        </div>
        <p className="uppercase tracking-[0.3em] text-white/40 text-sm font-medium mb-10">Candidat appelé</p>

        {current ? (
          <div className={`text-center transition-transform duration-300 ${pulse ? 'scale-105' : 'scale-100'}`}>
            <p className="font-heading text-[9rem] leading-none font-extrabold text-white drop-shadow-[0_0_40px_rgba(0,186,210,0.35)]">
              {current.numero}
            </p>
            <p className="text-4xl font-bold text-korintek-teal mt-4 uppercase tracking-wide">
              {current.prenom} {current.nom}
            </p>
          </div>
        ) : (
          <p className="text-3xl text-white/30">En attente du prochain appel...</p>
        )}

        <p className="mt-16 text-white/50 text-xl">Veuillez vous présenter à l'accueil</p>
      </div>

      <InfoTicker stats={publicStats} />
    </div>
  );

  const adPanel = (
    <div className="w-[36%] min-w-[340px] max-w-[560px]">
      <AdPanel ads={ads} />
    </div>
  );

  return (
    <div className="min-h-screen flex">
      {adsOnLeft && adPanel}
      {mainContent}
      {!adsOnLeft && adPanel}
    </div>
  );
}
