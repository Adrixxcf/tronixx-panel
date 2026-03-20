/* ═══════════════════════════════════════════════
   TRONIXX STREAMING — app.js
   Dos colecciones: "cuentas" y "ventas"
   ═══════════════════════════════════════════════ */

import { initializeApp }                         from "https://www.gstatic.com/firebasejs/10.12.0/firebase-app.js";
import { getFirestore, collection, onSnapshot,
         addDoc, updateDoc, deleteDoc,
         doc, serverTimestamp, query,
         orderBy }                               from "https://www.gstatic.com/firebasejs/10.12.0/firebase-firestore.js";
import { getAuth, signInWithEmailAndPassword,
         signOut, onAuthStateChanged }           from "https://www.gstatic.com/firebasejs/10.12.0/firebase-auth.js";

/* ── CONFIG ── */
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

/* ── ESTADO ── */
let cuentas     = [];   // banco de cuentas
let ventas      = [];   // ventas registradas
let unsubC      = null;
let unsubV      = null;
let editCuentaId = null;
let editVentaId  = null;
let ventaSortCol = 'fechaVenc';
let ventaSortDir = 1;
let ventaPage    = 0;
const PS = 10;

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

/* ── AUTH ── */
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

/* ── LOGIN ── */
window.doLogin = async () => {
  const email = document.getElementById('l-email').value.trim();
  const pass  = document.getElementById('l-pass').value;
  const errEl = document.getElementById('login-error');
  const btnEl = document.getElementById('btn-login');
  errEl.classList.remove('show'); errEl.textContent = '';
  if (!email || !pass) { errEl.textContent='Ingresa tu correo y contraseña.'; errEl.classList.add('show'); return; }
  btnEl.disabled = true; btnEl.textContent = 'Ingresando...';
  try {
    await signInWithEmailAndPassword(auth, email, pass);
  } catch(e) {
    let msg = 'Correo o contraseña incorrectos.';
    if (e.code==='auth/too-many-requests')      msg = 'Demasiados intentos. Espera unos minutos.';
    if (e.code==='auth/network-request-failed') msg = 'Sin conexión. Verifica tu internet.';
    errEl.textContent=msg; errEl.classList.add('show');
    btnEl.disabled=false; btnEl.textContent='Ingresar';
  }
};
window.doLogout = async () => { if(!confirm('¿Cerrar sesión?')) return; await signOut(auth); };
window.togglePass = () => {
  const i=document.getElementById('l-pass'), e=document.getElementById('pass-eye');
  i.type=i.type==='password'?'text':'password'; e.textContent=i.type==='password'?'👁':'🙈';
};
document.addEventListener('keydown', e => {
  if (e.key==='Enter' && document.getElementById('login-screen').style.display!=='none') window.doLogin();
});

/* ── SYNC FIRESTORE (dos colecciones) ── */
function startSync() {
  setSS('saving','Conectando...');
  document.getElementById('topbar-date').textContent = new Date().toLocaleDateString('es-PE',{weekday:'long',year:'numeric',month:'long',day:'numeric'});

  unsubC = onSnapshot(query(collection(db,'cuentas'),orderBy('creadoEn','desc')), snap => {
    cuentas = snap.docs.map(d=>({_id:d.id,...d.data()}));
    renderCuentas();
    refreshCuentaSelect();
    renderMetrics();
    setSS('online','Sincronizado');
    document.getElementById('btn-new-cuenta').disabled=false;
    document.getElementById('btn-new-venta').disabled=false;
  }, err => { console.error(err); setSS('error','Error'); });

  unsubV = onSnapshot(query(collection(db,'ventas'),orderBy('creadoEn','desc')), snap => {
    ventas = snap.docs.map(d=>({_id:d.id,...d.data()}));
    autoCorteVencidos();
    renderVentas();
    renderMetrics();
    populateMonths();
  }, err => console.error(err));
}

/* ── TABS ── */
window.switchTab = tab => {
  document.getElementById('panel-ventas').style.display  = tab==='ventas'  ? '' : 'none';
  document.getElementById('panel-cuentas').style.display = tab==='cuentas' ? '' : 'none';
  document.getElementById('tab-ventas').classList.toggle('active',  tab==='ventas');
  document.getElementById('tab-cuentas').classList.toggle('active', tab==='cuentas');
};

