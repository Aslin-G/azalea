/* ==========================================================================
   storage.js — Almacenamiento local (IndexedDB + localStorage).
   Nada sale del equipo. Si IndexedDB no está disponible (p. ej. modo privado
   de algunos navegadores con file://) se usa memoria y se informa al usuario.
   ========================================================================== */
(function () {
  'use strict';
  var SEDA = window.SEDA = window.SEDA || {};
  var Store = SEDA.Store = {};
  var DB_NAME = 'solar-energy-decision-ai';
  var DB_VER = 1;
  var db = null;
  var mem = { kv: new Map(), runs: new Map() };
  Store.mode = 'memoria';

  function req2p(r) {
    return new Promise(function (res, rej) { r.onsuccess = function () { res(r.result); }; r.onerror = function () { rej(r.error); }; });
  }

  Store.init = function () {
    return new Promise(function (resolve) {
      try {
        if (!window.indexedDB) { resolve(false); return; }
        var r = indexedDB.open(DB_NAME, DB_VER);
        var done = false;
        var timer = setTimeout(function () { if (!done) { done = true; resolve(false); } }, 4000);
        r.onupgradeneeded = function () {
          var d = r.result;
          if (!d.objectStoreNames.contains('kv')) d.createObjectStore('kv');
          if (!d.objectStoreNames.contains('runs')) d.createObjectStore('runs', { keyPath: 'id' });
        };
        r.onsuccess = function () { if (done) return; done = true; clearTimeout(timer); db = r.result; Store.mode = 'IndexedDB'; resolve(true); };
        r.onerror = function () { if (done) return; done = true; clearTimeout(timer); resolve(false); };
        r.onblocked = function () { if (done) return; done = true; clearTimeout(timer); resolve(false); };
      } catch (e) { resolve(false); }
    });
  };

  function tx(store, mode) { return db.transaction(store, mode).objectStore(store); }

  Store.get = async function (key) {
    if (!db) return mem.kv.get(key);
    try { return await req2p(tx('kv', 'readonly').get(key)); } catch (e) { return mem.kv.get(key); }
  };
  Store.set = async function (key, val) {
    mem.kv.set(key, val);
    if (!db) return true;
    try { await req2p(tx('kv', 'readwrite').put(val, key)); return true; } catch (e) { console.warn('IndexedDB set', e); return false; }
  };
  Store.del = async function (key) {
    mem.kv.delete(key);
    if (!db) return;
    try { await req2p(tx('kv', 'readwrite').delete(key)); } catch (e) { /* sin acción */ }
  };
  Store.runsAll = async function () {
    var arr;
    if (!db) arr = Array.from(mem.runs.values());
    else { try { arr = await req2p(tx('runs', 'readonly').getAll()); } catch (e) { arr = Array.from(mem.runs.values()); } }
    return arr.sort(function (a, b) { return (b.createdAt || 0) - (a.createdAt || 0); });
  };
  Store.runGet = async function (id) {
    if (!db) return mem.runs.get(id);
    try { return await req2p(tx('runs', 'readonly').get(id)); } catch (e) { return mem.runs.get(id); }
  };
  Store.runPut = async function (run) {
    mem.runs.set(run.id, run);
    if (!db) return;
    try { await req2p(tx('runs', 'readwrite').put(run)); } catch (e) { console.warn('IndexedDB run', e); }
  };
  Store.runDel = async function (id) {
    mem.runs.delete(id);
    if (!db) return;
    try { await req2p(tx('runs', 'readwrite').delete(id)); } catch (e) { /* sin acción */ }
  };
  Store.clearAll = async function () {
    mem.kv.clear(); mem.runs.clear();
    if (db) {
      try { await req2p(tx('kv', 'readwrite').clear()); } catch (e) { /* sin acción */ }
      try { await req2p(tx('runs', 'readwrite').clear()); } catch (e) { /* sin acción */ }
    }
    try {
      Object.keys(localStorage).forEach(function (k) { if (k.indexOf('seda-') === 0 && k !== 'seda-theme') localStorage.removeItem(k); });
    } catch (e) { /* sin acción */ }
  };
  Store.estimate = async function () {
    try {
      if (navigator.storage && navigator.storage.estimate) {
        var e = await navigator.storage.estimate();
        return e;
      }
    } catch (e) { /* sin acción */ }
    return null;
  };

  /* ---------- localStorage (preferencias ligeras) ---------- */
  Store.lsGet = function (key, def) {
    try { var v = localStorage.getItem(key); return v == null ? def : JSON.parse(v); } catch (e) { return def; }
  };
  Store.lsSet = function (key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (e) { return false; }
  };
})();
