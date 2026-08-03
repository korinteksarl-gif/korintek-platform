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
    <div className="min-h-screen bg-korintek-bg flex flex-col">
      {/* Bandeau d'en-tête navy, cohérent avec l'identité de l'attestation */}
      <header className="bg-korintek-navy px-6 py-4">
        <div className="max-w-md mx-auto flex items-center gap-3">
          <Logo size={38} showWordmark={false} />
          <div>
            <p className="font-heading font-bold text-white text-sm tracking-wide">KORINTEK</p>
            <p className="text-[10px] text-korintek-teal uppercase tracking-wider">Vérification d'attestation</p>
          </div>
        </div>
      </header>

      <main className="flex-1 flex items-start justify-center px-4 py-10">
        <div className="w-full max-w-md">
          <div className="bg-white rounded-2xl shadow-card border border-slate-100 overflow-hidden">
            <div className="px-8 pt-7 pb-2 text-center">
              <h1 className="font-heading font-bold text-lg text-korintek-ink mb-1">Vérifier une attestation</h1>
              <p className="text-sm text-slate-500">Saisissez le numéro figurant sur le document.</p>
            </div>

            <form onSubmit={handleCheck} className="flex gap-2 px-8 py-6">
              <input
                value={numero}
                onChange={(e) => setNumero(e.target.value)}
                placeholder="KTK-2026-000123"
                className="flex-1 rounded-lg border border-slate-300 px-3 py-2.5 text-sm font-mono focus:outline-none focus:ring-2 focus:ring-korintek-gold/40 focus:border-korintek-gold"
              />
              <button
                type="submit"
                disabled={loading}
                className="bg-korintek-navy hover:bg-korintek-ink text-white text-sm font-medium rounded-lg px-5 disabled:opacity-60"
              >
                Vérifier
              </button>
            </form>

            {checked && result && (
              <div className="px-8 pb-8">
                {result.valid ? (
                  <div className="border border-emerald-200 bg-emerald-50 rounded-xl overflow-hidden">
                    <div className="bg-emerald-600 px-4 py-3 flex items-center gap-2">
                      <span className="text-white text-xl">✔</span>
                      <p className="font-heading font-bold text-white">Attestation authentique</p>
                    </div>
                    <div className="p-4 text-sm space-y-1.5">
                      <p><span className="text-slate-500">Titulaire</span><br /><strong className="text-korintek-ink">{result.studentName}</strong></p>
                      <p><span className="text-slate-500">Formation</span><br /><strong className="text-korintek-ink">{result.courseTitle}</strong></p>
                      <p><span className="text-slate-500">Durée</span> · {result.durationHours}h</p>
                      <p><span className="text-slate-500">Date d'obtention</span> · {new Date(result.completionDate).toLocaleDateString('fr-FR')}</p>

                      {result.certificateHash && (
                        <p className="mt-3 pt-3 border-t border-emerald-100 text-[11px] font-mono text-slate-400 break-all">
                          SHA-256 : {result.certificateHash}
                        </p>
                      )}
                      {result.integrityOk === false && (
                        <p className="mt-2 text-xs font-semibold text-red-600">
                          ⚠ Les données ne correspondent pas à l'empreinte d'origine — contactez KORINTEK.
                        </p>
                      )}

                      <a
                        href={`${import.meta.env.VITE_API_URL}/certificates/${result.numero}/pdf`}
                        target="_blank" rel="noreferrer"
                        className="inline-flex items-center gap-1 mt-3 text-korintek-navy font-medium hover:underline"
                      >
                        Voir le document PDF →
                      </a>
                    </div>
                  </div>
                ) : (
                  <div className="border border-red-200 bg-red-50 rounded-xl p-4 text-sm text-red-700 flex items-center gap-2">
                    <span className="text-lg">✘</span>
                    {result.error || 'Numéro invalide.'}
                  </div>
                )}
              </div>
            )}
          </div>

          <p className="text-center text-xs text-korintek-gold font-medium tracking-widest uppercase mt-8">
            Certifications Change Lives
          </p>
        </div>
      </main>

      {/* Bandeau de pied de page, cohérent avec l'attestation */}
      <footer className="bg-korintek-navy px-6 py-4 text-center">
        <p className="text-xs text-white">Adidogomé Soviépé, Lomé – Togo &nbsp;·&nbsp; +228 93 95 81 81</p>
        <p className="text-[11px] text-korintek-teal mt-1">contact@korintek.com &nbsp;·&nbsp; www.korintek.com</p>
      </footer>
    </div>
  );
}
