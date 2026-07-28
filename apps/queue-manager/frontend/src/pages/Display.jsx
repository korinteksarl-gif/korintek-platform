import { useEffect, useRef, useState } from 'react';
import apiClient from '../api/client';

// Écran public de salle d'attente — aucune authentification requise (lecture seule)
export default function Display() {
  const [current, setCurrent] = useState(null);
  const [pulse, setPulse] = useState(false);
  const lastId = useRef(null);
  const audioRef = useRef(null);

  useEffect(() => {
    async function poll() {
      try {
        const { data } = await apiClient.get('/queue/current');
        if (data.candidate && data.candidate.id !== lastId.current) {
          lastId.current = data.candidate.id;
          setPulse(true);
          audioRef.current?.play().catch(() => {});
          setTimeout(() => setPulse(false), 1500);
        }
        setCurrent(data.candidate);
      } catch {
        // silencieux — l'écran continue d'afficher la dernière valeur connue
      }
    }
    poll();
    const interval = setInterval(poll, 4000);
    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col items-center justify-center px-8">
      <audio ref={audioRef} preload="auto">
        <source src="data:audio/wav;base64,UklGRiQAAABXQVZFZm10IBAAAAABAAEARKwAAIhYAQACABAAZGF0YQAAAAA=" type="audio/wav" />
      </audio>

      <p className="text-korintek-blue text-2xl font-bold tracking-[0.3em] mb-6">KORINTEK</p>
      <p className="uppercase tracking-[0.2em] text-slate-400 text-lg mb-10">Candidat appelé</p>

      {current ? (
        <div className={`text-center transition-transform ${pulse ? 'scale-105' : 'scale-100'}`}>
          <p className="text-[10rem] leading-none font-black text-white drop-shadow-lg">{current.numero}</p>
          <p className="text-4xl font-bold text-korintek-blue mt-4 uppercase">{current.prenom} {current.nom}</p>
        </div>
      ) : (
        <p className="text-3xl text-slate-500">En attente du prochain appel...</p>
      )}

      <p className="mt-16 text-slate-400 text-xl">Veuillez vous présenter à l'accueil</p>
    </div>
  );
}
