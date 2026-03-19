/* ═══════════════════════════════════════════════
   TRONIXX STREAMING — Panel de Ventas
   app.js  (versión con Login — Firebase Auth + Firestore)
   ═══════════════════════════════════════════════ */

import { initializeApp }                          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot,
         addDoc, updateDoc, deleteDoc,
         doc, serverTimestamp, query,
         orderBy }                                from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }            from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ══════════════════════════════════
   CONFIGURACIÓN FIREBASE
   ══════════════════════════════════ */
const firebaseConfig = {
  apiKey:            "AIzaSyBulQIsqsWv2F7gt_KYbUqxS9xfJXp2sgA",
  authDomain:        "tronixx-panel.firebaseapp.com",
  projectId:         "tronixx-panel",
  storageBucket:     "tronixx-panel.firebasestorage.app",
  messagingSenderId: "981047233624",
  appId:             "1:981047233624:web:586d1731f49437ec4e4e2d"
};

const app  = initializeApp(firebaseConfig);
const db   = getFirestore(app);
const auth = getAuth(app);
const COL  = "ventas";

/* ══════════════════════════════════
   ESTADO GLOBAL
   ══════════════════════════════════ */
let data        = [];
let sortCol     = 'fecha';
let sortDir     = -1;
let page        = 0;
let editId      = null;
let unsubscribe = null;   // función para detener el listener de Firestore
const PAGE_SIZE = 10;

/* ─── PLATAFORMAS ─── */
const PLATFORMS = [
  'Netflix', 'Disney+', 'Prime Video', 'HBO Max', 'Spotify',
  'Apple TV+', 'Crunchyroll', 'YouTube Premium', 'Paramount+',
  'Canva Premium', 'Pornhub Premium', 'DuoLingo Plus',
  'Xbox Game Pass', 'ChatGPT Plus', 'Tinder Gold', 'LinkedIn Premium',
];
const PLATFORM_KEY = {
  'Netflix':'netflix','Disney+':'disney','Prime Video':'prime',
  'HBO Max':'hbo','Spotify':'spotify','Apple TV+':'apple',
  'Crunchyroll':'crunchyroll','YouTube Premium':'youtube',
  'Paramount+':'paramount','Canva Premium':'canva',
  'Pornhub Premium':'pornhub','DuoLingo Plus':'duolingo',
  'Xbox Game Pass':'xbox','ChatGPT Plus':'chatgpt',
  'Tinder Gold':'tinder','LinkedIn Premium':'linkedin',
};
function pKey(p) { return PLATFORM_KEY[p] || 'apple'; }

/* ══════════════════════════════════
   MOSTRAR / OCULTAR PANTALLAS
   ══════════════════════════════════ */
function showLogin() {
  document.getElementById('login-screen').style.display = 'flex';
  document.getElementById('app-screen').style.display   = 'none';
  if (unsubscribe) { unsubscribe(); unsubscribe = null; }
  data = [];
}

function showApp() {
  document.getElementById('login-screen').style.display = 'none';
  document.getElementById('app-screen').style.display   = 'block';
  startRealtimeSync();
}

/* ══════════════════════════════════
   AUTENTICACIÓN — DETECTAR ESTADO
   Se ejecuta automáticamente al cargar
   ══════════════════════════════════ */
onAuthStateChanged(auth, (user) => {
  if (user) {
    showApp();
  } else {
    showLogin();
  }
});

/* ══════════════════════════════════
   LOGIN
   ══════════════════════════════════ */
window.doLogin = async function() {
  const email  = document.getElementById('l-email').value.trim();
  const pass   = document.getElementById('l-pass').value;
  const errEl  = document.getElementById('login-error');
  const btnEl  = document.getElementById('btn-login');

  errEl.classList.remove('show');

  if (!email || !pass) {
    errEl.textContent = 'Ingresa tu correo y contraseña.';
    errEl.classList.add('show');
    return;
  }

  btnEl.disabled     = true;
  btnEl.textContent  = 'Ingresando...';

  try {
    await signInWithEmailAndPassword(auth, email, pass);
    // onAuthStateChanged se encarga de mostrar el panel
  } catch (err) {
    let msg = 'Correo o contraseña incorrectos.';
    if (err.code === 'auth/too-many-requests') msg = 'Demasiados intentos. Espera unos minutos.';
    if (err.code === 'auth/network-request-failed') msg = 'Sin conexión. Verifica tu internet.';
    errEl.textContent = msg;
    errEl.classList.add('show');
    btnEl.disabled    = false;
    btnEl.textContent = 'Ingresar';
  }
};

