import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

function fmt(n) {
  return Number(n || 0).toLocaleString('fr-FR');
}

const TABS = [
  { key: 'balance', label: 'Balance générale' },
  { key: 'bilan', label: 'Bilan' },
  { key: 'grand-livre', label: 'Grand livre' },
];

export default function Reports() {
  const [tab, setTab] = useState('balance');
  const [balance, setBalanceData] = useState(null);
  const [bilan, setBilan] = useState(null);
  const [accounts, setAccounts] = useState([]);
  const [selectedAccountId, setSelectedAccountId] = useState('');
  const [grandLivre, setGrandLivre] = useState(null);
  const navigate = useNavigate();

  useEffect(() => {
    apiClient.get('/accounts').then(({ data }) => setAccounts(data.accounts));
  }, []);

  useEffect(() => {
    if (tab === 'balance') {
      apiClient.get('/reports/balance').then(({ data }) => setBalanceData(data));
    } else if (tab === 'bilan') {
      apiClient.get('/reports/bilan').then(({ data }) => setBilan(data));
    }
  }, [tab]);

  useEffect(() => {
    if (tab === 'grand-livre' && selectedAccountId) {
      apiClient.get(`/reports/grand-livre/${selectedAccountId}`).then(({ data }) => setGrandLivre(data));
    }
  }, [tab, selectedAccountId]);

  return (
    <div className="min-h-screen page-bg">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size={36} showWordmark={false} />
          <h1 className="font-heading font-bold text-korintek-ink">Rapports</h1>
        </div>
        <button onClick={() => navigate('/journal')} className="text-sm text-korintek-tealDark hover:underline">← Journal</button>
      </header>

      <main className="p-6 max-w-4xl mx-auto space-y-6">
        <div className="flex gap-2">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`text-sm font-medium rounded-lg px-4 py-2 ${tab === t.key ? 'bg-korintek-navy text-white' : 'bg-white border border-slate-200 text-slate-600'}`}
            >
              {t.label}
            </button>
          ))}
        </div>

        {tab === 'balance' && balance && (
          <section className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-slate-500 text-left">
                <tr>
                  <th className="px-4 py-2">Code</th>
                  <th className="px-4 py-2">Compte</th>
                  <th className="px-4 py-2 text-right">Débit</th>
                  <th className="px-4 py-2 text-right">Crédit</th>
                  <th className="px-4 py-2 text-right">Solde</th>
                </tr>
              </thead>
              <tbody>
                {balance.rows.map((r) => (
                  <tr key={r.id} className="border-t border-slate-100">
                    <td className="px-4 py-2 font-mono text-xs text-slate-500">{r.code}</td>
                    <td className="px-4 py-2">{r.name}</td>
                    <td className="px-4 py-2 text-right num-cell">{fmt(r.totalDebit)}</td>
                    <td className="px-4 py-2 text-right num-cell">{fmt(r.totalCredit)}</td>
                    <td className="px-4 py-2 text-right num-cell font-medium">{fmt(r.solde)}</td>
                  </tr>
                ))}
                {!balance.rows.length && (
                  <tr><td colSpan={5} className="px-4 py-6 text-center text-slate-400">Aucun mouvement.</td></tr>
                )}
              </tbody>
              <tfoot className="bg-slate-50 font-medium">
                <tr className="border-t border-slate-200">
                  <td className="px-4 py-2" colSpan={2}>Total</td>
                  <td className="px-4 py-2 text-right num-cell">{fmt(balance.totalDebitGeneral)}</td>
                  <td className="px-4 py-2 text-right num-cell">{fmt(balance.totalCreditGeneral)}</td>
                  <td className="px-4 py-2 text-right">
                    <span className={balance.equilibree ? 'text-emerald-600' : 'text-amber-600'}>
                      {balance.equilibree ? '✓ Équilibrée' : 'Déséquilibrée'}
                    </span>
                  </td>
                </tr>
              </tfoot>
            </table>
          </section>
        )}

        {tab === 'bilan' && bilan && (
          <div className="grid md:grid-cols-2 gap-4">
            <section className="bg-white border border-slate-100 rounded-xl shadow-card p-5">
              <h2 className="font-heading font-bold text-korintek-ink mb-3">Actif</h2>
              {bilan.actif.lines.map((l) => (
                <div key={l.code} className="flex justify-between text-sm py-1 border-b border-slate-50">
                  <span className="text-slate-600">{l.name}</span>
                  <span className="num-cell">{fmt(l.solde)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t border-slate-200">
                <span>Total Actif</span>
                <span className="num-cell">{fmt(bilan.actif.total)} FCFA</span>
              </div>
            </section>

            <section className="bg-white border border-slate-100 rounded-xl shadow-card p-5">
              <h2 className="font-heading font-bold text-korintek-ink mb-3">Passif & Capitaux propres</h2>
              {bilan.passif.lines.map((l) => (
                <div key={l.code} className="flex justify-between text-sm py-1 border-b border-slate-50">
                  <span className="text-slate-600">{l.name}</span>
                  <span className="num-cell">{fmt(l.solde)}</span>
                </div>
              ))}
              {bilan.capitauxPropres.lines.map((l) => (
                <div key={l.code} className="flex justify-between text-sm py-1 border-b border-slate-50">
                  <span className="text-slate-600">{l.name}</span>
                  <span className="num-cell">{fmt(l.solde)}</span>
                </div>
              ))}
              <div className="flex justify-between text-sm py-1 border-b border-slate-50">
                <span className="text-slate-600">Résultat net de l'exercice</span>
                <span className="num-cell">{fmt(bilan.resultatNet)}</span>
              </div>
              <div className="flex justify-between text-sm font-bold pt-2 mt-2 border-t border-slate-200">
                <span>Total Passif + Capitaux</span>
                <span className="num-cell">{fmt(bilan.totalPassifEtCapitaux)} FCFA</span>
              </div>
            </section>

            <div className={`md:col-span-2 rounded-lg px-4 py-2 text-sm font-medium text-center ${bilan.equilibre ? 'bg-emerald-50 text-emerald-700' : 'bg-amber-50 text-amber-700'}`}>
              {bilan.equilibre ? '✓ Bilan équilibré (Actif = Passif + Capitaux propres)' : 'Bilan déséquilibré — vérifier les écritures'}
            </div>
          </div>
        )}

        {tab === 'grand-livre' && (
          <div className="space-y-4">
            <select
              value={selectedAccountId}
              onChange={(e) => setSelectedAccountId(e.target.value)}
              className="rounded-lg border border-slate-300 px-3 py-2 text-sm"
            >
              <option value="">Choisir un compte...</option>
              {accounts.map((a) => <option key={a.id} value={a.id}>{a.code} — {a.name}</option>)}
            </select>

            {grandLivre && (
              <section className="bg-white border border-slate-100 rounded-xl shadow-card overflow-hidden">
                <table className="w-full text-sm">
                  <thead className="bg-slate-50 text-slate-500 text-left">
                    <tr>
                      <th className="px-4 py-2">Date</th>
                      <th className="px-4 py-2">Réf.</th>
                      <th className="px-4 py-2">Description</th>
                      <th className="px-4 py-2 text-right">Débit</th>
                      <th className="px-4 py-2 text-right">Crédit</th>
                      <th className="px-4 py-2 text-right">Solde progressif</th>
                    </tr>
                  </thead>
                  <tbody>
                    {grandLivre.movements.map((m, i) => (
                      <tr key={i} className="border-t border-slate-100">
                        <td className="px-4 py-2 text-slate-500">{new Date(m.date).toLocaleDateString('fr-FR')}</td>
                        <td className="px-4 py-2 font-mono text-xs text-slate-500">{m.reference}</td>
                        <td className="px-4 py-2">{m.description}{m.label && ` — ${m.label}`}</td>
                        <td className="px-4 py-2 text-right num-cell">{m.debit ? fmt(m.debit) : ''}</td>
                        <td className="px-4 py-2 text-right num-cell">{m.credit ? fmt(m.credit) : ''}</td>
                        <td className="px-4 py-2 text-right num-cell font-medium">{fmt(m.soldeProgressif)}</td>
                      </tr>
                    ))}
                    {!grandLivre.movements.length && (
                      <tr><td colSpan={6} className="px-4 py-6 text-center text-slate-400">Aucun mouvement sur ce compte.</td></tr>
                    )}
                  </tbody>
                  <tfoot className="bg-slate-50 font-bold">
                    <tr className="border-t border-slate-200">
                      <td className="px-4 py-2" colSpan={5}>Solde final</td>
                      <td className="px-4 py-2 text-right num-cell">{fmt(grandLivre.soldeFinal)} FCFA</td>
                    </tr>
                  </tfoot>
                </table>
              </section>
            )}
          </div>
        )}
      </main>
    </div>
  );
}
