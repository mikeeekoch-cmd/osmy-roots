import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { parseFamilyNotesPacket } from '../../server/ingestion/index.mjs';
import { createZip } from '../../server/export/zip.mjs';

function fictionalNotes() {
  const names = Array.from({ length: 35 }, (_, i) => `Fictional Relative ${String(i + 1).padStart(2, '0')}`);
  const people = Object.fromEntries(names.map((name, i) => [name, `F${String(i + 1).padStart(3, '0')}`]));
  const bodies = names.map((name, i) => `## ${name}\n${i === 1 ? 'Born around 1910. The death date is unknown. This identification remains tentative.' : i === 2 ? 'Born 1930 or 1932 (unresolved). The death date is unknown. This record contains an unresolved discrepancy.' : 'The birth date is unknown. The death date is unknown. This is a supplied family record.'}\n`);
  const sentences = [...names.slice(1).map((name, i) => `${names[0]} ${i < 14 ? 'may be' : 'is recorded as'} the parent of ${name}.`), ...Array.from({ length: 22 }, (_, i) => `${names[i + 1]} is recorded as the sibling of ${names[i + 2]}.`)];
  const relationships = Object.fromEntries(sentences.map((sentence, i) => [sentence, `FR${String(i + 1).padStart(3, '0')}`]));
  const note = `# Family notes\n\n${bodies.join('\n')}\n## Family connections\n${sentences.join('\n')}\n`;
  const image = readFileSync('fixtures/public/placeholder-portrait.png');
  const photoNote = `# Photo notes\n\n## fictional-portrait.png\nA fictional placeholder illustration.\nPeople named in the caption: ${names[0]}.\nLeft to right: ${names[0]}.\n`;
  const f = (originalName, bytes) => ({ originalName, bytes: Buffer.isBuffer(bytes) ? bytes : Buffer.from(bytes) });
  return { files: [f('Family notes.txt', note), f('Photo notes.txt', photoNote), f('fictional-portrait.png', image), ...['mom','dad','family'].map(role => f(`Family chat ${role}.zip`, createZip([{ path: '_chat.txt', bytes: 'Collector: A family story is recorded here.\nFamily role: The boat was made of wood.' }, { path: 'metadata.json', bytes: JSON.stringify({ sourceId: `chat-${role}`, reconstruction: true, evidenceRootId: 'fictional-notes' }) }])))], identityKeys: { people, relationships, assets: { 'fictional-portrait.png': 'fictional-photo' } } };
}

test('ordinary family prose reconstructs all 35 people and 56 sourced relationships without a hidden graph', async () => {
  const input = fictionalNotes(), result = await parseFamilyNotesPacket(input);
  assert.equal(result.people.length, 35); assert.equal(result.relationships.length, 56);
  assert.equal(result.relationships.filter(r => r.status === 'proposed').length, 14);
  assert.deepEqual(result.people[1].lifeYears.birth, { value: '1910', precision: 'approximate' });
  assert.deepEqual(result.people[2].lifeYears.birth, { value: '1930 or 1932', precision: 'unknown' });
  assert.equal(result.people[2].recordStatus, 'disputed');
  assert.equal(result.photoAnnotations[0].assetId, 'fictional-photo');
  assert.equal(result.photoAnnotations[0].positions[0].status, 'proposed');
  assert.equal(result.people[0].photoIds.length, 0);
  for (const claim of result.claims) for (const span of claim.spans) assert.equal(result.sources.find(s => s.id === span.sourceId).originalText.slice(span.start, span.end), span.quote);
  assert.equal(result.sources.some(s => s.title?.endsWith('.csv')), false);
  assert.equal(result.stories.length, 0, 'the uploaded recollection must still pass through live review');
  assert.equal(result.sources.filter(s => s.kind === 'reconstructed_chat').length, 3);
});

test('identity mappings cannot add absent people, relationships or assets', async () => {
  const input = fictionalNotes(); input.identityKeys.people['A hidden ancestor'] = 'HIDDEN';
  await assert.rejects(parseFamilyNotesPacket(input), /no uploaded heading/);
  const second = fictionalNotes(); second.identityKeys.relationships['A hidden relationship.'] = 'HIDDEN';
  await assert.rejects(parseFamilyNotesPacket(second), /no exact uploaded sentence/);
  const third = fictionalNotes(); third.identityKeys.assets['missing-photo.jpg'] = 'HIDDEN';
  await assert.rejects(parseFamilyNotesPacket(third), /no uploaded file/);
});