/* ══════════════════════════════════
   LOGOUT
   ══════════════════════════════════ */
window.doLogout = async function() {
  if (!confirm('¿Cerrar sesión?')) return;
  await signOut(auth);
};

/* ══════════════════════════════════
   MOSTRAR / OCULTAR CONTRASEÑA
   ══════════════════════════════════ */
window.togglePass = function() {
  const inp = document.getElementById('l-pass');
  const eye = document.getElementById('pass-eye');
  if (inp.type === 'password') {
    inp.type      = 'text';
    eye.textContent = '🙈';
  } else {
    inp.type      = 'password';
    eye.textContent = '👁';
  }
};

/* Permitir Enter en el formulario de login */
document.addEventListener('keydown', (e) => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
    window.doLogin();
  }
});

/* ══════════════════════════════════
   SYNC EN TIEMPO REAL
   ══════════════════════════════════ */
function setSyncStatus(state, label) {
  const dot  = document.getElementById('sync-dot');
  const text = document.getElementById('sync-label');
  if (!dot || !text) return;
  dot.className    = 'sync-dot ' + state;
  text.textContent = label;
}

function startRealtimeSync() {
  setSyncStatus('saving', 'Conectando...');
  const q = query(collection(db, COL), orderBy('creadoEn', 'desc'));

  unsubscribe = onSnapshot(q,
    (snapshot) => {
      data = snapshot.docs.map(d => ({ _id: d.id, ...d.data() }));
      setSyncStatus('online', 'Sincronizado');
      renderMetrics();
      renderTable();
      populateMonths();
      const btnNew = document.querySelector('.btn-new');
      if (btnNew) btnNew.disabled = false;
    },
    (error) => {
      console.error(error);
      setSyncStatus('error', 'Error de conexión');
    }
  );
}

/* ══════════════════════════════════
   MODAL — ABRIR / CERRAR
   ══════════════════════════════════ */
window.openModal = function(id) {
  id     = id || null;
  editId = id;
  document.getElementById('modal-title').textContent = id ? 'Editar Venta' : 'Nueva Venta';

  if (id) {
    const r = data.find(x => x._id === id);
    if (!r) return;
    document.getElementById('f-numero').value     = r.numero     || '';
    document.getElementById('f-nombre').value     = r.nombre     || '';
    document.getElementById('f-plataforma').value = r.plataforma || 'Netflix';
    document.getElementById('f-perfil').value     = r.perfil     || '';
    document.getElementById('f-fecha').value      = r.fecha      || '';
    document.getElementById('f-precio').value     = r.precio     || '';
    document.getElementById('f-estado').value     = r.estado     || 'Activo';
    document.getElementById('f-notas').value      = r.notas      || '';
  } else {
    ['f-numero','f-nombre','f-perfil','f-notas'].forEach(fid => {
      document.getElementById(fid).value = '';
    });
    document.getElementById('f-fecha').value      = new Date().toISOString().split('T')[0];
    document.getElementById('f-precio').value     = '';
    document.getElementById('f-plataforma').value = 'Netflix';
    document.getElementById('f-estado').value     = 'Activo';
  }
  document.getElementById('modal').classList.add('open');
};

window.closeModal = function() {
  document.getElementById('modal').classList.remove('open');
  editId = null;
};

window.handleModalClick = function(e) {
  if (e.target === document.getElementById('modal')) window.closeModal();
};

/* ══════════════════════════════════
   GUARDAR
   ══════════════════════════════════ */
window.saveRecord = async function() {
  const numero     = document.getElementById('f-numero').value.trim();
  const nombre     = document.getElementById('f-nombre').value.trim();
  const plataforma = document.getElementById('f-plataforma').value;
  const perfil     = document.getElementById('f-perfil').value.trim();
  const fecha      = document.getElementById('f-fecha').value;
  const precio     = parseFloat(document.getElementById('f-precio').value) || 0;
  const estado     = document.getElementById('f-estado').value;
  const notas      = document.getElementById('f-notas').value.trim();

  if (!numero || !perfil || !fecha) {
    alert('Completa los campos obligatorios: N° contacto, perfil y fecha.');
    return;
  }

  const btnSave        = document.getElementById('btn-save');
  btnSave.disabled     = true;
  btnSave.textContent  = 'Guardando...';
  setSyncStatus('saving', 'Guardando...');

  try {
    const record = { numero, nombre, plataforma, perfil, fecha, precio, estado, notas };
    if (editId) {
      await updateDoc(doc(db, COL, editId), record);
    } else {
      record.creadoEn = serverTimestamp();
      await addDoc(collection(db, COL), record);
    }
    window.closeModal();
  } catch (err) {
    console.error(err);
    alert('Error al guardar. Verifica tu conexión.');
    setSyncStatus('error', 'Error al guardar');
  } finally {
    btnSave.disabled    = false;
    btnSave.textContent = 'Guardar';
  }
};