/* ════════════════════════════════════════
   CUENTAS
   ════════════════════════════════════════ */

/* Abrir modal de cuenta */
window.openCuentaModal = (id=null) => {
  editCuentaId = id;
  document.getElementById('modal-cuenta-title').textContent = id ? 'Editar Cuenta' : 'Nueva Cuenta';
  document.getElementById('fc-pass').type = 'password';
  document.getElementById('fc-pass-eye').textContent = '👁';
  if (id) {
    const c = cuentas.find(x=>x._id===id); if(!c) return;
    document.getElementById('fc-plataforma').value = c.plataforma || 'Netflix';
    document.getElementById('fc-correo').value     = c.correo     || '';
    document.getElementById('fc-pass').value       = c.cpass      || '';
    document.getElementById('fc-notas').value      = c.notas      || '';
  } else {
    ['fc-correo','fc-pass','fc-notas'].forEach(i=>document.getElementById(i).value='');
    document.getElementById('fc-plataforma').value = 'Netflix';
  }
  document.getElementById('modal-cuenta').classList.add('open');
};
window.closeCuentaModal = () => { document.getElementById('modal-cuenta').classList.remove('open'); editCuentaId=null; };
window.handleModalCuentaClick = e => { if(e.target===document.getElementById('modal-cuenta')) window.closeCuentaModal(); };
window.toggleFcPass = () => {
  const i=document.getElementById('fc-pass'), e=document.getElementById('fc-pass-eye');
  i.type=i.type==='password'?'text':'password'; e.textContent=i.type==='password'?'👁':'🙈';
};

/* Guardar cuenta */
window.saveCuenta = async () => {
  const correo = document.getElementById('fc-correo').value.trim();
  const plat   = document.getElementById('fc-plataforma').value;
  if (!correo || !plat) { alert('Completa plataforma y correo.'); return; }
  const bs = document.getElementById('btn-save-cuenta');
  bs.disabled=true; bs.textContent='Guardando...'; setSS('saving','Guardando...');
  const rec = { plataforma:plat, correo, cpass:document.getElementById('fc-pass').value, notas:document.getElementById('fc-notas').value.trim() };
  try {
    if (editCuentaId) await updateDoc(doc(db,'cuentas',editCuentaId),rec);
    else { rec.creadoEn=serverTimestamp(); await addDoc(collection(db,'cuentas'),rec); }
    window.closeCuentaModal();
  } catch(e) { console.error(e); alert('Error al guardar.'); setSS('error','Error'); }
  finally { bs.disabled=false; bs.textContent='Guardar'; }
};

/* Eliminar cuenta */
window.deleteCuenta = async id => {
  const usadas = ventas.filter(v=>v.cuentaId===id).length;
  if (usadas > 0) { alert(`Esta cuenta tiene ${usadas} venta(s) asociada(s). Elimínalas primero.`); return; }
  if (!confirm('¿Eliminar esta cuenta?')) return;
  try { await deleteDoc(doc(db,'cuentas',id)); } catch(e) { alert('Error al eliminar.'); }
};