test('unrecognized graph prose fails while outside-roster photo labels remain unresolved', async () => {
  const input = fictionalNotes(); input.files[0].bytes = Buffer.from(input.files[0].bytes.toString().replace('may be the parent of', 'is perhaps connected to'));
  await assert.rejects(parseFamilyNotesPacket(input), /Unrecognized family connection sentence/);
  const second = fictionalNotes(); second.files[1].bytes = Buffer.from(second.files[1].bytes.toString().replace('Left to right: Fictional Relative 01.', 'Left to right: An absent person.'));
  const parsed = await parseFamilyNotesPacket(second);
  assert.deepEqual(parsed.photoAnnotations[0].positions[0], { position: 1, personId: null, label: 'An absent person', status: 'unresolved' });
  assert.equal(parsed.people.length, 35);
  const group = fictionalNotes();
  group.files[1].bytes = Buffer.from(group.files[1].bytes.toString().replace('Left to right: Fictional Relative 01.\n', ''));
  const unpositioned = await parseFamilyNotesPacket(group);
  assert.deepEqual(unpositioned.photoAnnotations[0].positions, [], 'a single known person in a group does not establish their position');
  assert.deepEqual(unpositioned.photoAnnotations[0].depictedPersonIds, ['F001']);
});

test('person-section relationships preserve orientation, scoped identities, partner meaning and human dates', async () => {
  const bodies = [
    ['Ada Fiction', 'Born on 23 August 1996. Her father was Ben Fiction. Her partner was Cy Fiction.'],
    ['Ben Fiction', 'He died in Miass. Died on 23 April 1969. Born in 1924.'],
    ['Cy Fiction', 'Born on 12 March 1932 or 12 March 1930. His father may have been Ben Fiction.'],
    ['Dee Fiction', 'Born around 1938. Her father was Ben Fiction. Her sister was Ada Fiction.']
  ];
  const people = Object.fromEntries(bodies.map(([name], i) => [name, `F${i+1}`]));
  const relationships = {
    'Ada Fiction\nHer father was Ben Fiction.': 'REL1',
    'Ada Fiction\nHer partner was Cy Fiction.': 'REL2',
    'Cy Fiction\nHis father may have been Ben Fiction.': 'REL3',
    'Dee Fiction\nHer father was Ben Fiction.': 'REL4',
    'Dee Fiction\nHer sister was Ada Fiction.': 'REL5'
  };
  const input = { files: [{ originalName: 'Family notes.txt', bytes: Buffer.from(bodies.map(([name, body]) => `## ${name}\n${body}\n`).join('\n')) }], identityKeys: { people, relationships } };
  const result = await parseFamilyNotesPacket(input);
  assert.deepEqual(result.people[0].lifeYears.birth, { value: '1996-08-23', precision: 'day' });
  assert.deepEqual(result.people[1].lifeYears.death, { value: '1969-04-23', precision: 'day' });
  assert.deepEqual(result.people[1].lifeYears.birth, { value: '1924', precision: 'year' });
  assert.deepEqual(result.people[2].lifeYears.birth, { value: '12 March 1932 or 12 March 1930', precision: 'unknown' });
  assert.deepEqual(result.people[3].lifeYears.birth, { value: '1938', precision: 'approximate' });
  assert.equal(result.relationships.find(r => r.id === 'REL1').fromPersonId, 'F2');
  assert.equal(result.relationships.find(r => r.id === 'REL1').toPersonId, 'F1');
  assert.equal(result.relationships.find(r => r.id === 'REL3').status, 'proposed');
  assert.equal(result.claims.find(c => c.id === 'import-relationship-REL2').predicate, 'relationship_partner');
  assert.equal(result.people[0].lifeYears.death.value, null);
  for (const claim of result.claims) for (const span of claim.spans) assert.equal(result.sources[0].originalText.slice(span.start, span.end), span.quote);
  const ambiguous = structuredClone(input); delete ambiguous.identityKeys.relationships['Ada Fiction\nHer father was Ben Fiction.'];
  ambiguous.identityKeys.relationships['Her father was Ben Fiction.'] = 'REL1';
  await assert.rejects(parseFamilyNotesPacket(ambiguous), /Ambiguous unscoped/);
});
