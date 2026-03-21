/* ═══════════════════════════════════════════════
   TRONIXX STREAMING — app.js  (versión limpia)
   ═══════════════════════════════════════════════ */

import { initializeApp }                        from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot,
         addDoc, updateDoc, deleteDoc,
         doc, serverTimestamp, query,
         orderBy }                              from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }          from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ── CONFIG FIREBASE ── */
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

/* ── ESTADO GLOBAL ── */
let cuentas      = [];
let ventas       = [];
let unsubC       = null;
let unsubV       = null;
let editCuentaId = null;
let editVentaId  = null;
const PS = 10;

const sortState = {
  perfil: { col:'fechaVenc', dir:1, page:0 },
  cuenta: { col:'fechaVenc', dir:1, page:0 },
};

/* ── PLATAFORMAS ── */
const PLATFORMS = [
  'Netflix','Disney+','Prime Video','HBO Max','Spotify',
  'Apple TV+','Crunchyroll','YouTube Premium','Paramount+',
  'Vix','Canva Premium','Pornhub Premium','DuoLingo Plus',
  'Xbox Game Pass','ChatGPT Plus','Tinder Gold','LinkedIn Premium',
];
const PKEY = {
  'Netflix':'netflix','Disney+':'disney','Prime Video':'prime',
  'HBO Max':'hbo','Spotify':'spotify','Apple TV+':'apple',
  'Crunchyroll':'crunchyroll','YouTube Premium':'youtube',
  'Paramount+':'paramount','Vix':'vix','Canva Premium':'canva',
  'Pornhub Premium':'pornhub','DuoLingo Plus':'duolingo',
  'Xbox Game Pass':'xbox','ChatGPT Plus':'chatgpt',
  'Tinder Gold':'tinder','LinkedIn Premium':'linkedin',
};
const pKey = p => PKEY[p] || 'apple';

/* ── HELPERS ── */
const diasRestantes = fv => {
  if (!fv) return null;
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  return Math.round((new Date(fv+'T00:00:00') - hoy) / 86400000);
};
const fmtFecha = f => f
  ? new Date(f+'T00:00:00').toLocaleDateString('es-PE',{day:'2-digit',month:'short',year:'numeric'})
  : '—';
const sumarMes = f => {
  if (!f) return '';
  const d = new Date(f+'T00:00:00');
  d.setMonth(d.getMonth()+1);
  return d.toISOString().split('T')[0];
};

/* ── SYNC STATUS ── */
const setSS = (state, label) => {
  const d = document.getElementById('sync-dot');
  const l = document.getElementById('sync-label');
  if (d) d.className = 'sync-dot '+state;
  if (l) l.textContent = label;
};

/* ════════════════════════════════════════
   AUTH
   ════════════════════════════════════════ */
onAuthStateChanged(auth, user => {
  if (user) {
    document.getElementById('login-screen').style.display = 'none';
    document.getElementById('app-screen').style.display   = 'block';
    startSync();
  } else {
    document.getElementById('login-screen').style.display = 'flex';
    document.getElementById('app-screen').style.display   = 'none';
    if (unsubC) { unsubC(); unsubC = null; }
    if (unsubV) { unsubV(); unsubV = null; }
    cuentas = []; ventas = [];
  }
});

window.doLogin = async () => {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  const errEl = document.getElementById('login-error');
  const btnEl = document.getElementById('btn-login');
  errEl.classList.remove('show'); errEl.textContent = '';
  if (!email || !pass) {
    errEl.textContent = 'Ingresa tu correo y contraseña.';
    errEl.classList.add('show'); return;
  }
  btnEl.disabled = true; btnEl.textContent = 'Ingresando...';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    let msg = 'Correo o contraseña incorrectos.';
    if (e.code === 'auth/too-many-requests')      msg = 'Demasiados intentos. Espera unos minutos.';
    if (e.code === 'auth/network-request-failed') msg = 'Sin conexión. Verifica tu internet.';
    errEl.textContent = msg; errEl.classList.add('show');
    btnEl.disabled = false; btnEl.textContent = 'Ingresar';
  }
};

window.doLogout = async () => {
  if (!confirm('¿Cerrar sesión?')) return;
  await signOut(auth);
};

window.togglePass = () => {
  const i = document.getElementById('l-pass');
  const e = document.getElementById('pass-eye');
  i.type = i.type === 'password' ? 'text' : 'password';
  e.textContent = i.type === 'password' ? '👁' : '🙈';
};

document.addEventListener('keydown', e => {
  if (e.key === 'Enter' && document.getElementById('login-screen').style.display !== 'none') {
    window.doLogin();
  }
});

/* ════════════════════════════════════════
   SYNC FIRESTORE
   ════════════════════════════════════════ */
function startSync() {
  setSS('saving','Conectando...');
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('es-PE',{
    weekday:'long', year:'numeric', month:'long', day:'numeric'
  });

  // Obtener tipo de cambio real al arrancar
  fetchTipoCambio();

  unsubC = onSnapshot(
    query(collection(db,'cuentas'), orderBy('creadoEn','desc')),
    snap => {
      cuentas = snap.docs.map(d => ({ _id:d.id, ...d.data() }));
      renderCuentas();
      refreshCuentaSelect();
      renderMetrics();
      setSS('online','Sincronizado');
      document.getElementById('btn-new-cuenta').disabled = false;
      document.getElementById('btn-new-venta').disabled  = false;
    },
    err => { console.error(err); setSS('error','Error de conexión'); }
  );

  unsubV = onSnapshot(
    query(collection(db,'ventas'), orderBy('creadoEn','desc')),
    snap => {
      ventas = snap.docs.map(d => ({ _id:d.id, ...d.data() }));
      autoCorteVencidos();
      renderCuentas();
      renderVentasPerfiles();
      renderVentasCompletas();
      renderMetrics();
      populateMonths();
    },
    err => console.error(err)
  );
}

