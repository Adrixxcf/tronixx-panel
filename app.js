/* ═══════════════════════════════════════════════
   TRONIXX STREAMING — Panel de Ventas
   app.js
   ═══════════════════════════════════════════════ */

const STORE    = 'tronixx_ventas_v2';
let data       = [];
let sortCol    = 'fecha';
let sortDir    = -1;
let page       = 0;
const PAGE_SIZE = 10;
let editId     = null;

/* ─── PLATAFORMAS DISPONIBLES ─── */
const PLATFORMS = [
  'Netflix',
  'Disney+',
  'Prime Video',
  'HBO Max',
  'Spotify',
  'Apple TV+',
  'Crunchyroll',
  'YouTube Premium',
  'Paramount+',
  'Canva Premium',
  'Pornhub Premium',
  'DuoLingo Plus',
  'Xbox Game Pass',
  'ChatGPT Plus',
  'Tinder Gold',
  'LinkedIn Premium',
];

/* ─── MAPA DE CLAVES PARA BADGES CSS ─── */
const PLATFORM_KEY = {
  'Netflix':           'netflix',
  'Disney+':           'disney',
  'Prime Video':       'prime',
  'HBO Max':           'hbo',
  'Spotify':           'spotify',
  'Apple TV+':         'apple',
  'Crunchyroll':       'crunchyroll',
  'YouTube Premium':   'youtube',
  'Paramount+':        'paramount',
  'Canva Premium':     'canva',
  'Pornhub Premium':   'pornhub',
  'DuoLingo Plus':     'duolingo',
  'Xbox Game Pass':    'xbox',
  'ChatGPT Plus':      'chatgpt',
  'Tinder Gold':       'tinder',
  'LinkedIn Premium':  'linkedin',
};

function pKey(p) {
  return PLATFORM_KEY[p] || 'apple';
}

/* ════════════════════════════════
   STORAGE
   ════════════════════════════════ */
function load() {
  try { data = JSON.parse(localStorage.getItem(STORE) || '[]'); }
  catch (e) { data = []; }
  if (!data.length) seedData();
}
function save() {
  try { localStorage.setItem(STORE, JSON.stringify(data)); } catch (e) {}
}

/* ════════════════════════════════
   DATOS DE EJEMPLO
   ════════════════════════════════ */
function seedData() {
  const d = (offset, monthsBack = 0) => {
    const x = new Date();
    x.setMonth(x.getMonth() - monthsBack);
    x.setDate(x.getDate() - offset);
    return x.toISOString().split('T')[0];
  };
  data = [
    { id:1,  numero:'+51 987 654 321', nombre:'Carlos Mendoza',  plataforma:'Netflix',          perfil:'Perfil 1',      fecha:d(2),   precio:15, estado:'Activo',    notas:'' },
    { id:2,  numero:'+51 976 543 210', nombre:'Ana Torres',       plataforma:'Disney+',          perfil:'Perfil 3',      fecha:d(5),   precio:12, estado:'Activo',    notas:'' },
    { id:3,  numero:'+51 965 432 109', nombre:'Luis Ríos',        plataforma:'Prime Video',      perfil:'Perfil 2',      fecha:d(10),  precio:10, estado:'Pendiente', notas:'Pago pendiente' },
    { id:4,  numero:'+51 954 321 098', nombre:'María Soto',       plataforma:'HBO Max',          perfil:'Perfil 1',      fecha:d(15),  precio:18, estado:'Vencido',   notas:'' },
    { id:5,  numero:'+51 943 210 987', nombre:'Pedro Vega',       plataforma:'Spotify',          perfil:'Cuenta entera', fecha:d(20),  precio:9,  estado:'Activo',    notas:'' },
    { id:6,  numero:'+51 932 109 876', nombre:'Rosa Chávez',      plataforma:'Netflix',          perfil:'Perfil 4',      fecha:d(3,1), precio:15, estado:'Vencido',   notas:'' },
    { id:7,  numero:'+51 921 098 765', nombre:'Jorge Paredes',    plataforma:'Canva Premium',    perfil:'Cuenta entera', fecha:d(8,1), precio:14, estado:'Activo',    notas:'Diseñador' },
    { id:8,  numero:'+51 910 987 654', nombre:'Laura Campos',     plataforma:'Crunchyroll',      perfil:'Perfil 1',      fecha:d(3),   precio:8,  estado:'Pendiente', notas:'' },
    { id:9,  numero:'+51 899 876 543', nombre:'Andrés Luna',      plataforma:'ChatGPT Plus',     perfil:'Cuenta entera', fecha:d(12),  precio:20, estado:'Activo',    notas:'' },
    { id:10, numero:'+51 888 765 432', nombre:'Sofía Mora',       plataforma:'Netflix',          perfil:'Perfil 2',      fecha:d(3,1), precio:15, estado:'Activo',    notas:'' },
    { id:11, numero:'+51 877 654 321', nombre:'Diego Salas',      plataforma:'YouTube Premium',  perfil:'Cuenta entera', fecha:d(7),   precio:7,  estado:'Activo',    notas:'' },
    { id:12, numero:'+51 866 543 210', nombre:'Valeria Huamán',   plataforma:'Pornhub Premium',  perfil:'Cuenta entera', fecha:d(18),  precio:10, estado:'Vencido',   notas:'Renovar pronto' },
    { id:13, numero:'+51 855 432 109', nombre:'Raúl Castillo',    plataforma:'Tinder Gold',      perfil:'Cuenta entera', fecha:d(6),   precio:12, estado:'Activo',    notas:'' },
    { id:14, numero:'+51 844 321 098', nombre:'Gabriela Núñez',   plataforma:'LinkedIn Premium', perfil:'Cuenta entera', fecha:d(9),   precio:25, estado:'Activo',    notas:'Busca trabajo' },
  ];
  save();
}