/* Render tarjetas de cuentas */
function renderCuentas() {
  const q    = (document.getElementById('search-cuentas')?.value||'').toLowerCase();
  const filt = (document.getElementById('filter-plat-cuentas')?.value||'');
  const list = cuentas.filter(c => {
    const mQ = !q || (c.plataforma||'').toLowerCase().includes(q) || (c.correo||'').toLowerCase().includes(q);
    const mP = !filt || c.plataforma===filt;
    return mQ && mP;
  });
  const grid = document.getElementById('cuentas-grid');
  if (!list.length) { grid.innerHTML='<p style="color:var(--text3);font-size:14px;padding:2rem 0">No hay cuentas registradas.</p>'; return; }
  grid.innerHTML = list.map(c => {
    const k = pKey(c.plataforma);
    const nPerfiles = ventas.filter(v=>v.cuentaId===c._id).length;
    return `
    <div class="cuenta-card">
      <div class="cuenta-card-head">
        <div class="cuenta-card-plat">
          <span class="badge p-${k}"><span class="badge-dot"></span>${c.plataforma}</span>
        </div>
        <span class="cuenta-perfiles-count">${nPerfiles} venta${nPerfiles!==1?'s':''}</span>
      </div>
      <div class="cuenta-field">
        <span class="cuenta-field-label">Correo</span>
        <span class="cuenta-field-val">
          ${c.correo||'—'}
          <button class="copy-btn" onclick="copyDirect('${(c.correo||'').replace(/'/g,"\\'")}')">⧉</button>
        </span>
      </div>
      <div class="cuenta-field">
        <span class="cuenta-field-label">Contraseña</span>
        <span class="cuenta-field-val">
          <span id="cp-card-${c._id}" class="cuenta-pass-hidden" data-real="${(c.cpass||'').replace(/"/g,'&quot;')}">••••••••</span>
          <button class="copy-btn" onclick="toggleCardPass('${c._id}')">👁</button>
          <button class="copy-btn" onclick="copyDirect('${(c.cpass||'').replace(/'/g,"\\'")}')">⧉</button>
        </span>
      </div>
      ${c.notas ? `<div class="cuenta-notas">📝 ${c.notas}</div>` : ''}
      <div class="cuenta-actions">
        <button class="icon-btn" title="Editar" onclick="openCuentaModal('${c._id}')">✏</button>
        <button class="icon-btn del" title="Eliminar" onclick="deleteCuenta('${c._id}')">✕</button>
      </div>
    </div>`;
  }).join('');
}

window.toggleCardPass = id => {
  const el = document.getElementById('cp-card-'+id);
  if (!el) return;
  if (el.textContent==='••••••••') { el.textContent=el.dataset.real; el.style.letterSpacing='normal'; }
  else { el.textContent='••••••••'; el.style.letterSpacing='3px'; }
};

window.copyDirect = text => {
  navigator.clipboard.writeText(text).catch(()=>{
    const ta=document.createElement('textarea'); ta.value=text;
    document.body.appendChild(ta); ta.select(); document.execCommand('copy'); document.body.removeChild(ta);
  });
};

/* Refrescar select de cuentas en modal de venta — oculta cuentas ya vendidas como completas */
function refreshCuentaSelect() {
  const sel = document.getElementById('fv-cuenta-id');
  if (!sel) return;
  const cur = sel.value;
  // IDs de cuentas vendidas como completa y activas/pendientes (no corte/vencido)
  const cuentasCompletas = new Set(
    ventas
      .filter(v => v.tipo==='cuenta' && (v.estado==='Activo' || v.estado==='Pendiente'))
      .map(v => v.cuentaId)
  );
  sel.innerHTML = '<option value="">— Selecciona una cuenta —</option>';
  cuentas.forEach(c => {
    // Si ya está vendida completa y no es la venta que estamos editando, ocultarla
    if (cuentasCompletas.has(c._id)) {
      // Permitir si estamos editando esa misma venta
      const ventaActual = editVentaId ? ventas.find(v=>v._id===editVentaId) : null;
      if (!ventaActual || ventaActual.cuentaId !== c._id) return;
    }
    const opt = document.createElement('option');
    opt.value = c._id;
    opt.textContent = `${c.plataforma} — ${c.correo}`;
    sel.appendChild(opt);
  });
  if (cur) sel.value = cur;
}

/* ════════════════════════════════════════
   VENTAS
   ════════════════════════════════════════ */