/* ══════════════════════════════════
   ELIMINAR
   ══════════════════════════════════ */
window.deleteRecord = async function(id) {
  if (!confirm('¿Eliminar esta venta?')) return;
  setSyncStatus('saving', 'Eliminando...');
  try {
    await deleteDoc(doc(db, COL, id));
  } catch (err) {
    console.error(err);
    alert('Error al eliminar.');
    setSyncStatus('error', 'Error al eliminar');
  }
};

/* ══════════════════════════════════
   ORDENAR / FILTRAR / PAGINAR
   ══════════════════════════════════ */
window.sortBy = function(col) {
  if (sortCol === col) sortDir *= -1;
  else { sortCol = col; sortDir = -1; }
  renderTable();
};

window.changePage = function(delta) {
  page = Math.max(0, page + delta);
  renderTable();
};

function filtered() {
  const q  = document.getElementById('search').value.toLowerCase();
  const pl = document.getElementById('filter-platform').value;
  const st = document.getElementById('filter-status').value;
  const mo = document.getElementById('filter-month').value;

  return data
    .filter(r => {
      const mQ = !q  || (r.numero||'').toLowerCase().includes(q)
                     || (r.nombre||'').toLowerCase().includes(q)
                     || (r.perfil||'').toLowerCase().includes(q)
                     || (r.plataforma||'').toLowerCase().includes(q);
      const mP = !pl || r.plataforma === pl;
      const mS = !st || r.estado === st;
      const mM = !mo || (r.fecha||'').startsWith(mo);
      return mQ && mP && mS && mM;
    })
    .sort((a, b) => {
      let va = a[sortCol]||'', vb = b[sortCol]||'';
      if (sortCol === 'precio') { va = parseFloat(va)||0; vb = parseFloat(vb)||0; }
      return va < vb ? -sortDir : va > vb ? sortDir : 0;
    });
}

/* ══════════════════════════════════
   RENDER TABLA
   ══════════════════════════════════ */
function renderTable() {
  const rows  = filtered();
  const total = rows.length;

  if (page * PAGE_SIZE >= total && page > 0) {
    page = Math.max(0, Math.ceil(total / PAGE_SIZE) - 1);
  }

  const slice = rows.slice(page * PAGE_SIZE, page * PAGE_SIZE + PAGE_SIZE);
  const tbody = document.getElementById('table-body');
  document.getElementById('table-count').textContent = `${total} registro${total !== 1 ? 's' : ''}`;

  if (!slice.length) {
    tbody.innerHTML = '<tr class="empty-row"><td colspan="8">No hay registros para mostrar.</td></tr>';
  } else {
    tbody.innerHTML = slice.map(r => {
      const k  = pKey(r.plataforma);
      const sl = r.estado === 'Activo'  ? 's-active'
               : r.estado === 'Vencido' ? 's-expired' : 's-pending';
      const pr = r.precio ? `S/. ${parseFloat(r.precio).toFixed(2)}` : '—';
      const fe = r.fecha
        ? new Date(r.fecha + 'T00:00:00').toLocaleDateString('es-PE', { day:'2-digit', month:'short', year:'numeric' })
        : '—';
      return `<tr>
        <td class="td-num"   title="${r.numero||''}">${r.numero||'—'}</td>
        <td title="${r.nombre||''}">${r.nombre||'—'}</td>
        <td><span class="badge p-${k}"><span class="badge-dot"></span>${r.plataforma||'—'}</span></td>
        <td>${r.perfil||'—'}</td>
        <td>${fe}</td>
        <td class="td-price">${pr}</td>
        <td><span class="status ${sl}">${r.estado||'—'}</span></td>
        <td><div class="actions">
          <button class="icon-btn"     title="Editar"   onclick="openModal('${r._id}')">&#9998;</button>
          <button class="icon-btn del" title="Eliminar" onclick="deleteRecord('${r._id}')">&#x2715;</button>
        </div></td>
      </tr>`;
    }).join('');
  }

  const from = total ? page * PAGE_SIZE + 1 : 0;
  const to   = Math.min(page * PAGE_SIZE + PAGE_SIZE, total);
  document.getElementById('page-info').textContent = total ? `${from}–${to} de ${total}` : '0 registros';
  document.getElementById('prev-btn').disabled     = page === 0;
  document.getElementById('next-btn').disabled     = (page + 1) * PAGE_SIZE >= total;
}

