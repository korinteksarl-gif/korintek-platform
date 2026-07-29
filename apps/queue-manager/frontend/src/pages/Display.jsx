import { useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';

// Écran public de salle d'attente — aucune authentification requise (lecture seule).
// Deux types d'annonces sonores distincts :
//   1. Appel en salle d'examen — carillon 2 notes + voix "présentez-vous à l'accueil"
//   2. Formalités d'admission (T-15min) — carillon 3 notes montantes + voix "montez
//      avec vos effets personnels" + bandeau visuel temporaire en haut de l'écran.
// Panneau publicitaire configurable (gauche/droite) : ajouter ?ads=left à l'URL.

function playChime(audioCtx) {
  const notes = [
    { freq: 523.25, start: 0, duration: 0.35 },
    { freq: 783.99, start: 0.3, duration: 0.5 },
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
    gain.gain.linearRampToValueAtTime(0.35, t0 + 0.05);
    gain.gain.exponentialRampToValueAtTime(0.001, t0 + duration);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  });
}

// Carillon distinct pour les formalités d'admission — 3 notes montantes (sol-do-mi),
// pour que le personnel et les candidats fassent bien la différence avec l'appel.
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
        <svg width="56" height="56" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="19" fill="none" stroke="#00BAD2" strokeWidth="1.5" opacity="0.4" />
          <text x="20" y="27" textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight="800" fontSize="18" fill="#00BAD2" opacity="0.4">K</text>
        </svg>
        <p className="text-white/20 text-xs uppercase tracking-[0.25em]">Certifications Change Lives</p>
      </div>
    );
  }

  const ad = ads[index];
  const content = (
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

export default function Display() {
  const [current, setCurrent] = useState(null);
  const [pulse, setPulse] = useState(false);
  const [admissionNotice, setAdmissionNotice] = useState(null);
  const [soundEnabled, setSoundEnabled] = useState(false);
  const [ads, setAds] = useState([]);
  const lastId = useRef(null);
  const lastAdmissionId = useRef(null);
  const audioCtxRef = useRef(null);

  const params = new URLSearchParams(window.location.search);
  const adsOnLeft = params.get('ads') === 'left';

  function enableSound() {
    const AudioContextClass = window.AudioContext || window.webkitAudioContext;
    audioCtxRef.current = new AudioContextClass();
    playChime(audioCtxRef.current);
    speakAnnouncement('Annonces sonores activées.');
    setSoundEnabled(true);
  }

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

  // Poll de l'appel en salle d'examen (inchangé)
  useEffect(() => {
    async function poll() {
      try {
        const { data } = await apiClient.get('/queue/current');
        if (data.candidate && data.candidate.id !== lastId.current) {
          lastId.current = data.candidate.id;
          setPulse(true);
          setTimeout(() => setPulse(false), 1500);

          if (soundEnabled && audioCtxRef.current) {
            playChime(audioCtxRef.current);
            setTimeout(() => {
              speakAnnouncement(
                `Candidat ${data.candidate.numero}. ${data.candidate.prenom} ${data.candidate.nom}. Veuillez vous présenter à l'accueil.`
              );
            }, 900);
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

  // Poll des formalités d'admission (T-15min) — annonce distincte
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

          // Le bandeau visuel reste affiché 12 secondes puis disparaît de lui-même.
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
    <div className="flex-1 min-w-0 bg-[#04141A] text-white flex flex-col items-center justify-center px-8 relative">
      {!soundEnabled && (
        <button
          onClick={enableSound}
          className="absolute top-6 right-6 bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-semibold rounded-full px-5 py-2.5 shadow-lg flex items-center gap-2 animate-pulse"
        >
          🔊 Activer le son
        </button>
      )}
      {soundEnabled && (
        <span className="absolute top-6 right-6 text-white/30 text-xs uppercase tracking-widest">🔊 Son activé</span>
      )}

      {/* Bandeau "Formalités d'admission" — distinct de l'appel principal, disparaît après 12s */}
      {admissionNotice && (
        <div className="absolute top-0 left-0 right-0 bg-amber-500 text-[#04141A] px-6 py-3 text-center font-semibold shadow-lg animate-pulse">
          ⏰ {admissionNotice.numero} — {admissionNotice.prenom} {admissionNotice.nom} : merci de monter à l'accueil avec vos effets personnels
        </div>
      )}

      <div className="flex items-center gap-2 mb-6">
        <svg width="28" height="28" viewBox="0 0 40 40" aria-hidden="true">
          <circle cx="20" cy="20" r="19" fill="none" stroke="#00BAD2" strokeWidth="2" />
          <text x="20" y="27" textAnchor="middle" fontFamily="Manrope, sans-serif" fontWeight="800" fontSize="18" fill="#00BAD2">K</text>
        </svg>
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
      <p className="mt-2 text-white/20 text-xs uppercase tracking-[0.2em]">Certifications Change Lives</p>
    </div>
  );

  const adPanel = (
    <div className="w-[30%] min-w-[280px] max-w-[420px]">
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