window.openVentaModal = (id=null) => {
  editVentaId = id;
  document.getElementById('modal-venta-title').textContent = id ? 'Editar Venta' : 'Nueva Venta';
  refreshCuentaSelect();
  if (id) {
    const v = ventas.find(x=>x._id===id); if(!v) return;
    document.getElementById('fv-numero').value     = v.numero    ||'';
    document.getElementById('fv-tipo').value       = v.tipo      ||'perfil';
    document.getElementById('fv-cuenta-id').value  = v.cuentaId  ||'';
    document.getElementById('fv-perfil').value     = v.perfil    ||'';
    document.getElementById('fv-fecha').value      = v.fecha     ||'';
    document.getElementById('fv-fechaVenc').value  = v.fechaVenc ||'';
    document.getElementById('fv-precio').value     = v.precio    ||'';
    document.getElementById('fv-estado').value     = v.estado    ||'Activo';
    document.getElementById('fv-notas').value      = v.notas     ||'';
  } else {
    ['fv-numero','fv-perfil','fv-notas'].forEach(i=>document.getElementById(i).value='');
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
window.closeVentaModal = () => { document.getElementById('modal-venta').classList.remove('open'); editVentaId=null; };
window.handleModalVentaClick = e => { if(e.target===document.getElementById('modal-venta')) window.closeVentaModal(); };

/* Tipo perfil/cuenta cambia visibilidad del campo perfil */
window.onVentaTipoChange = () => {
  const tipo  = document.getElementById('fv-tipo').value;
  const grp   = document.getElementById('fv-group-perfil');
  const inp   = document.getElementById('fv-perfil');
  if (tipo==='cuenta') { grp.style.display='none'; inp.value='Cuenta completa'; }
  else { grp.style.display=''; if(inp.value==='Cuenta completa') inp.value=''; }
};

/* Al cambiar cuenta vinculada, filtra el selector de tipo */
window.onCuentaVinculadaChange = () => {};

/* Auto fecha vencimiento */
window.autoFechaVenc = () => {
  const f = document.getElementById('fv-fecha').value;
  if (f) document.getElementById('fv-fechaVenc').value = sumarMes(f);
};

/* Guardar venta */
window.saveVenta = async () => {
  const numero    = document.getElementById('fv-numero').value.trim();
  const cuentaId  = document.getElementById('fv-cuenta-id').value;
  const tipo      = document.getElementById('fv-tipo').value;
  const perfil    = document.getElementById('fv-perfil').value.trim();
  const fecha     = document.getElementById('fv-fecha').value;
  const fechaVenc = document.getElementById('fv-fechaVenc').value;
  if (!numero || !cuentaId || !fecha) { alert('Completa: N° contacto, cuenta vinculada y fecha de venta.'); return; }
  if (tipo==='perfil' && !perfil) { alert('Escribe el nombre del perfil.'); return; }

  const cuenta = cuentas.find(c=>c._id===cuentaId);
  const bs = document.getElementById('btn-save-venta');
  bs.disabled=true; bs.textContent='Guardando...'; setSS('saving','Guardando...');

  // Auto-detectar si ya está vencida al guardar
  let estadoFinal = document.getElementById('fv-estado').value;
  if (fechaVenc) {
    const hoy = new Date(); hoy.setHours(0,0,0,0);
    const venc = new Date(fechaVenc + 'T00:00:00');
    if (venc < hoy && estadoFinal === 'Activo') estadoFinal = 'Corte pendiente';
  }

  const rec = {
    numero, cuentaId,
    plataforma: cuenta?.plataforma || '',
    tipo,
    perfil: tipo==='cuenta' ? 'Cuenta completa' : perfil,
    fecha, fechaVenc,
    precio: parseFloat(document.getElementById('fv-precio').value)||0,
    estado: estadoFinal,
    notas:  document.getElementById('fv-notas').value.trim(),
  };
  try {
    if (editVentaId) await updateDoc(doc(db,'ventas',editVentaId),rec);
    else { rec.creadoEn=serverTimestamp(); await addDoc(collection(db,'ventas'),rec); }
    window.closeVentaModal();
  } catch(e) { console.error(e); alert('Error al guardar.'); setSS('error','Error'); }
  finally { bs.disabled=false; bs.textContent='Guardar'; }
};

/* Eliminar venta */
window.deleteVenta = async id => {
  if (!confirm('¿Eliminar esta venta?')) return;
  setSS('saving','Eliminando...');
  try { await deleteDoc(doc(db,'ventas',id)); } catch(e) { alert('Error al eliminar.'); setSS('error','Error'); }
};

/* ── TABS ── */
window.switchTab = tab => {
  ['perfiles','completas','cuentas'].forEach(t => {
    document.getElementById('panel-'+t).style.display  = t===tab ? '' : 'none';
    document.getElementById('tab-'+t).classList.toggle('active', t===tab);
  });
};

/* ── SORT / PAGE (por tipo de tab) ── */
const sortState = {
  perfil:  { col:'fechaVenc', dir:1, page:0 },
  cuenta:  { col:'fechaVenc', dir:1, page:0 },
};
window.sortVentas = (col, tipo) => {
  const s = sortState[tipo];
  if (s.col===col) s.dir*=-1; else { s.col=col; s.dir=-1; }
  tipo==='perfil' ? renderVentasPerfiles() : renderVentasCompletas();
};
window.changeVentasPage = (d, tipo) => {
  sortState[tipo].page = Math.max(0, sortState[tipo].page+d);
  tipo==='perfil' ? renderVentasPerfiles() : renderVentasCompletas();
};

function getVentasFiltradas(tipo) {
  const suffix = tipo==='perfil' ? '-perfiles' : '-completas';
  const q  = (document.getElementById('search'+suffix)?.value||'').toLowerCase();
  const pl = document.getElementById('filter-platform'+suffix)?.value||'';
  const st = document.getElementById('filter-status'+suffix)?.value||'';
  const mo = document.getElementById('filter-month'+suffix)?.value||'';
  const s  = sortState[tipo];
  return ventas
    .filter(v => {
      if (v.tipo !== tipo) return false;
      const cuenta = cuentas.find(c=>c._id===v.cuentaId);
      const mQ = !q || (v.numero||'').toLowerCase().includes(q)
                    || (v.perfil||'').toLowerCase().includes(q)
                    || (v.plataforma||'').toLowerCase().includes(q)
                    || (cuenta?.correo||'').toLowerCase().includes(q);
      const mP = !pl || v.plataforma===pl;
      const mS = !st || v.estado===st;
      const mM = !mo || (v.fecha||'').startsWith(mo);
      return mQ && mP && mS && mM;
    })
    .sort((a,b) => {
      let va=a[s.col]||'', vb=b[s.col]||'';
      if (s.col==='precio'){va=parseFloat(va)||0;vb=parseFloat(vb)||0;}
      return va<vb?-s.dir:va>vb?s.dir:0;
    });
}

function buildVentaRow(v, tipo) {
  const cuenta = cuentas.find(c=>c._id===v.cuentaId);
  const k    = pKey(v.plataforma);
  const sl   = v.estado==='Activo'          ? 's-active'
             : v.estado==='Pendiente'        ? 's-pending'
             : v.estado==='Corte pendiente'  ? 's-corte-pendiente'
             : v.estado==='Corte'            ? 's-corte'
             : 's-expired';
  const pr    = v.precio ? `S/. ${parseFloat(v.precio).toFixed(2)}` : '—';
  const fe    = fmtFecha(v.fecha);
  const dias  = diasRestantes(v.fechaVenc);
  const fvStr = fmtFecha(v.fechaVenc);

  let vencCell = '—';
  if (v.fechaVenc) {
    if (dias<0)       vencCell=`<span class="venc-tag venc-expirado">⚠ ${fvStr}</span>`;
    else if(dias<=3)  vencCell=`<span class="venc-tag venc-urgente">🔥 ${fvStr} (${dias}d)</span>`;
    else if(dias<=7)  vencCell=`<span class="venc-tag venc-proximo">⏰ ${fvStr} (${dias}d)</span>`;
    else              vencCell=`<span class="venc-tag venc-ok">✓ ${fvStr}</span>`;
  }

  const credBtn = cuenta
    ? `<button class="cred-btn" onclick="showCredentials('${(cuenta.correo||'').replace(/'/g,"\\'")}','${(cuenta.cpass||'').replace(/'/g,"\\'")}','${(v.plataforma||'').replace(/'/g,"\\'")}')">🔑 Ver</button>`
    : '<span style="color:var(--text3);font-size:12px">Sin cuenta</span>';

  const renovarBtn = (v.estado==='Corte pendiente'||v.estado==='Corte')
    ? `<button class="icon-btn renew" title="Renovar (+1 mes)" onclick="renovarVenta('${v._id}')">↻</button>` : '';
  const corteBtn = v.estado==='Corte pendiente'
    ? `<button class="icon-btn corte" title="Confirmar corte" onclick="confirmarCorte('${v._id}')">✂</button>` : '';

  const notaCell = v.notas
    ? `<span class="nota-pill" title="${v.notas.replace(/"/g,'&quot;')}">📝 ${v.notas}</span>`
    : '<span style="color:var(--text3)">—</span>';

  const perfilCell = tipo==='perfil' ? `<td>${v.perfil||'—'}</td>` : '';
  const cols = tipo==='perfil' ? 10 : 9;

  return `<tr>
    <td class="td-num" title="${v.numero||''}">${v.numero||'—'}</td>
    <td><span class="badge p-${k}"><span class="badge-dot"></span>${v.plataforma||'—'}</span></td>
    ${perfilCell}
    <td>${credBtn}</td>
    <td>${fe}</td>
    <td>${vencCell}</td>
    <td class="td-price">${pr}</td>
    <td><span class="status ${sl}">${v.estado||'—'}</span></td>
    <td class="td-notas">${notaCell}</td>
    <td><div class="actions">
      ${corteBtn}${renovarBtn}
      <button class="icon-btn" title="Editar" onclick="openVentaModal('${v._id}')">✏</button>
      <button class="icon-btn del" title="Eliminar" onclick="deleteVenta('${v._id}')">✕</button>
    </div></td>
  </tr>`;
}

function renderTabla(tipo) {
  const rows   = getVentasFiltradas(tipo);
  const s      = sortState[tipo];
  const total  = rows.length;
  const suffix = tipo==='perfil' ? 'perfiles' : 'completas';
  const colSpan= tipo==='perfil' ? 10 : 9;
  if (s.page*PS>=total && s.page>0) s.page=Math.max(0,Math.ceil(total/PS)-1);
  const slice = rows.slice(s.page*PS, s.page*PS+PS);
  const tbody = document.getElementById(suffix+'-body');
  document.getElementById(suffix+'-count').textContent=`${total} registro${total!==1?'s':''}`;
  tbody.innerHTML = slice.length
    ? slice.map(v=>buildVentaRow(v,tipo)).join('')
    : `<tr class="empty-row"><td colspan="${colSpan}">No hay registros.</td></tr>`;
  const from=total?s.page*PS+1:0, to=Math.min(s.page*PS+PS,total);
  document.getElementById(suffix+'-page-info').textContent=total?`${from}–${to} de ${total}`:'0 registros';
  document.getElementById('prev-'+suffix).disabled=s.page===0;
  document.getElementById('next-'+suffix).disabled=(s.page+1)*PS>=total;
}

function renderVentasPerfiles()  { renderTabla('perfil'); }
function renderVentasCompletas() { renderTabla('cuenta'); }

// Mantener compatibilidad con llamadas anteriores
function renderVentas() { renderVentasPerfiles(); renderVentasCompletas(); }

/* ── POPUP CREDENCIALES ── */
async function autoCorteVencidos() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  for (const v of ventas) {
    if (!v.fechaVenc) continue;
    // Solo actuar si está Activo o Pendiente — nunca sobreescribir estados manuales
    if (v.estado !== 'Activo' && v.estado !== 'Pendiente') continue;
    const venc = new Date(v.fechaVenc + 'T00:00:00');
    const dias = Math.round((venc - hoy) / 86400000);
    // Marca "Corte pendiente" solo cuando ya pasó la fecha (dias < 0)
    if (dias < 0) {
      try { await updateDoc(doc(db,'ventas',v._id), { estado: 'Corte pendiente' }); }
      catch(e) { console.error('Auto corte-pendiente error:', e); }
    }
  }
}

/* ── RENOVAR: extiende 1 mes y vuelve a Activo ── */
window.renovarVenta = async id => {
  const v = ventas.find(x=>x._id===id); if(!v) return;
  if (!confirm('¿Marcar como renovado? Se extenderá 1 mes desde hoy y volverá a Activo.')) return;
  const hoy       = new Date().toISOString().split('T')[0];
  const nuevaVenc = sumarMes(hoy);
  setSS('saving','Guardando...');
  try {
    await updateDoc(doc(db,'ventas',id), { estado:'Activo', fecha: hoy, fechaVenc: nuevaVenc });
  } catch(e) { console.error(e); alert('Error al renovar.'); setSS('error','Error'); }
};

/* ── CONFIRMAR CORTE MANUAL: tú confirmas que ya cortaste el servicio ── */
window.confirmarCorte = async id => {
  if (!confirm('¿Confirmar que ya realizaste el corte del servicio a este cliente?')) return;
  setSS('saving','Guardando...');
  try {
    await updateDoc(doc(db,'ventas',id), { estado:'Corte' });
  } catch(e) { console.error(e); alert('Error.'); setSS('error','Error'); }
};

/* ── AUTO "CORTE PENDIENTE" ── */
async function autoCorteVencidos() {
  const hoy = new Date(); hoy.setHours(0,0,0,0);
  for (const v of ventas) {
    if (!v.fechaVenc) continue;
    if (v.estado !== 'Activo' && v.estado !== 'Pendiente') continue;
    const venc = new Date(v.fechaVenc + 'T00:00:00');
    if (Math.round((venc - hoy) / 86400000) < 0) {
      try { await updateDoc(doc(db,'ventas',v._id), { estado: 'Corte pendiente' }); }
      catch(e) { console.error(e); }
    }
  }
}

/* ── POPUP CREDENCIALES ── */
window.showCredentials = (correo, cpass, plat) => {
  document.getElementById('cred-popup-title').textContent = '🔑 '+plat;
  document.getElementById('cp-correo').textContent = correo||'(sin correo)';
  const passEl = document.getElementById('cp-pass');
  passEl.dataset.real = cpass||'(sin contraseña)';
  passEl.textContent  = '••••••••';
  document.getElementById('cp-eye-btn').textContent = '👁';
  document.getElementById('copy-toast').classList.remove('show');
  document.getElementById('cred-popup').classList.add('open');
};
window.closeCredPopup = e => {
  if (!e || e.target===document.getElementById('cred-popup')) document.getElementById('cred-popup').classList.remove('open');
};
window.toggleCredPass = () => {
  const el=document.getElementById('cp-pass'), btn=document.getElementById('cp-eye-btn');
  if(el.textContent==='••••••••'){el.textContent=el.dataset.real;btn.textContent='🙈';}
  else{el.textContent='••••••••';btn.textContent='👁';}
};
window.copyText = (elId, isPass) => {
  const el   = document.getElementById(elId);
  const text = isPass ? el.dataset.real : el.textContent;
  const toast= document.getElementById('copy-toast');
  navigator.clipboard.writeText(text).catch(()=>{
    const ta=document.createElement('textarea');ta.value=text;document.body.appendChild(ta);ta.select();document.execCommand('copy');document.body.removeChild(ta);
  });
  toast.classList.add('show'); setTimeout(()=>toast.classList.remove('show'),1800);
};

/* ── MÉTRICAS ── */
function renderMetrics() {
  const total     = ventas.length;
  const activos   = ventas.filter(x=>x.estado==='Activo').length;
  const vencidos  = ventas.filter(x=>x.estado==='Vencido').length;
  const pendiente = ventas.filter(x=>x.estado==='Pendiente').length;
  const ingresos  = ventas.filter(x=>x.estado!=='Pendiente').reduce((s,v)=>s+(parseFloat(v.precio)||0),0);
  const porVencer = ventas.filter(x=>{ const d=diasRestantes(x.fechaVenc); return d!==null&&d>=0&&d<=7&&x.estado==='Activo'; }).length;
  document.getElementById('metrics').innerHTML=`
    <div class="metric"><div class="metric-icon">📋</div><div class="metric-label">Total ventas</div><div class="metric-value">${total}</div><div class="metric-sub">registros</div></div>
    <div class="metric"><div class="metric-icon">✅</div><div class="metric-label">Activos</div><div class="metric-value green">${activos}</div><div class="metric-sub">perfiles activos</div></div>
    <div class="metric"><div class="metric-icon">❌</div><div class="metric-label">Vencidos</div><div class="metric-value red">${vencidos}</div><div class="metric-sub">por renovar</div></div>
    <div class="metric"><div class="metric-icon">⏳</div><div class="metric-label">Pendientes</div><div class="metric-value yellow">${pendiente}</div><div class="metric-sub">por cobrar</div></div>
    <div class="metric"><div class="metric-icon">💰</div><div class="metric-label">Ingresos</div><div class="metric-value">S/. ${ingresos.toFixed(2)}</div><div class="metric-sub">cobrado</div></div>
    <div class="metric"><div class="metric-icon">🔔</div><div class="metric-label">Por vencer</div><div class="metric-value ${porVencer>0?'yellow':''}">${porVencer}</div><div class="metric-sub">en 7 días</div></div>`;
}

/* ── MESES ── */
function populateMonths() {
  const seen={}, months=[];
  ventas.forEach(v=>{ if(v.fecha){const m=v.fecha.slice(0,7); if(!seen[m]){seen[m]=true;months.push(m);}} });
  months.sort().reverse();
  ['filter-month-perfiles','filter-month-completas'].forEach(selId => {
    const sel=document.getElementById(selId); if(!sel) return;
    const cur=sel.value;
    while(sel.options.length>1) sel.remove(1);
    months.forEach(m=>{
      const [y,mo]=m.split('-');
      const lbl=new Date(parseInt(y),parseInt(mo)-1,1).toLocaleDateString('es-PE',{month:'long',year:'numeric'});
      const opt=document.createElement('option');
      opt.value=m; opt.textContent=lbl.charAt(0).toUpperCase()+lbl.slice(1);
      sel.appendChild(opt);
    });
    if(cur) sel.value=cur;
  });
}

/* ── EXPORTAR CSV ── */
window.exportCSV = (tipo='perfil') => {
  const rows = getVentasFiltradas(tipo);
  const cols = tipo==='perfil'
    ? ['N° Contacto','Plataforma','Perfil','Correo Cuenta','F.Venta','F.Vencimiento','Precio(S/.)','Estado','Notas']
    : ['N° Contacto','Plataforma','Correo Cuenta','F.Venta','F.Vencimiento','Precio(S/.)','Estado','Notas'];
  const lines=[cols.join(','), ...rows.map(v=>{
    const c=cuentas.find(x=>x._id===v.cuentaId);
    const base=[v.numero||'',v.plataforma||'',c?.correo||'',v.fecha||'',v.fechaVenc||'',v.precio||0,v.estado||'',v.notas||''];
    if(tipo==='perfil') base.splice(2,0,v.perfil||'');
    return base.map(x=>`"${String(x).replace(/"/g,'""')}"`).join(',');
  })];
  const blob=new Blob(['\uFEFF'+lines.join('\n')],{type:'text/csv;charset=utf-8;'});
  const a=document.createElement('a'); a.href=URL.createObjectURL(blob);
  a.download=`tronixx_ventas_${tipo}_${new Date().toISOString().split('T')[0]}.csv`; a.click();
};

/* ── INIT ── */
document.addEventListener('DOMContentLoaded', () => {
  // Poblar select de plataformas en modal de cuenta
  const formSelC = document.getElementById('fc-plataforma');
  PLATFORMS.forEach(p=>{
    const o=document.createElement('option'); o.value=p; o.textContent=p; formSelC.appendChild(o);
  });

  // Poblar TODOS los filtros de plataforma dinámicamente — FIX del filtro
  ['filter-platform-perfiles','filter-platform-completas','filter-plat-cuentas'].forEach(selId => {
    const sel = document.getElementById(selId); if(!sel) return;
    while(sel.options.length > 1) sel.remove(1);
    PLATFORMS.forEach(p => {
      const o = document.createElement('option'); o.value=p; o.textContent=p; sel.appendChild(o);
    });
  });

  document.getElementById('btn-new-cuenta').disabled=true;
  document.getElementById('btn-new-venta').disabled=true;
});