/* ════════════════════════════════
   MODAL — ABRIR / CERRAR
   ════════════════════════════════ */
function openModal(id) {
  id    = id || null;
  editId = id;
  document.getElementById('modal-title').textContent = id ? 'Editar Venta' : 'Nueva Venta';

  if (id) {
    const r = data.find(function(x) { return x.id === id; });
    document.getElementById('f-numero').value     = r.numero;
    document.getElementById('f-nombre').value     = r.nombre;
    document.getElementById('f-plataforma').value = r.plataforma;
    document.getElementById('f-perfil').value     = r.perfil;
    document.getElementById('f-fecha').value      = r.fecha;
    document.getElementById('f-precio').value     = r.precio;
    document.getElementById('f-estado').value     = r.estado;
    document.getElementById('f-notas').value      = r.notas || '';
  } else {
    ['f-numero', 'f-nombre', 'f-perfil', 'f-notas'].forEach(function(fid) {
      document.getElementById(fid).value = '';
    });
    document.getElementById('f-fecha').value      = new Date().toISOString().split('T')[0];
    document.getElementById('f-precio').value     = '';
    document.getElementById('f-plataforma').value = 'Netflix';
    document.getElementById('f-estado').value     = 'Activo';
  }

  document.getElementById('modal').classList.add('open');
}

function closeModal() {
  document.getElementById('modal').classList.remove('open');
  editId = null;
}

function handleModalClick(e) {
  if (e.target === document.getElementById('modal')) closeModal();
}

/* ════════════════════════════════
   GUARDAR REGISTRO
   ════════════════════════════════ */
function saveRecord() {
  var numero     = document.getElementById('f-numero').value.trim();
  var nombre     = document.getElementById('f-nombre').value.trim();
  var plataforma = document.getElementById('f-plataforma').value;
  var perfil     = document.getElementById('f-perfil').value.trim();
  var fecha      = document.getElementById('f-fecha').value;
  var precio     = parseFloat(document.getElementById('f-precio').value) || 0;
  var estado     = document.getElementById('f-estado').value;
  var notas      = document.getElementById('f-notas').value.trim();

  if (!numero || !perfil || !fecha) {
    alert('Completa los campos obligatorios: N° contacto, perfil y fecha.');
    return;
  }

  if (editId) {
    var i = data.findIndex(function(x) { return x.id === editId; });
    data[i] = Object.assign({}, data[i], { numero: numero, nombre: nombre, plataforma: plataforma, perfil: perfil, fecha: fecha, precio: precio, estado: estado, notas: notas });
  } else {
    var newId = data.length ? Math.max.apply(null, data.map(function(x) { return x.id; })) + 1 : 1;
    data.push({ id: newId, numero: numero, nombre: nombre, plataforma: plataforma, perfil: perfil, fecha: fecha, precio: precio, estado: estado, notas: notas });
  }

  save();
  closeModal();
  renderMetrics();
  renderTable();
  populateMonths();
}

/* ════════════════════════════════
   ELIMINAR REGISTRO
   ════════════════════════════════ */
