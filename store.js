// Keeps the last picture in the browser (IndexedDB), so a reload carries on with the same project.
// Every call settles quietly: without storage (a private window, blocked site data) the page just starts fresh.
const PictureStore = (() => {
  const open = () => new Promise((ok, no) => {
    const r = indexedDB.open("bead-chart-maker", 1);
    r.onupgradeneeded = () => r.result.createObjectStore("files");
    r.onsuccess = () => ok(r.result); r.onerror = () => no(r.error);
  });
  const run = (mode, fn) => open().then(db => new Promise((ok, no) => {
    const t = db.transaction("files", mode), q = fn(t.objectStore("files"));
    t.oncomplete = () => ok(q.result); t.onerror = () => no(t.error);
  }));
  return {
    save: (blob, name) => run("readwrite", s => s.put({ blob, name }, "picture")).catch(() => {}),
    load: () => run("readonly", s => s.get("picture")).catch(() => null),
    clear: () => run("readwrite", s => s.delete("picture")).catch(() => {}),
  };
})();
