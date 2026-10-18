/* Pays des clubs des phases de ligue Europa League / Conference League 2026-27
   (filtre « pays » du classement par zones).  Lancer : node --test tests/*.test.js */
'use strict';
const test = require('node:test');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');

const sandbox = { window: {} };
vm.runInNewContext(fs.readFileSync(path.join(__dirname, '..', 'cupclubs2026.js'), 'utf8'), sandbox);
const DATA = sandbox.window.LDCCupClubs2026;

test('36 clubs par compétition, chacun avec un code pays à 3 lettres', () => {
  for (const slug of ['uefa.europa', 'uefa.europa.conf']) {
    const ids = Object.keys(DATA[slug]);
    assert.equal(ids.length, 36, slug);
    for (const id of ids) assert.match(DATA[slug][id], /^[A-Z]{3}$/, slug + ' ' + id);
  }
});

test('pays complétés à la main là où ESPN ne renseigne que la coupe', () => {
  assert.equal(DATA['uefa.europa']['20024'], 'ARM');      // Ararat-Armenia
  assert.equal(DATA['uefa.europa.conf']['2528'], 'KAZ');  // Kairat Almaty
});