function deleteRecord(id) {
  if (!confirm('¿Eliminar esta venta?')) return;
  data = data.filter(function(x) { return x.id !== id; });
  save();
  renderMetrics();
  renderTable();
}

/* ════════════════════════════════
   ORDENAR
   ════════════════════════════════ */
function sortBy(col) {
  if (sortCol === col) { sortDir *= -1; }
  else { sortCol = col; sortDir = -1; }
  renderTable();
}

/* ════════════════════════════════
   FILTRAR
   ════════════════════════════════ */
function filtered() {
  var q  = document.getElementById('search').value.toLowerCase();
  var pl = document.getElementById('filter-platform').value;
  var st = document.getElementById('filter-status').value;
  var mo = document.getElementById('filter-month').value;

  return data
    .filter(function(r) {
      var mQ = !q  || r.numero.toLowerCase().indexOf(q) > -1
                   || (r.nombre || '').toLowerCase().indexOf(q) > -1
                   || r.perfil.toLowerCase().indexOf(q) > -1
                   || r.plataforma.toLowerCase().indexOf(q) > -1;
      var mP = !pl || r.plataforma === pl;
      var mS = !st || r.estado === st;
      var mM = !mo || r.fecha.indexOf(mo) === 0;
      return mQ && mP && mS && mM;
    })
    .sort(function(a, b) {
      var va = a[sortCol], vb = b[sortCol];
      if (sortCol === 'precio') { va = parseFloat(va) || 0; vb = parseFloat(vb) || 0; }
      return va < vb ? -sortDir : va > vb ? sortDir : 0;
    });
}

/* ════════════════════════════════
   PAGINACIÓN
   ════════════════════════════════ */
function changePage(delta) {
  page = Math.max(0, page + delta);
  renderTable();
}

/* ════════════════════════════════
   RENDER TABLA
   ════════════════════════════════ */
function renderTable() {
  var rows  = filtered();
  var total = rows.length;

  if (page * PAGE_SIZE >= total && page > 0) {
    page = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  }

  var slice = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  var tbody = document.getElementById('table-body');
  document.getElementById('table-count').textContent = total + ' registro' + (total !== 1 ? 's' : '');

  if (!slice.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay registros para mostrar.</td></tr>';
  } else {
    tbody.innerHTML = slice.map(function(r) {
      var k  = pKey(r.plataforma);
      var sl = r.estado === 'Activo'  ? 's-active'
             : r.estado === 'Vencido' ? 's-expired'
             : 's-pending';
      var pr = r.precio ? 'S/. ' + parseFloat(r.precio).toFixed(2) : '—';
      var fe = r.fecha
        ? new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' })
        : '—';

      return '<tr>' +
        '<td class="td-num" title="' + r.numero + '">' + r.numero + '</td>' +
        '<td title="' + (r.nombre || '') + '">' + (r.nombre || '—') + '</td>' +
        '<td><span class="badge p-' + k + '"><span class="badge-dot"></span>' + r.plataforma + '</span></td>' +
        '<td>' + r.perfil + '</td>' +
        '<td>' + fe + '</td>' +
        '<td class="td-price">' + pr + '</td>' +
        '<td><span class="status ' + sl + '">' + r.estado + '</span></td>' +
        '<td><div class="actions">' +
          '<button class="icon-btn" title="Editar" onclick="openModal(' + r.id + ')">&#9998;</button>' +
          '<button class="icon-btn del" title="Eliminar" onclick="deleteRecord(' + r.id + ')">&#x2715;</button>' +
        '</div></td>' +
        '</tr>';
    }).join('');
  }

  var from = total ? page * PAGE_SIZE + 1 : 0;
  var to   = Math.min(page * PAGE_SIZE + PAGE_SIZE, total);
  document.getElementById('page-info').textContent = total ? from + '–' + to + ' de ' + total : '0 registros';
  document.getElementById('prev-btn').disabled     = page === 0;
  document.getElementById('next-btn').disabled     = (page + 1) * PAGE_SIZE >= total;
}

/* ════════════════════════════════
   RENDER MÉTRICAS
   ════════════════════════════════ */
