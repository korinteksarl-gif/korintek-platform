import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import apiClient from '../api/client';
import Logo from '../components/Logo.jsx';

export default function Ads() {
  const [ads, setAds] = useState([]);
  const [file, setFile] = useState(null);
  const [title, setTitle] = useState('');
  const [linkUrl, setLinkUrl] = useState('');
  const [uploading, setUploading] = useState(false);
  const [error, setError] = useState('');
  const navigate = useNavigate();

  async function load() {
    const { data } = await apiClient.get('/ads/admin');
    setAds(data.ads);
  }

  useEffect(() => { load(); }, []);

  async function handleUpload(e) {
    e.preventDefault();
    if (!file) return;
    setError('');
    setUploading(true);
    try {
      const formData = new FormData();
      formData.append('file', file);
      if (title) formData.append('title', title);
      if (linkUrl) formData.append('linkUrl', linkUrl);
      await apiClient.post('/ads', formData, { headers: { 'Content-Type': 'multipart/form-data' } });
      setFile(null);
      setTitle('');
      setLinkUrl('');
      load();
    } catch (err) {
      setError(err.response?.data?.error || "Erreur lors de l'envoi de l'image.");
    } finally {
      setUploading(false);
    }
  }

  async function toggleActive(ad) {
    await apiClient.put(`/ads/${ad.id}`, { active: !ad.active });
    load();
  }

  async function remove(id) {
    if (!window.confirm('Supprimer définitivement cette image publicitaire ?')) return;
    await apiClient.delete(`/ads/${id}`);
    load();
  }

  async function move(ad, direction) {
    const newOrder = ad.order + direction;
    await apiClient.put(`/ads/${ad.id}`, { order: newOrder });
    load();
  }

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-white border-b border-slate-100 px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-4">
          <Logo size={36} showWordmark={false} />
          <div>
            <h1 className="font-heading font-bold text-korintek-ink">Publicités — Écran salle d'attente</h1>
            <p className="text-xs text-slate-400">Images affichées en carrousel sur /display</p>
          </div>
        </div>
        <button onClick={() => navigate('/dashboard')} className="text-sm text-korintek-tealDark hover:underline">
          ← Retour au tableau de bord
        </button>
      </header>

      <main className="p-6 max-w-3xl mx-auto space-y-6">
        <form onSubmit={handleUpload} className="bg-white border border-slate-100 rounded-xl shadow-card p-5 space-y-3">
          <p className="text-sm font-medium text-korintek-ink">Ajouter une image publicitaire</p>
          <input
            type="file"
            accept="image/*"
            required
            onChange={(e) => setFile(e.target.files[0])}
            className="block w-full text-sm text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-lg file:border-0 file:bg-korintek-tealLight file:text-korintek-tealDark file:font-medium"
          />
          <p className="text-xs text-slate-400">Format recommandé : image verticale (portrait), max 3 Mo. JPG ou PNG.</p>
          <div className="grid md:grid-cols-2 gap-3">
            <input
              type="text"
              placeholder="Titre (optionnel, usage interne)"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
            <input
              type="text"
              placeholder="Lien (optionnel)"
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              className="rounded-lg border border-slate-200 px-3 py-2 text-sm"
            />
          </div>
          {error && <p className="text-sm text-red-600">{error}</p>}
          <button
            type="submit"
            disabled={uploading}
            className="bg-korintek-teal hover:bg-korintek-tealDark text-white text-sm font-medium rounded-lg px-4 py-2 disabled:opacity-60"
          >
            {uploading ? 'Envoi...' : "Ajouter l'image"}
          </button>
        </form>

        <div className="space-y-3">
          {ads.map((ad, i) => (
            <div key={ad.id} className="bg-white border border-slate-100 rounded-xl shadow-card p-4 flex items-center gap-4">
              <img src={ad.imageData} alt={ad.title || 'Publicité'} className="w-16 h-24 object-cover rounded-lg border border-slate-100" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-korintek-ink truncate">{ad.title || '(sans titre)'}</p>
                <p className="text-xs text-slate-400">Ordre {ad.order}</p>
              </div>
              <button onClick={() => move(ad, -1)} disabled={i === 0} className="text-slate-400 hover:text-korintek-teal disabled:opacity-30 text-lg px-1">↑</button>
              <button onClick={() => move(ad, 1)} disabled={i === ads.length - 1} className="text-slate-400 hover:text-korintek-teal disabled:opacity-30 text-lg px-1">↓</button>
              <button
                onClick={() => toggleActive(ad)}
                className={`text-xs font-medium rounded-full px-3 py-1 ${ad.active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'}`}
              >
                {ad.active ? 'Actif' : 'Masqué'}
              </button>
              <button onClick={() => remove(ad.id)} className="text-red-500 hover:text-red-700 text-sm">Supprimer</button>
            </div>
          ))}
          {!ads.length && (
            <p className="text-center text-sm text-slate-400 py-8">Aucune image publicitaire pour le moment.</p>
          )}
        </div>
      </main>
    </div>
  );
}
