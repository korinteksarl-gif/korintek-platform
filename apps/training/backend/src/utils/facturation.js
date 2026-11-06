// Pont Formations → Facturation (lot 3 interconnexion)
// Dès qu'une inscription a un premier paiement, une facture est créée dans
// facturation.korintek.com (une seule par inscription), puis chaque nouveau paiement
// y est reporté. Ne bloque jamais Formations : en cas d'échec, on journalise seulement.
//
// Variables Render (service korintek-training-api) :
//   FACTURATION_URL   ex. https://facturation.korintek.com
//   INTERNAL_API_KEY  même valeur que sur le service facturation
const { logAction } = require('./audit');

const BASE = (process.env.FACTURATION_URL || '').replace(/\/+$/, '');
const KEY = process.env.INTERNAL_API_KEY || '';

async function call(path, body) {
  const res = await fetch(`${BASE}${path}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json', 'X-Internal-Key': KEY, 'X-Source-Module': 'training' },
    body: JSON.stringify(body),
    signal: AbortSignal.timeout(15000),
  });
  if (!res.ok) throw new Error(`${path} → HTTP ${res.status}`);
  return res.json();
}

async function syncEnrollment(enrollment) {
  if (!BASE || !KEY || !enrollment) return null;
  const paid = Number(enrollment.amountPaid) || 0;
  if (paid <= 0 || !(Number(enrollment.amountDue) > 0)) return null; // rien à facturer tant que rien n'est payé
  const ref = `training:enrollment:${enrollment.id}`;
  const student = enrollment.student || {};
  const course = enrollment.course || {};
  const sessionDate = enrollment.session?.startDate
    ? ` — session du ${new Date(enrollment.session.startDate).toLocaleDateString('fr-FR')}`
    : '';
  const invoice = await call('/api/internal/invoices', {
    external_ref: ref,
    date: new Date().toISOString().slice(0, 10),
    client: {
      nom: `${student.prenom || ''} ${student.nom || ''}`.trim() || 'Apprenant',
      tel: student.telephone || null,
      email: student.email || null,
    },
    items: [{ name: `Formation : ${course.title || 'Formation KORINTEK'}${sessionDate}`, qty: 1, price: Number(enrollment.amountDue) }],
    activityType: 'FORMATION',
  });
  const payment = await call('/api/internal/invoices/payments', {
    external_ref: ref,
    total_paid: paid,
    method: enrollment.paymentMethod || 'OTHER',
    date: new Date().toISOString().slice(0, 10),
  });
  return { num: invoice.num, created: invoice.created, recorded: payment.recorded };
}

// À appeler sans await : ne ralentit ni ne fait échouer la requête Formations
function syncEnrollmentInBackground(enrollment, userId) {
  if (!BASE || !KEY) return;
  syncEnrollment(enrollment)
    .then((r) => {
      if (r && (r.created || r.recorded)) logAction(userId || null, 'FACTURATION_SYNC', { enrollmentId: enrollment.id, ...r }).catch(() => {});
    })
    .catch((err) => {
      console.error('[facturation] synchronisation échouée', enrollment.id, err.message);
      logAction(userId || null, 'FACTURATION_SYNC_FAILED', { enrollmentId: enrollment.id, error: err.message }).catch(() => {});
    });
}

module.exports = { syncEnrollment, syncEnrollmentInBackground };