/* ── AUTO CORTE PENDIENTE (solo una vez, sin duplicar) ── */
async function autoCorteVencidos() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  for (const v of ventas) {
    if (!v.fechaVenc) continue;
    if (v.estado !== 'Activo' && v.estado !== 'Pendiente') continue;
    const venc = new Date(v.fechaVenc+'T00:00:00');
    if (Math.round((venc - hoy) / 86400000) < 0) {
      try { await updateDoc(doc(db,'ventas',v._id), { estado:'Corte pendiente' }); }
      catch(e) { console.error(e); }
    }
  }
}

/* ════════════════════════════════════════
   TABS
   ════════════════════════════════════════ */
window.switchTab = tab => {
  ['perfiles','completas','cuentas'].forEach(t => {
    document.getElementById('panel-'+t).style.display = (t === tab) ? '' : 'none';
    document.getElementById('tab-'+t).classList.toggle('active', t === tab);
  });
};

/* ════════════════════════════════════════
   CUENTAS — MODAL
   ════════════════════════════════════════ */
window.autoFechaVencCuenta = () => {
  const f = document.getElementById('fc-fecha').value;
  if (f) document.getElementById('fc-fechaVenc').value = sumarMes(f);
};

window.openCuentaModal = (id = null) => {
  editCuentaId = id;
  document.getElementById('modal-cuenta-title').textContent = id ? 'Editar Cuenta' : 'Nueva Cuenta';
  document.getElementById('fc-pass').type = 'password';
  document.getElementById('fc-pass-eye').textContent = '👁';
  if (id) {
    const c = cuentas.find(x => x._id === id); if (!c) return;
    document.getElementById('fc-plataforma').value = c.plataforma || 'Netflix';
    document.getElementById('fc-correo').value     = c.correo     || '';
    document.getElementById('fc-pass').value       = c.cpass      || '';
    document.getElementById('fc-notas').value      = c.notas      || '';
    document.getElementById('fc-fecha').value      = c.fecha      || '';
    document.getElementById('fc-fechaVenc').value  = c.fechaVenc  || '';
    document.getElementById('fc-costo').value      = c.costo      || '';
    document.getElementById('fc-moneda').value     = c.moneda     || 'PEN';
  } else {
    ['fc-correo','fc-pass','fc-notas'].forEach(i => document.getElementById(i).value = '');
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fc-plataforma').value = 'Netflix';
    document.getElementById('fc-fecha').value      = hoy;
    document.getElementById('fc-fechaVenc').value  = sumarMes(hoy);
    document.getElementById('fc-costo').value      = '';
    document.getElementById('fc-moneda').value     = 'PEN';
  }
  document.getElementById('modal-cuenta').classList.add('open');
};
window.closeCuentaModal = () => {
  document.getElementById('modal-cuenta').classList.remove('open'); editCuentaId = null;
};
window.handleModalCuentaClick = e => {
  if (e.target === document.getElementById('modal-cuenta')) window.closeCuentaModal();
};
window.toggleFcPass = () => {
  const i = document.getElementById('fc-pass');
  const e = document.getElementById('fc-pass-eye');
  i.type = i.type === 'password' ? 'text' : 'password';
  e.textContent = i.type === 'password' ? '👁' : '🙈';
};

window.saveCuenta = async () => {
  const correo = document.getElementById('fc-correo').value.trim();
  const plat   = document.getElementById('fc-plataforma').value;
  if (!correo || !plat) { alert('Completa plataforma y correo.'); return; }
  const bs = document.getElementById('btn-save-cuenta');
  bs.disabled = true; bs.textContent = 'Guardando...'; setSS('saving','Guardando...');
  const rec = {
    plataforma: plat,
    correo,
    cpass:     document.getElementById('fc-pass').value,
    notas:     document.getElementById('fc-notas').value.trim(),
    fecha:     document.getElementById('fc-fecha').value || '',
    fechaVenc: document.getElementById('fc-fechaVenc').value || '',
    costo:     parseFloat(document.getElementById('fc-costo').value) || 0,
    moneda:    document.getElementById('fc-moneda').value || 'PEN',
  };
  try {
    if (editCuentaId) await updateDoc(doc(db,'cuentas',editCuentaId), rec);
    else { rec.creadoEn = serverTimestamp(); await addDoc(collection(db,'cuentas'), rec); }
    window.closeCuentaModal();
  } catch(e) { console.error(e); alert('Error al guardar.'); setSS('error','Error'); }
  finally { bs.disabled = false; bs.textContent = 'Guardar'; }
};

window.deleteCuenta = async id => {
  const usadas = ventas.filter(v => v.cuentaId === id).length;
  if (usadas > 0) { alert(`Esta cuenta tiene ${usadas} venta(s) asociada(s). Elimínalas primero.`); return; }
  if (!confirm('¿Eliminar esta cuenta?')) return;
  try { await deleteDoc(doc(db,'cuentas',id)); } catch(e) { alert('Error al eliminar.'); }
};

window.marcarCuentaCaida = async id => {
  if (!confirm('¿Marcar esta cuenta como caída? Se notificará el estado a todos los perfiles vinculados.')) return;
  setSS('saving','Guardando...');
  try {
    await updateDoc(doc(db,'cuentas',id), { estado: 'caida' });
    // Marcar todas las ventas activas de esta cuenta como "Corte pendiente"
    const ventasAfectadas = ventas.filter(v =>
      (v.cuentaId === id) && (v.estado === 'Activo' || v.estado === 'Pendiente')
    );
    for (const v of ventasAfectadas) {
      await updateDoc(doc(db,'ventas',v._id), { estado: 'Corte pendiente' });
    }
    setSS('online','Sincronizado');
  } catch(e) { console.error(e); alert('Error.'); setSS('error','Error'); }
};

window.restaurarCuenta = async id => {
  if (!confirm('¿Restaurar la cuenta? Se marcará como activa nuevamente.')) return;
  setSS('saving','Guardando...');
  try {
    await updateDoc(doc(db,'cuentas',id), { estado: 'activa' });
    setSS('online','Sincronizado');
  } catch(e) { console.error(e); alert('Error.'); setSS('error','Error'); }
};