function renderMetrics() {
  var total     = data.length;
  var activos   = data.filter(function(x) { return x.estado === 'Activo'; }).length;
  var vencidos  = data.filter(function(x) { return x.estado === 'Vencido'; }).length;
  var pendiente = data.filter(function(x) { return x.estado === 'Pendiente'; }).length;
  var ingresos  = data
    .filter(function(x) { return x.estado !== 'Pendiente'; })
    .reduce(function(s, r) { return s + (parseFloat(r.precio) || 0); }, 0);
  var platforms = (function() {
    var seen = {};
    data.forEach(function(x) { seen[x.plataforma] = true; });
    return Object.keys(seen).length;
  })();

  document.getElementById('metrics').innerHTML =
    '<div class="metric"><div class="metric-icon">📋</div><div class="metric-label">Total ventas</div><div class="metric-value">' + total + '</div><div class="metric-sub">registros</div></div>' +
    '<div class="metric"><div class="metric-icon">✅</div><div class="metric-label">Activos</div><div class="metric-value green">' + activos + '</div><div class="metric-sub">perfiles activos</div></div>' +
    '<div class="metric"><div class="metric-icon">❌</div><div class="metric-label">Vencidos</div><div class="metric-value red">' + vencidos + '</div><div class="metric-sub">por renovar</div></div>' +
    '<div class="metric"><div class="metric-icon">⏳</div><div class="metric-label">Pendientes</div><div class="metric-value yellow">' + pendiente + '</div><div class="metric-sub">por cobrar</div></div>' +
    '<div class="metric"><div class="metric-icon">💰</div><div class="metric-label">Ingresos</div><div class="metric-value">S/. ' + ingresos.toFixed(2) + '</div><div class="metric-sub">cobrado</div></div>' +
    '<div class="metric"><div class="metric-icon">📺</div><div class="metric-label">Plataformas</div><div class="metric-value">' + platforms + '</div><div class="metric-sub">distintas</div></div>';
}

/* ════════════════════════════════
   FILTRO POR MES
   ════════════════════════════════ */
function populateMonths() {
  var months = [];
  var seen   = {};
  data.forEach(function(r) {
    var m = r.fecha.slice(0, 7);
    if (!seen[m]) { seen[m] = true; months.push(m); }
  });
  months.sort().reverse();

  var sel = document.getElementById('filter-month');
  var cur = sel.value;
  while (sel.options.length > 1) sel.remove(1);

  months.forEach(function(m) {
    var parts = m.split('-');
    var lbl   = new Date(parseInt(parts[0]), parseInt(parts[1]) - 1, 1)
      .toLocaleDateString('es-PE', { month: 'long', year: 'numeric' });
    var opt      = document.createElement('option');
    opt.value    = m;
    opt.textContent = lbl.charAt(0).toUpperCase() + lbl.slice(1);
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

/* ════════════════════════════════
   POBLAR SELECTS DE PLATAFORMAS
   ════════════════════════════════ */
function populatePlatformSelects() {
  var filterSel = document.getElementById('filter-platform');
  var formSel   = document.getElementById('f-plataforma');

  PLATFORMS.forEach(function(p) {
    var o1 = document.createElement('option');
    o1.value = p; o1.textContent = p;
    filterSel.appendChild(o1);

    var o2 = document.createElement('option');
    o2.value = p; o2.textContent = p;
    formSel.appendChild(o2);
  });
}

/* ════════════════════════════════
   EXPORTAR CSV
   ════════════════════════════════ */
function exportCSV() {
  var rows = filtered();
  var cols = ['N° Contacto', 'Nombre', 'Plataforma', 'Perfil', 'Fecha', 'Precio (S/.)', 'Estado', 'Notas'];
  var lines = [cols.join(',')].concat(rows.map(function(r) {
    return [r.numero, r.nombre || '', r.plataforma, r.perfil, r.fecha, r.precio || 0, r.estado, r.notas || '']
      .map(function(v) { return '"' + String(v).replace(/"/g, '""') + '"'; })
      .join(',');
  }));

  var blob = new Blob(['\uFEFF' + lines.join('\n')], { type: 'text/csv;charset=utf-8;' });
  var a    = document.createElement('a');
  a.href   = URL.createObjectURL(blob);
  a.download = 'tronixx_ventas_' + new Date().toISOString().split('T')[0] + '.csv';
  a.click();
}

/* ════════════════════════════════
   INICIALIZACIÓN
   ════════════════════════════════ */
document.addEventListener('DOMContentLoaded', function() {
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('es-PE', {
    weekday: 'long', year: 'numeric', month: 'long', day: 'numeric'
  });

  populatePlatformSelects();
  load();
  populateMonths();
  renderMetrics();
  renderTable();
});
