import { useState } from 'react';
import { useParams } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

export default function Verify() {
  const { numero: numeroFromUrl } = useParams();
  const [numero, setNumero] = useState(numeroFromUrl || '');
  const [result, setResult] = useState(null);
  const [checked, setChecked] = useState(false);
  const [loading, setLoading] = useState(false);

  async function handleCheck(e) {
    e?.preventDefault();
    if (!numero) return;
    setLoading(true);
    setChecked(false);
    try {
      const { data } = await apiClient.get(`/certificates/verify/${encodeURIComponent(numero)}`);
      setResult(data);
    } catch (err) {
      setResult(err.response?.data || { valid: false, error: 'Erreur de vérification.' });
    } finally {
      setLoading(false);
      setChecked(true);
    }
  }

  useState(() => { if (numeroFromUrl) handleCheck(); }, []);

  return (
    <div className="min-h-screen bg-korintek-tealLighter flex items-center justify-center px-4">
      <div className="w-full max-w-md">
        <div className="flex justify-center mb-6"><Logo size={48} /></div>
        <div className="bg-white rounded-2xl shadow-card p-8">
          <h1 className="font-heading font-bold text-lg text-korintek-ink text-center mb-2">Vérifier une attestation</h1>
          <p className="text-sm text-slate-500 text-center mb-6">Saisissez le numéro figurant sur l'attestation KORINTEK.</p>

          <form onSubmit={handleCheck} className="flex gap-2 mb-6">
            <input
              value={numero}
              onChange={(e) => setNumero(e.target.value)}
              placeholder="KTK-2026-000123"
              className="flex-1 rounded-lg border border-slate-300 px-3 py-2 text-sm font-mono"
            />
            <button type="submit" disabled={loading} className="bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-medium rounded-lg px-4 disabled:opacity-60">
              Vérifier
            </button>
          </form>

          {checked && result && (
            result.valid ? (
              <div className="bg-emerald-50 border border-emerald-200 rounded-xl p-4 text-sm">
                <p className="font-semibold text-emerald-700 mb-2">✔ Attestation authentique</p>
                <p><strong>Titulaire :</strong> {result.studentName}</p>
                <p><strong>Formation :</strong> {result.courseTitle}</p>
                <p><strong>Durée :</strong> {result.durationHours}h</p>
                <p><strong>Date d'obtention :</strong> {new Date(result.completionDate).toLocaleDateString('fr-FR')}</p>
                <a
                  href={`${import.meta.env.VITE_API_URL}/certificates/${result.numero}/pdf`}
                  target="_blank" rel="noreferrer"
                  className="inline-block mt-3 text-korintek-tealDark hover:underline"
                >
                  Voir le PDF →
                </a>
              </div>
            ) : (
              <div className="bg-red-50 border border-red-200 rounded-xl p-4 text-sm text-red-700">
                ✘ {result.error || 'Numéro invalide.'}
              </div>
            )
          )}
        </div>
      </div>
    </div>
  );
}