window.renovarCuenta = async id => {
  const c = cuentas.find(x => x._id === id); if (!c) return;
  if (!confirm(`¿Renovar esta cuenta de ${c.plataforma}? La fecha de vencimiento se extenderá +1 mes desde hoy.`)) return;
  const hoy = new Date().toISOString().split('T')[0];
  setSS('saving','Guardando...');
  try {
    await updateDoc(doc(db,'cuentas',id), {
      fecha:     hoy,
      fechaVenc: sumarMes(hoy),
      estado:    'activa',
    });
    setSS('online','Sincronizado');
  } catch(e) { console.error(e); alert('Error al renovar.'); setSS('error','Error'); }
};

/* ── RENDER CUENTAS (tarjetas) ── */
function renderCuentas() {
  const q    = (document.getElementById('search-cuentas')?.value || '').toLowerCase();
  const filt = document.getElementById('filter-plat-cuentas')?.value || '';
  const list = cuentas.filter(c => {
    const mQ = !q || (c.plataforma||'').toLowerCase().includes(q) || (c.correo||'').toLowerCase().includes(q);
    const mP = !filt || c.plataforma === filt;
    return mQ && mP;
  });
  const grid = document.getElementById('cuentas-grid');
  if (!list.length) {
    grid.innerHTML = '<p style="color:var(--text3);font-size:14px;padding:2rem 0">No hay cuentas registradas.</p>';
    return;
  }
  grid.innerHTML = list.map(c => {
    const k = pKey(c.plataforma);

    // Ventas directamente vinculadas a esta cuenta por ID
    const ventasVinculadas = ventas.filter(v => v.cuentaId === c._id);

    // Ventas antiguas sin cuentaId de la misma plataforma
    const ventasSinVincular = ventas.filter(v =>
      (!v.cuentaId || v.cuentaId === '') && v.plataforma === c.plataforma
    );

    // Cuántas cuentas hay de esta plataforma para repartir las ventas sin vincular
    const nCuentasMismaPlat = cuentas.filter(cc => cc.plataforma === c.plataforma).length;

    // Si solo hay UNA cuenta de esa plataforma, le asignamos todas las sin vincular
    // Si hay VARIAS, solo mostramos las directamente vinculadas por ID
    const ventasDeCuenta = nCuentasMismaPlat === 1
      ? [...ventasVinculadas, ...ventasSinVincular]
      : ventasVinculadas;

    const nV       = ventasDeCuenta.length;
    const nActivos = ventasDeCuenta.filter(v => v.estado === 'Activo').length;
    const nVActivos = ventasDeCuenta.filter(v =>
      v.estado === 'Activo' || v.estado === 'Pendiente' || v.estado === 'Corte pendiente'
    ).length;
    const correoSafe = (c.correo||'').replace(/'/g,"\\'");
    const cpassSafe  = (c.cpass ||'').replace(/'/g,"\\'");

    // Fechas con indicador de vencimiento
    const diasV = diasRestantes(c.fechaVenc);
    const cuentaEstaVencida = c.fechaVenc && diasV < 0;
    let vencTag = '';
    if (c.fechaVenc) {
      if (diasV < 0)       vencTag = `<span class="venc-tag venc-expirado">⚠ ${fmtFecha(c.fechaVenc)}</span>`;
      else if (diasV <= 3) vencTag = `<span class="venc-tag venc-urgente">🔥 ${fmtFecha(c.fechaVenc)} (${diasV}d)</span>`;
      else if (diasV <= 7) vencTag = `<span class="venc-tag venc-proximo">⏰ ${fmtFecha(c.fechaVenc)} (${diasV}d)</span>`;
      else                 vencTag = `<span class="venc-tag venc-ok">✓ ${fmtFecha(c.fechaVenc)}</span>`;
    }

    // Banner de alerta si la cuenta está vencida y tiene perfiles activos
    const alertaBanner = (cuentaEstaVencida && nVActivos > 0)
      ? `<div class="cuenta-vencida-banner">⚠ Esta cuenta está vencida y tiene <strong>${nVActivos} perfil${nVActivos!==1?'es':''} activo${nVActivos!==1?'s':''}</strong>. Renueva la cuenta o reasigna los perfiles.</div>`
      : '';

    // Estado caída
    const estaCaida = c.estado === 'caida';

    // Banner según estado
    const bannerCaida = estaCaida
      ? `<div class="cuenta-caida-banner">💥 Esta cuenta está caída. Los perfiles vinculados no funcionan.</div>`
      : '';

    // Botón renovar: aparece 3-4 días antes del vencimiento (y no está caída)
    const mostrarRenovarCuenta = !estaCaida && c.fechaVenc && diasV !== null && diasV >= 0 && diasV <= 4;
    const renovarCuentaBtn = mostrarRenovarCuenta
      ? `<button class="btn-cuenta-accion btn-renovar-cuenta" onclick="renovarCuenta('${c._id}')">↻ Renovar</button>`
      : '';

    // Botón caída: solo si no está ya caída
    const caidaBtn = !estaCaida
      ? `<button class="btn-cuenta-accion btn-caida-cuenta" onclick="marcarCuentaCaida('${c._id}')">💥 Cuenta caída</button>`
      : `<button class="btn-cuenta-accion btn-restaurar-cuenta" onclick="restaurarCuenta('${c._id}')">✓ Restaurar</button>`;

    return `
    <div class="cuenta-card${cuentaEstaVencida ? ' cuenta-card-vencida' : ''}${estaCaida ? ' cuenta-card-caida' : ''}">
      ${alertaBanner}
      ${bannerCaida}
      <div class="cuenta-card-head">
        <div class="cuenta-card-plat">
          <span class="badge p-${k}"><span class="badge-dot"></span>${c.plataforma}</span>
          ${estaCaida ? '<span class="badge-caida">💥 Caída</span>' : ''}
        </div>
        <div style="display:flex;gap:6px;align-items:center">
          ${nActivos > 0 ? `<span class="cuenta-activos-badge">✅ ${nActivos} activo${nActivos!==1?'s':''}</span>` : ''}
          <span class="cuenta-perfiles-count">${nV} venta${nV!==1?'s':''}</span>
        </div>
      </div>
      <div class="cuenta-field">
        <span class="cuenta-field-label">Correo</span>
        <span class="cuenta-field-val">
          ${c.correo||'—'}
          <button class="copy-btn" onclick="copyDirect('${correoSafe}')">⧉</button>
        </span>
      </div>
      <div class="cuenta-field">
        <span class="cuenta-field-label">Contraseña</span>
        <span class="cuenta-field-val">
          <span id="cp-card-${c._id}" class="cuenta-pass-hidden" data-real="${(c.cpass||'').replace(/"/g,'&quot;')}">••••••••</span>
          <button class="copy-btn" onclick="toggleCardPass('${c._id}')">👁</button>
          <button class="copy-btn" onclick="copyDirect('${cpassSafe}')">⧉</button>
        </span>
      </div>
      ${c.fecha ? `
      <div class="cuenta-field">
        <span class="cuenta-field-label">Creación</span>
        <span class="cuenta-field-val">${fmtFecha(c.fecha)}</span>
      </div>` : ''}
      ${c.fechaVenc ? `
      <div class="cuenta-field">
        <span class="cuenta-field-label">Vence</span>
        <span class="cuenta-field-val">${vencTag}</span>
      </div>` : ''}
      <div class="cuenta-field">
        <span class="cuenta-field-label">Costo</span>
        <span class="cuenta-field-val">
          ${(c.costo === 0 || c.costo === '0' || !c.costo)
            ? '<span class="costo-gratis">Gratis</span>'
            : `<span class="costo-valor">${c.moneda === 'USD' ? 'USD ' : 'S/. '}${parseFloat(c.costo).toFixed(2)}</span>`
          }
        </span>
      </div>
      ${c.notas ? `<div class="cuenta-notas">📝 ${c.notas}</div>` : ''}
      <div class="cuenta-actions">
        ${renovarCuentaBtn}
        ${caidaBtn}
        <button class="icon-btn" title="Editar" onclick="openCuentaModal('${c._id}')">✏</button>
        <button class="icon-btn del" title="Eliminar" onclick="deleteCuenta('${c._id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

window.toggleCardPass = id => {
  const el = document.getElementById('cp-card-'+id); if (!el) return;
  if (el.textContent === '••••••••') { el.textContent = el.dataset.real; el.style.letterSpacing = 'normal'; }
  else { el.textContent = '••••••••'; el.style.letterSpacing = '3px'; }
};
window.copyDirect = text => {
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea'); ta.value = text;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  });
};

/* ── REFRESCAR SELECT DE CUENTAS (en modal venta y renovación) ── */
function getCuentasDisponibles(excluirVentaId = null) {
  // Cuentas ya vendidas como completa activa/pendiente (por ID o por plataforma fallback)
  const cuentasCompletas = new Set(
    ventas
      .filter(v => v.tipo === 'cuenta' && (v.estado === 'Activo' || v.estado === 'Pendiente'))
      .map(v => v.cuentaId)
      .filter(Boolean)
  );
  return cuentas.filter(c => {
    // Excluir cuentas vencidas
    if (c.fechaVenc) {
      const hoy  = new Date(); hoy.setHours(0,0,0,0);
      const venc = new Date(c.fechaVenc+'T00:00:00');
      if (venc < hoy) return false;
    }
    // Excluir cuentas ya vendidas completas (salvo la de la venta que editamos)
    if (cuentasCompletas.has(c._id)) {
      const ventaActual = excluirVentaId ? ventas.find(v => v._id === excluirVentaId) : null;
      if (!ventaActual || ventaActual.cuentaId !== c._id) return false;
    }
    return true;
  });
}

function refreshCuentaSelect(excluirVentaId = null) {
  const sel = document.getElementById('fv-cuenta-id'); if (!sel) return;
  const cur = sel.value;
  sel.innerHTML = '<option value="">— Selecciona una cuenta —</option>';
  getCuentasDisponibles(excluirVentaId).forEach(c => {
    const opt = document.createElement('option');
    opt.value = c._id;
    opt.textContent = `${c.plataforma} — ${c.correo}`;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

/* ── MODAL DE RENOVACIÓN ── */
window.renovarVenta = id => {
  const v = ventas.find(x => x._id === id); if (!v) return;

  // Construir lista de cuentas disponibles para cambio (misma plataforma, no vencidas)
  const disponibles = getCuentasDisponibles(id)
    .filter(c => c.plataforma === v.plataforma);

  const cuentaActual = cuentas.find(c => c._id === v.cuentaId);
  const cuentaVencida = cuentaActual?.fechaVenc
    ? new Date(cuentaActual.fechaVenc+'T00:00:00') < new Date()
    : false;

  // Construir opciones del select de cambio de cuenta
  const optsHtml = disponibles
    .map(c => `<option value="${c._id}" ${c._id === v.cuentaId ? 'selected' : ''}>${c.plataforma} — ${c.correo}</option>`)
    .join('');

  // Mostrar modal de renovación
  const modal = document.getElementById('modal-renovar');
  document.getElementById('renovar-info').innerHTML =
    `<strong style="color:var(--text)">${v.numero}</strong> · ${v.plataforma}${v.perfil && v.perfil !== 'Cuenta completa' ? ' · '+v.perfil : ''}`;

  const selectWrap = document.getElementById('renovar-cuenta-wrap');
  const selectEl   = document.getElementById('renovar-cuenta-id');
  selectEl.innerHTML = optsHtml || '<option value="">Sin cuentas disponibles</option>';

  // Si la cuenta actual está vencida, mostrar advertencia y forzar cambio
  const avisoEl = document.getElementById('renovar-aviso');
  if (cuentaVencida) {
    avisoEl.style.display = '';
    avisoEl.textContent   = '⚠ La cuenta actual está vencida. Debes seleccionar una cuenta nueva.';
    // Preseleccionar la primera disponible que no sea la actual
    const otra = disponibles.find(c => c._id !== v.cuentaId);
    if (otra) selectEl.value = otra._id;
    else selectEl.value = '';
  } else {
    avisoEl.style.display = 'none';
  }

  selectWrap.style.display = '';
  modal.dataset.ventaId = id;
  modal.classList.add('open');
};

window.confirmarRenovacion = async () => {
  const modal     = document.getElementById('modal-renovar');
  const id        = modal.dataset.ventaId;
  const nuevaCuentaId = document.getElementById('renovar-cuenta-id').value;
  if (!nuevaCuentaId) { alert('Selecciona una cuenta para renovar.'); return; }

  const hoy        = new Date().toISOString().split('T')[0];
  const nuevaVenc  = sumarMes(hoy);
  const cuenta     = cuentas.find(c => c._id === nuevaCuentaId);
  const v          = ventas.find(x => x._id === id);

  setSS('saving','Renovando...');
  try {
    await updateDoc(doc(db,'ventas',id), {
      estado:    'Activo',
      fecha:     hoy,
      fechaVenc: nuevaVenc,
      cuentaId:  nuevaCuentaId,
      plataforma: cuenta?.plataforma || v?.plataforma || '',
    });
    modal.classList.remove('open');
  } catch(e) { console.error(e); alert('Error al renovar.'); setSS('error','Error'); }
};

window.cerrarRenovarModal = () => {
  document.getElementById('modal-renovar').classList.remove('open');
};
window.openVentaModal = (id = null) => {
  editVentaId = id;
  document.getElementById('modal-venta-title').textContent = id ? 'Editar Venta' : 'Nueva Venta';
  refreshCuentaSelect(id);
  if (id) {
    const v = ventas.find(x => x._id === id); if (!v) return;
    document.getElementById('fv-numero').value    = v.numero    || '';
    document.getElementById('fv-tipo').value      = v.tipo      || 'perfil';
    document.getElementById('fv-cuenta-id').value = v.cuentaId  || '';
    document.getElementById('fv-perfil').value    = v.perfil    || '';
    document.getElementById('fv-fecha').value     = v.fecha     || '';
    document.getElementById('fv-fechaVenc').value = v.fechaVenc || '';
    document.getElementById('fv-precio').value    = v.precio    || '';
    document.getElementById('fv-estado').value    = v.estado    || 'Activo';
    document.getElementById('fv-notas').value     = v.notas     || '';
  } else {
    ['fv-numero','fv-perfil','fv-notas'].forEach(i => document.getElementById(i).value = '');
    const hoy = new Date().toISOString().split('T')[0];
    document.getElementById('fv-fecha').value     = hoy;
    document.getElementById('fv-fechaVenc').value = sumarMes(hoy);
    document.getElementById('fv-precio').value    = '';
    document.getElementById('fv-tipo').value      = 'perfil';
    document.getElementById('fv-cuenta-id').value = '';
    document.getElementById('fv-estado').value    = 'Activo';
  }
  onVentaTipoChange();
  document.getElementById('modal-venta').classList.add('open');
};
window.closeVentaModal = () => {
  document.getElementById('modal-venta').classList.remove('open'); editVentaId = null;
};
window.handleModalVentaClick = e => {
  if (e.target === document.getElementById('modal-venta')) window.closeVentaModal();
};
window.onVentaTipoChange = () => {
  const tipo = document.getElementById('fv-tipo').value;
  const grp  = document.getElementById('fv-group-perfil');
  const inp  = document.getElementById('fv-perfil');
  if (tipo === 'cuenta') { grp.style.display = 'none'; inp.value = 'Cuenta completa'; }
  else { grp.style.display = ''; if (inp.value === 'Cuenta completa') inp.value = ''; }
};
window.onCuentaVinculadaChange = () => {};
window.autoFechaVenc = () => {
  const f = document.getElementById('fv-fecha').value;
  if (f) document.getElementById('fv-fechaVenc').value = sumarMes(f);
};

window.saveVenta = async () => {
  const numero    = document.getElementById('fv-numero').value.trim();
  const cuentaId  = document.getElementById('fv-cuenta-id').value;
  const tipo      = document.getElementById('fv-tipo').value;
  const perfil    = document.getElementById('fv-perfil').value.trim();
  const fecha     = document.getElementById('fv-fecha').value;
  const fechaVenc = document.getElementById('fv-fechaVenc').value;
  if (!numero || !cuentaId || !fecha) { alert('Completa: N° contacto, cuenta vinculada y fecha de venta.'); return; }
  if (tipo === 'perfil' && !perfil)   { alert('Escribe el nombre del perfil.'); return; }

  const cuenta = cuentas.find(c => c._id === cuentaId);
  const bs = document.getElementById('btn-save-venta');
  bs.disabled = true; bs.textContent = 'Guardando...'; setSS('saving','Guardando...');

  // Auto-detectar si ya está vencida
  let estadoFinal = document.getElementById('fv-estado').value;
  if (fechaVenc) {
    const hoy  = new Date(); hoy.setHours(0,0,0,0);
    const venc = new Date(fechaVenc+'T00:00:00');
    if (venc < hoy && estadoFinal === 'Activo') estadoFinal = 'Corte pendiente';
  }

  const rec = {
    numero, cuentaId,
    plataforma: cuenta?.plataforma || '',
    tipo,
    perfil:     tipo === 'cuenta' ? 'Cuenta completa' : perfil,
    fecha, fechaVenc,
    precio:  parseFloat(document.getElementById('fv-precio').value) || 0,
    estado:  estadoFinal,
    notas:   document.getElementById('fv-notas').value.trim(),
  };
  try {
    if (editVentaId) await updateDoc(doc(db,'ventas',editVentaId), rec);
    else { rec.creadoEn = serverTimestamp(); await addDoc(collection(db,'ventas'), rec); }
    window.closeVentaModal();
  } catch(e) { console.error(e); alert('Error al guardar.'); setSS('error','Error'); }
  finally { bs.disabled = false; bs.textContent = 'Guardar'; }
};

window.deleteVenta = async id => {
  if (!confirm('¿Eliminar esta venta?')) return;
  setSS('saving','Eliminando...');
  try { await deleteDoc(doc(db,'ventas',id)); }
  catch(e) { alert('Error al eliminar.'); setSS('error','Error'); }
};

window.confirmarCorte = async id => {
  if (!confirm('¿Confirmar que ya realizaste el corte del servicio a este cliente?')) return;
  setSS('saving','Guardando...');
  try { await updateDoc(doc(db,'ventas',id), { estado:'Corte' }); }
  catch(e) { console.error(e); alert('Error.'); setSS('error','Error'); }
};

/* ════════════════════════════════════════
   VENTAS — RENDER (3 pestañas)
   ════════════════════════════════════════ */
window.sortVentas = (col, tipo) => {
  const s = sortState[tipo];
  if (s.col === col) s.dir *= -1; else { s.col = col; s.dir = -1; }
  tipo === 'perfil' ? renderVentasPerfiles() : renderVentasCompletas();
};
window.changeVentasPage = (d, tipo) => {
  sortState[tipo].page = Math.max(0, sortState[tipo].page + d);
  tipo === 'perfil' ? renderVentasPerfiles() : renderVentasCompletas();
};

function getVentasFiltradas(tipo) {
  const suffix = tipo === 'perfil' ? '-perfiles' : '-completas';
  const q  = (document.getElementById('search'+suffix)?.value || '').toLowerCase();
  const pl = document.getElementById('filter-platform'+suffix)?.value || '';
  const st = document.getElementById('filter-status'+suffix)?.value || '';
  const mo = document.getElementById('filter-month'+suffix)?.value || '';
  const s  = sortState[tipo];
  return ventas
    .filter(v => {
      if (v.tipo !== tipo) return false;
      const cuenta = cuentas.find(c => c._id === v.cuentaId);
      const mQ = !q || (v.numero||'').toLowerCase().includes(q)
                    || (v.perfil||'').toLowerCase().includes(q)
                    || (v.plataforma||'').toLowerCase().includes(q)
                    || (cuenta?.correo||'').toLowerCase().includes(q);
      const mP = !pl || v.plataforma === pl;
      const mS = !st || v.estado === st;
      const mM = !mo || (v.fecha||'').startsWith(mo);
      return mQ && mP && mS && mM;
    })
    .sort((a,b) => {
      let va = a[s.col]||'', vb = b[s.col]||'';
      if (s.col === 'precio') { va = parseFloat(va)||0; vb = parseFloat(vb)||0; }
      return va < vb ? -s.dir : va > vb ? s.dir : 0;
    });
}

function buildVentaRow(v, tipo) {
  const cuenta  = cuentas.find(c => c._id === v.cuentaId);
  const k       = pKey(v.plataforma);
  const sl      = v.estado === 'Activo'          ? 's-active'
                : v.estado === 'Pendiente'        ? 's-pending'
                : v.estado === 'Corte pendiente'  ? 's-corte-pendiente'
                : v.estado === 'Corte'            ? 's-corte'
                : 's-expired';
  const pr      = v.precio ? `S/. ${parseFloat(v.precio).toFixed(2)}` : '—';
  const fe      = fmtFecha(v.fecha);
  const dias    = diasRestantes(v.fechaVenc);
  const fvStr   = fmtFecha(v.fechaVenc);

  let vencCell = '—';
  if (v.fechaVenc) {
    if (dias < 0)       vencCell = `<span class="venc-tag venc-expirado">⚠ ${fvStr}</span>`;
    else if (dias <= 3) vencCell = `<span class="venc-tag venc-urgente">🔥 ${fvStr} (${dias}d)</span>`;
    else if (dias <= 7) vencCell = `<span class="venc-tag venc-proximo">⏰ ${fvStr} (${dias}d)</span>`;
    else                vencCell = `<span class="venc-tag venc-ok">✓ ${fvStr}</span>`;
  }

  const correoSafe = (cuenta?.correo||'').replace(/'/g,"\\'");
  const cpassSafe  = (cuenta?.cpass ||'').replace(/'/g,"\\'");
  const platSafe   = (v.plataforma ||'').replace(/'/g,"\\'");

  // Detectar si la cuenta vinculada está vencida
  const cuentaVencida = cuenta?.fechaVenc
    ? new Date(cuenta.fechaVenc+'T00:00:00') < new Date()
    : false;

  const credBtn = cuenta
    ? `<div style="display:flex;flex-direction:column;gap:4px;align-items:flex-start">
        <button class="cred-btn" onclick="showCredentials('${correoSafe}','${cpassSafe}','${platSafe}')">🔑 Ver</button>
        ${cuentaVencida ? `<span class="cuenta-vencida-warn">⚠ Cuenta vencida</span>` : ''}
       </div>`
    : '<span style="color:var(--text3);font-size:12px">Sin cuenta</span>';

  // Renovar: aparece en Corte/Corte pendiente O cuando faltan ≤3 días (Activo)
  const mostrarRenovar = v.estado === 'Corte pendiente'
    || v.estado === 'Corte'
    || (v.estado === 'Activo' && dias !== null && dias <= 3);

  const renovarBtn = mostrarRenovar
    ? `<button class="icon-btn renew" title="Renovar (+1 mes)" onclick="renovarVenta('${v._id}')">↻</button>` : '';
  const corteBtn = v.estado === 'Corte pendiente'
    ? `<button class="icon-btn corte" title="Confirmar corte" onclick="confirmarCorte('${v._id}')">✂</button>` : '';

  const perfilCell = tipo === 'perfil' ? `<td>${v.perfil||'—'}</td>` : '';
  const cols       = tipo === 'perfil' ? 9 : 8;
  const rowId      = 'nota-row-'+v._id;

  // Botón nota solo si tiene nota
  const notaBtn = v.notas
    ? `<button class="icon-btn nota-toggle" title="Ver nota" onclick="toggleNota('${v._id}')">📝</button>`
    : '';

  // Fila expandible de nota (oculta por defecto)
  const notaRow = v.notas ? `
  <tr id="${rowId}" class="nota-expandida" style="display:none">
    <td colspan="${cols}" class="nota-expandida-cell">
      <span class="nota-expandida-label">📝 Nota:</span> ${v.notas}
    </td>
  </tr>` : '';

  return `<tr class="venta-row" onclick="toggleNota('${v._id}')" style="cursor:${v.notas?'pointer':'default'}">
    <td class="td-num" title="${v.numero||''}">${v.numero||'—'}</td>
    <td><span class="badge p-${k}"><span class="badge-dot"></span>${v.plataforma||'—'}</span></td>
    ${perfilCell}
    <td>${credBtn}</td>
    <td>${fe}</td>
    <td>${vencCell}</td>
    <td class="td-price">${pr}</td>
    <td><span class="status ${sl}">${v.estado||'—'}</span></td>
    <td><div class="actions" onclick="event.stopPropagation()">${corteBtn}${renovarBtn}
      <button class="icon-btn" title="Editar" onclick="openVentaModal('${v._id}')">✏</button>
      <button class="icon-btn del" title="Eliminar" onclick="deleteVenta('${v._id}')">✕</button>
    </div></td>
  </tr>${notaRow}`;
}

function renderTabla(tipo) {
  const rows   = getVentasFiltradas(tipo);
  const s      = sortState[tipo];
  const total  = rows.length;
  const suffix = tipo === 'perfil' ? 'perfiles' : 'completas';
  const cols   = tipo === 'perfil' ? 9 : 8;
  if (s.page*PS >= total && s.page > 0) s.page = Math.max(0, Math.ceil(total/PS)-1);
  const slice = rows.slice(s.page*PS, s.page*PS+PS);
  const tbody = document.getElementById(suffix+'-body');
  document.getElementById(suffix+'-count').textContent = `${total} registro${total!==1?'s':''}`;
  tbody.innerHTML = slice.length
    ? slice.map(v => buildVentaRow(v, tipo)).join('')
    : `<tr class="empty-row"><td colspan="${cols}">No hay registros.</td></tr>`;
  const from = total ? s.page*PS+1 : 0;
  const to   = Math.min(s.page*PS+PS, total);
  document.getElementById(suffix+'-page-info').textContent = total ? `${from}–${to} de ${total}` : '0 registros';
  document.getElementById('prev-'+suffix).disabled = s.page === 0;
  document.getElementById('next-'+suffix).disabled = (s.page+1)*PS >= total;
}

function renderVentasPerfiles()  { renderTabla('perfil'); }
function renderVentasCompletas() { renderTabla('cuenta'); }

/* ── TOGGLE NOTA EXPANDIBLE ── */
window.toggleNota = id => {
  const row = document.getElementById('nota-row-'+id);
  if (!row) return;
  const visible = row.style.display !== 'none';
  row.style.display = visible ? 'none' : 'table-row';
};

/* ════════════════════════════════════════
   POPUP CREDENCIALES
   ════════════════════════════════════════ */
window.showCredentials = (correo, cpass, plat) => {
  document.getElementById('cred-popup-title').textContent = '🔑 '+plat;
  document.getElementById('cp-correo').textContent = correo || '(sin correo)';
  const passEl = document.getElementById('cp-pass');
  passEl.dataset.real = cpass || '(sin contraseña)';
  passEl.textContent  = '••••••••';
  document.getElementById('cp-eye-btn').textContent = '👁';
  document.getElementById('copy-toast').classList.remove('show');
  document.getElementById('cred-popup').classList.add('open');
};
window.closeCredPopup = e => {
  if (!e || e.target === document.getElementById('cred-popup')) {
    document.getElementById('cred-popup').classList.remove('open');
  }
};
window.toggleCredPass = () => {
  const el  = document.getElementById('cp-pass');
  const btn = document.getElementById('cp-eye-btn');
  if (el.textContent === '••••••••') { el.textContent = el.dataset.real; btn.textContent = '🙈'; }
  else { el.textContent = '••••••••'; btn.textContent = '👁'; }
};
window.copyText = (elId, isPass) => {
  const el    = document.getElementById(elId);
  const text  = isPass ? el.dataset.real : el.textContent;
  const toast = document.getElementById('copy-toast');
  navigator.clipboard.writeText(text).catch(() => {
    const ta = document.createElement('textarea'); ta.value = text;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  });
  toast.classList.add('show'); setTimeout(() => toast.classList.remove('show'), 1800);
};

/* ════════════════════════════════════════
   TIPO DE CAMBIO USD → PEN (en tiempo real)
   Caché diario en localStorage
   ════════════════════════════════════════ */
const XR_KEY       = '8b88142bd1e04c033ff27cd2';
const XR_CACHE_KEY = 'tronixx_usd_pen_rate';
let tipoCambio     = 3.7; // valor por defecto mientras carga

async function fetchTipoCambio() {
  try {
    const cached = JSON.parse(localStorage.getItem(XR_CACHE_KEY) || 'null');
    const hoy    = new Date().toISOString().split('T')[0];
    // Usar caché si es del mismo día
    if (cached && cached.fecha === hoy) {
      tipoCambio = cached.rate;
      return;
    }
    const res  = await fetch(`https://v6.exchangerate-api.com/v6/${XR_KEY}/pair/USD/PEN`);
    const data = await res.json();
    if (data.result === 'success') {
      tipoCambio = data.conversion_rate;
      localStorage.setItem(XR_CACHE_KEY, JSON.stringify({ fecha: hoy, rate: tipoCambio }));
    }
  } catch(e) {
    console.warn('No se pudo obtener tipo de cambio, usando S/. 3.70:', e);
  }
}

/* ════════════════════════════════════════
   MÉTRICAS
   ════════════════════════════════════════ */
function renderMetrics() {
  const total     = ventas.length;
  const activos   = ventas.filter(x => x.estado === 'Activo').length;
  const cortePend = ventas.filter(x => x.estado === 'Corte pendiente').length;
  const pendiente = ventas.filter(x => x.estado === 'Pendiente').length;
  const porVencer = ventas.filter(x => {
    const d = diasRestantes(x.fechaVenc);
    return d !== null && d >= 0 && d <= 7 && x.estado === 'Activo';
  }).length;

  // Ingresos: ventas cobradas (no pendientes)
  const ingresos = ventas
    .filter(x => x.estado !== 'Pendiente')
    .reduce((s,v) => s + (parseFloat(v.precio)||0), 0);

  // Gastos: costos de cuentas, USD convertido al tipo de cambio real
  const gastos = cuentas.reduce((s,c) => {
    const costo = parseFloat(c.costo) || 0;
    if (costo === 0) return s;
    return s + (c.moneda === 'USD' ? costo * tipoCambio : costo);
  }, 0);

  const ganancia = ingresos - gastos;

  document.getElementById('metrics').innerHTML = `
    <div class="metric"><div class="metric-icon">📋</div><div class="metric-label">Total ventas</div><div class="metric-value">${total}</div><div class="metric-sub">registros</div></div>
    <div class="metric"><div class="metric-icon">✅</div><div class="metric-label">Activos</div><div class="metric-value green">${activos}</div><div class="metric-sub">perfiles activos</div></div>
    <div class="metric"><div class="metric-icon">✂</div><div class="metric-label">Corte pendiente</div><div class="metric-value red">${cortePend}</div><div class="metric-sub">sin cortar</div></div>
    <div class="metric"><div class="metric-icon">⏳</div><div class="metric-label">Pendientes</div><div class="metric-value yellow">${pendiente}</div><div class="metric-sub">por cobrar</div></div>
    <div class="metric"><div class="metric-icon">💰</div><div class="metric-label">Ingresos</div><div class="metric-value">S/. ${ingresos.toFixed(2)}</div><div class="metric-sub">cobrado</div></div>
    <div class="metric"><div class="metric-icon">🛒</div><div class="metric-label">Gastos</div><div class="metric-value red">S/. ${gastos.toFixed(2)}</div><div class="metric-sub">1 USD = S/. ${tipoCambio.toFixed(3)}</div></div>
    <div class="metric"><div class="metric-icon">📈</div><div class="metric-label">Ganancia neta</div><div class="metric-value ${ganancia >= 0 ? 'green' : 'red'}">S/. ${ganancia.toFixed(2)}</div><div class="metric-sub">${ganancia >= 0 ? 'utilidad' : 'pérdida'}</div></div>
    <div class="metric"><div class="metric-icon">🔔</div><div class="metric-label">Por vencer</div><div class="metric-value ${porVencer>0?'yellow':''}">${porVencer}</div><div class="metric-sub">en 7 días</div></div>`;
}

/* ════════════════════════════════════════
   FILTRO POR MES
   ════════════════════════════════════════ */
function populateMonths() {
  const seen = {}, months = [];
  ventas.forEach(v => {
    if (v.fecha) { const m = v.fecha.slice(0,7); if (!seen[m]) { seen[m]=true; months.push(m); } }
  });
  months.sort().reverse();
  ['filter-month-perfiles','filter-month-completas'].forEach(selId => {
    const sel = document.getElementById(selId); if (!sel) return;
    const cur = sel.value;
    while (sel.options.length > 1) sel.remove(1);
    months.forEach(m => {
      const [y,mo] = m.split('-');
      const lbl = new Date(parseInt(y),parseInt(mo)-1,1).toLocaleDateString('es-PE',{month:'long',year:'numeric'});
      const opt = document.createElement('option');
      opt.value = m; opt.textContent = lbl.charAt(0).toUpperCase()+lbl.slice(1);
      sel.appendChild(opt);
    });
    if (cur) sel.value = cur;
  });
}

/* ════════════════════════════════════════
   EXPORTAR CSV
   ════════════════════════════════════════ */
window.exportCSV = (tipo = 'perfil') => {
  const rows = getVentasFiltradas(tipo);
  const cols = tipo === 'perfil'
    ? ['N° Contacto','Plataforma','Perfil','Correo Cuenta','F.Venta','F.Vencimiento','Precio(S/.)','Estado','Notas']
    : ['N° Contacto','Plataforma','Correo Cuenta','F.Venta','F.Vencimiento','Precio(S/.)','Estado','Notas'];
  const lines = [cols.join(','), ...rows.map(v => {
    const c = cuentas.find(x => x._id === v.cuentaId);
    const base = [v.numero||'', v.plataforma||'', c?.correo||'', v.fecha||'', v.fechaVenc||'', v.precio||0, v.estado||'', v.notas||''];
    if (tipo === 'perfil') base.splice(2, 0, v.perfil||'');
    return base.map(x => `"${String(x).replace(/"/g,'""')}"`).join(',');
  })];
  const blob = new Blob(['\uFEFF'+lines.join('\n')], {type:'text/csv;charset=utf-8;'});
  const a = document.createElement('a');
  a.href = URL.createObjectURL(blob);
  a.download = `tronixx_ventas_${tipo}_${new Date().toISOString().split('T')[0]}.csv`;
  a.click();
};

/* ════════════════════════════════════════
   INICIALIZACIÓN
   ════════════════════════════════════════ */
document.addEventListener('DOMContentLoaded', () => {
  // Poblar select de plataforma en modal de nueva cuenta
  const formSelC = document.getElementById('fc-plataforma');
  PLATFORMS.forEach(p => {
    const o = document.createElement('option'); o.value = p; o.textContent = p; formSelC.appendChild(o);
  });

  // Poblar filtros de plataforma y conectar eventos al instante
  const filterMap = {
    'filter-platform-perfiles':  () => renderVentasPerfiles(),
    'filter-platform-completas': () => renderVentasCompletas(),
    'filter-plat-cuentas':       () => renderCuentas(),
  };
  Object.entries(filterMap).forEach(([selId, fn]) => {
    const sel = document.getElementById(selId); if (!sel) return;
    while (sel.options.length > 1) sel.remove(1);
    // Ordenar plataformas alfabéticamente en el filtro
    [...PLATFORMS].sort().forEach(p => {
      const o = document.createElement('option'); o.value = p; o.textContent = p; sel.appendChild(o);
    });
    // Conectar evento — dispara el render inmediatamente al cambiar
    sel.addEventListener('change', fn);
  });

  document.getElementById('btn-new-cuenta').disabled = true;
  document.getElementById('btn-new-venta').disabled  = true;
});
