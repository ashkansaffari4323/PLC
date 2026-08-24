import React, { useState } from 'react';
import { X, FileUp, AlertTriangle, Check } from 'lucide-react';
import { isValidDateRange } from '../utils/gateStatus';

/** Flattens one element's attributes and leaf child elements into { fieldName: text }. */
function elementToFlatMap(el) {
  const map = {};
  for (const attr of el.attributes || []) {
    map[attr.name] = attr.value;
  }
  for (const child of el.children) {
    if (child.children.length === 0 && child.textContent.trim()) {
      // Some exports use a generic wrapper for every field, e.g.
      // <Field name="Start">2026-01-05</Field> - if several siblings share
      // one tag name, that tag alone can't tell them apart, so prefer a
      // distinguishing attribute (name/id/key/field) as the map key when
      // one's present, falling back to the tag name otherwise.
      const keyAttr = child.getAttribute?.('name') || child.getAttribute?.('id') || child.getAttribute?.('key') || child.getAttribute?.('field');
      map[keyAttr || child.tagName] = child.textContent.trim();
    }
  }
  return map;
}

/**
 * Finds the element tag that best represents "one row" of task/schedule
 * data. Tries every repeated tag, not just the single most-repeated one -
 * a schema like <Row><Field name="Name">X</Field>... would make "Field"
 * more repeated than "Row" even though "Row" is the real record - so
 * among tags where most instances yield usable data, this prefers whichever
 * one produces the richest rows (more distinct fields per instance) rather
 * than just the highest raw count.
 */
function findRepeatedElements(doc) {
  const counts = {};
  for (const el of doc.getElementsByTagName('*')) {
    counts[el.tagName] = (counts[el.tagName] || 0) + 1;
  }

  const candidates = Object.entries(counts)
    .filter(([, count]) => count > 1)
    .map(([tag, count]) => {
      const elements = Array.from(doc.getElementsByTagName(tag));
      const flatMaps = elements.map(elementToFlatMap);
      const withFields = flatMaps.filter((m) => Object.keys(m).length > 0);
      const avgFieldCount = withFields.length > 0
        ? withFields.reduce((sum, m) => sum + Object.keys(m).length, 0) / withFields.length
        : 0;
      return { tag, count, elements, coverage: withFields.length / count, avgFieldCount };
    })
    .filter((c) => c.coverage >= 0.5)
    .sort((a, b) => b.avgFieldCount - a.avgFieldCount || b.count - a.count);

  return candidates.length > 0 ? candidates[0].elements : [];
}

function guessField(fieldNames, keywords) {
  return fieldNames.find((f) => keywords.some((k) => f.toLowerCase().includes(k))) || '';
}

/** Normalizes whatever date format the XML uses into yyyy-mm-dd for <input type="date">. */
function tryParseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

const ImportXmlModal = ({ phases, onImport, onClose }) => {
  const [rows, setRows] = useState([]);
  const [fieldNames, setFieldNames] = useState([]);
  const [nameField, setNameField] = useState('');
  const [startField, setStartField] = useState('');
  const [finishField, setFinishField] = useState('');
  const [phaseId, setPhaseId] = useState('');
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setRows([]);
    try {
      const text = await file.text();
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.querySelector('parsererror')) {
        setError('This file could not be parsed as XML.');
        return;
      }

      const elements = findRepeatedElements(doc);
      if (elements.length === 0) {
        setError("No repeating elements found - is this a task/schedule export?");
        return;
      }

      const parsedRows = elements.map(elementToFlatMap).filter((r) => Object.keys(r).length > 0);
      if (parsedRows.length === 0) {
        setError('Found repeating elements but no readable fields inside them.');
        return;
      }

      const names = Object.keys(parsedRows[0]);
      setFieldNames(names);
      setNameField(guessField(names, ['name', 'title']));
      setStartField(guessField(names, ['start']));
      setFinishField(guessField(names, ['finish', 'end', 'due']));
      setRows(parsedRows);
    } catch (err) {
      setError(`Failed to read file: ${err.message}`);
    }
  };

  const preview = rows.map((r) => ({
    name: (nameField && r[nameField]) || '(unnamed)',
    startDate: tryParseDate(r[startField]),
    finishDate: tryParseDate(r[finishField]),
  }));

  const invalidRows = preview.filter((p) => !isValidDateRange(p.startDate, p.finishDate));
  const validCount = preview.length - invalidRows.length;

  const handleConfirm = () => {
    const gates = preview
      .filter((p) => isValidDateRange(p.startDate, p.finishDate))
      .map((p) => ({ name: p.name, startDate: p.startDate, finishDate: p.finishDate, phaseId: phaseId || null }));
    onImport(gates);
  };

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/20 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Import gates from XML</h3>
            <p className="text-xs text-slate-400 mt-0.5">Works with MS Project-style exports or any flat task/schedule XML</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">{error}</div>}

          {rows.length === 0 ? (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-10 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
              <FileUp className="h-6 w-6 text-slate-400" />
              <span className="text-sm text-slate-500">Click to choose an XML file</span>
              <input type="file" accept=".xml,text/xml" className="hidden" onChange={handleFile} />
            </label>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                Found {rows.length} row{rows.length === 1 ? '' : 's'} in {fileName} - confirm which field is which:
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Name field</label>
                  <select
                    value={nameField}
                    onChange={(e) => setNameField(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
                  >
                    <option value="">—</option>
                    {fieldNames.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Start date field</label>
                  <select
                    value={startField}
                    onChange={(e) => setStartField(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
                  >
                    <option value="">—</option>
                    {fieldNames.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Finish date field</label>
                  <select
                    value={finishField}
                    onChange={(e) => setFinishField(e.target.value)}
                    className="w-full mt-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
                  >
                    <option value="">—</option>
                    {fieldNames.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assign all to phase (optional)</label>
                <select
                  value={phaseId}
                  onChange={(e) => setPhaseId(e.target.value)}
                  className="w-full mt-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
                >
                  <option value="">No phase</option>
                  {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {invalidRows.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  {invalidRows.length} row{invalidRows.length === 1 ? '' : 's'} have a finish date before the start date and will be skipped.
                </div>
              )}

              <div className="border border-slate-100 rounded-xl divide-y divide-slate-50 max-h-56 overflow-y-auto">
                {preview.map((p, i) => (
                  <div key={i} className="flex items-center justify-between px-3.5 py-2 text-xs gap-3">
                    <span className="text-slate-700 truncate flex-1">{p.name}</span>
                    <span className="text-slate-400 whitespace-nowrap">{p.startDate || '—'} → {p.finishDate || '—'}</span>
                  </div>
                ))}
              </div>
            </>
          )}
        </div>

        {rows.length > 0 && (
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
            <button onClick={onClose} className="px-3.5 py-2 text-sm font-medium rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            <button
              onClick={handleConfirm}
              disabled={!nameField || validCount === 0}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
            >
              <Check className="h-4 w-4" /> Create {validCount} gate{validCount === 1 ? '' : 's'}
            </button>
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportXmlModal;