/* ══════════════════════════════════
   RENDER MÉTRICAS
   ══════════════════════════════════ */
function renderMetrics() {
  const total     = data.length;
  const activos   = data.filter(x => x.estado === 'Activo').length;
  const vencidos  = data.filter(x => x.estado === 'Vencido').length;
  const pendiente = data.filter(x => x.estado === 'Pendiente').length;
  const ingresos  = data.filter(x => x.estado !== 'Pendiente')
                        .reduce((s, r) => s + (parseFloat(r.precio)||0), 0);
  const platforms = new Set(data.map(x => x.plataforma)).size;

  document.getElementById('metrics').innerHTML = `
    <div class="metric"><div class="metric-icon">📋</div><div class="metric-label">Total ventas</div><div class="metric-value">${total}</div><div class="metric-sub">registros</div></div>
    <div class="metric"><div class="metric-icon">✅</div><div class="metric-label">Activos</div><div class="metric-value green">${activos}</div><div class="metric-sub">perfiles activos</div></div>
    <div class="metric"><div class="metric-icon">❌</div><div class="metric-label">Vencidos</div><div class="metric-value red">${vencidos}</div><div class="metric-sub">por renovar</div></div>
    <div class="metric"><div class="metric-icon">⏳</div><div class="metric-label">Pendientes</div><div class="metric-value yellow">${pendiente}</div><div class="metric-sub">por cobrar</div></div>
    <div class="metric"><div class="metric-icon">💰</div><div class="metric-label">Ingresos</div><div class="metric-value">S/. ${ingresos.toFixed(2)}</div><div class="metric-sub">cobrado</div></div>
    <div class="metric"><div class="metric-icon">📺</div><div class="metric-label">Plataformas</div><div class="metric-value">${platforms}</div><div class="metric-sub">distintas</div></div>`;
}

/* ══════════════════════════════════
   FILTRO POR MES
   ══════════════════════════════════ */
function populateMonths() {
  const seen = {}, months = [];
  data.forEach(r => {
    if (r.fecha) {
      const m = r.fecha.slice(0, 7);
      if (!seen[m]) { seen[m] = true; months.push(m); }
    }
  });
  months.sort().reverse();

  const sel = document.getElementById('filter-month');
  const cur = sel.value;
  while (sel.options.length > 1) sel.remove(1);
  months.forEach(m => {
    const [y, mo] = m.split('-');
    const lbl = new Date(parseInt(y), parseInt(mo)-1, 1)
      .toLocaleDateString('es-PE', { month:'long', year:'numeric' });
    const opt = document.createElement('option');
    opt.value       = m;
    opt.textContent = lbl.charAt(0).toUpperCase() + lbl.slice(1);
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

/* ══════════════════════════════════
   EXPORTAR CSV
   ══════════════════════════════════ */
window.exportCSV = function() {
  const rows  = filtered();
  const cols  = ['N° Contacto','Nombre','Plataforma','Perfil','Fecha','Precio (S/.)','Estado','Notas'];
  const lines = [cols.join(','), ...rows.map(r =>
    [r.numero||'', r.nombre||'', r.plataforma||'', r.perfil||'',
     r.fecha||'', r.precio||0, r.estado||'', r.notas||'']
      .map(v => `"${String(v).replace(/"/g,'""')}"`)
      .join(',')
  )];
  const blob = new Blob(['\uFEFF' + lines.join('\n')], { type:'text/csv;charset=utf-8;' });
  const a    = document.createElement('a');
  a.href     = URL.createObjectURL(blob);
  a.download = `tronixx_ventas_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
};

/* ══════════════════════════════════
   INICIALIZACIÓN
   ══════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('es-PE', {
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });

  // Poblar selects de plataformas
  const filterSel = document.getElementById('filter-platform');
  const formSel   = document.getElementById('f-plataforma');
  PLATFORMS.forEach(p => {
    const o1 = document.createElement('option'); o1.value = p; o1.textContent = p; filterSel.appendChild(o1);
    const o2 = document.createElement('option'); o2.value = p; o2.textContent = p; formSel.appendChild(o2);
  });

  // Deshabilitar Nueva Venta hasta conectar
  const btnNew = document.querySelector('.btn-new');
  if (btnNew) btnNew.disabled = true;
});
