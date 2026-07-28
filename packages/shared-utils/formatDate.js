// Formatage de date commun à tous les modules KORINTEK (FR)
function formatDateFR(date) {
  return new Intl.DateTimeFormat('fr-FR', { day: '2-digit', month: '2-digit', year: 'numeric' }).format(new Date(date));
}

module.exports = { formatDateFR };
