import React, { useState } from 'react';
import { X, FileUp, AlertTriangle, Check, Layers, ShieldCheck } from 'lucide-react';
import { isValidDateRange } from '../utils/gateStatus';

/** Normalizes whatever date format the XML uses into yyyy-mm-dd for <input type="date">. */
function tryParseDate(raw) {
  if (!raw) return null;
  const d = new Date(raw);
  if (Number.isNaN(d.getTime())) return null;
  return d.toISOString().slice(0, 10);
}

const getTagText = (el, tag) => {
  const node = el.getElementsByTagName(tag)[0];
  return node ? node.textContent.trim() : null;
};

/**
 * Microsoft Project's XML interchange format is a real, documented schema
 * (not just "some XML") - <Project><Tasks><Task> with specific fields like
 * <UID>, <OutlineLevel>, and <Summary>. Detecting it specifically (rather
 * than relying on the generic row-guessing heuristic below) lets us use
 * OutlineLevel to rebuild the actual phase/gate hierarchy: level-1 tasks
 * become phases, and deeper tasks become gates nested under whichever
 * level-1 task most recently preceded them in the file (MS Project always
 * exports a parent immediately followed by its children, so a simple
 * single pass in document order reconstructs the hierarchy correctly).
 */
function tryParseMsProjectXml(doc) {
  const taskElements = Array.from(doc.getElementsByTagName('Task'));
  if (taskElements.length === 0) return null;

  // Require MSP's signature fields on the first task, so we don't
  // misfire on some unrelated schema that also happens to use <Task>.
  const sample = taskElements[0];
  if (!getTagText(sample, 'UID') || getTagText(sample, 'OutlineLevel') === null) {
    return null;
  }

  const tasks = taskElements
    .map((el) => ({
      uid: getTagText(el, 'UID'),
      name: getTagText(el, 'Name'),
      start: tryParseDate(getTagText(el, 'Start')),
      finish: tryParseDate(getTagText(el, 'Finish')),
      outlineLevel: parseInt(getTagText(el, 'OutlineLevel') || '1', 10),
    }))
    // MS Project includes a synthetic UID 0 "whole project" root summary
    // task with no real meaning as either a phase or a gate - drop it.
    .filter((t) => t.uid !== '0' && t.name);

  const phases = [];
  const gates = [];
  let currentPhaseIndex = null;

  tasks.forEach((t) => {
    if (t.outlineLevel <= 1) {
      phases.push({ name: t.name, startDate: t.start, finishDate: t.finish });
      currentPhaseIndex = phases.length - 1;
    } else {
      gates.push({ name: t.name, startDate: t.start, finishDate: t.finish, phaseIndex: currentPhaseIndex });
    }
  });

  return { phases, gates };
}

/** Flattens one element's attributes and leaf child elements into { fieldName: text }. */
function elementToFlatMap(el) {
  const map = {};
  for (const attr of el.attributes || []) {
    map[attr.name] = attr.value;
  }
  for (const child of el.children) {
    if (child.children.length === 0 && child.textContent.trim()) {
      const keyAttr = child.getAttribute?.('name') || child.getAttribute?.('id') || child.getAttribute?.('key') || child.getAttribute?.('field');
      map[keyAttr || child.tagName] = child.textContent.trim();
    }
  }
  return map;
}

/**
 * Generic fallback for any XML that isn't a recognized MS Project export:
 * finds the element tag that best represents "one row" of task data,
 * preferring whichever repeated tag yields the richest rows rather than
 * just the highest raw count (handles wrapper patterns like
 * <Row><Field name="Name">X</Field>...</Row>, where "Field" repeats more
 * than "Row" but "Row" is the real record).
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

const ImportXmlModal = ({ phases, onImport, onClose }) => {
  const [msProjectData, setMsProjectData] = useState(null); // { phases, gates } or null
  const [rows, setRows] = useState([]);
  const [fieldNames, setFieldNames] = useState([]);
  const [nameField, setNameField] = useState('');
  const [startField, setStartField] = useState('');
  const [finishField, setFinishField] = useState('');
  const [assignPhaseId, setAssignPhaseId] = useState('');
  const [error, setError] = useState(null);
  const [fileName, setFileName] = useState('');
  const [selectedIndices, setSelectedIndices] = useState(null); // Set, null until rows load
  const [filterText, setFilterText] = useState('');

  const handleFile = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    setFileName(file.name);
    setError(null);
    setRows([]);
    setMsProjectData(null);

    try {
      const text = await file.text();
      const doc = new DOMParser().parseFromString(text, 'application/xml');
      if (doc.querySelector('parsererror')) {
        setError('This file could not be parsed as XML.');
        return;
      }

      const msProject = tryParseMsProjectXml(doc);
      if (msProject && (msProject.phases.length > 0 || msProject.gates.length > 0)) {
        setMsProjectData(msProject);
        return;
      }

      const elements = findRepeatedElements(doc);
      if (elements.length === 0) {
        setError('No repeating elements found - is this a task/schedule export?');
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
      setSelectedIndices(new Set(parsedRows.map((_, i) => i)));
    } catch (err) {
      setError(`Failed to read file: ${err.message}`);
    }
  };

  // Generic-path preview (field-mapping based), each carrying its original
  // index so checkboxes stay correctly matched to rows after filtering.
  const genericPreview = rows.map((r, i) => ({
    index: i,
    name: (nameField && r[nameField]) || '(unnamed)',
    startDate: tryParseDate(r[startField]),
    finishDate: tryParseDate(r[finishField]),
  }));
  const genericInvalid = genericPreview.filter((p) => !isValidDateRange(p.startDate, p.finishDate));
  const genericFiltered = genericPreview.filter((p) => p.name.toLowerCase().includes(filterText.toLowerCase()));
  const genericSelectedValidCount = genericPreview.filter(
    (p) => selectedIndices?.has(p.index) && isValidDateRange(p.startDate, p.finishDate)
  ).length;

  const toggleIndex = (index) => {
    setSelectedIndices((prev) => {
      const next = new Set(prev);
      if (next.has(index)) next.delete(index);
      else next.add(index);
      return next;
    });
  };

  const selectAllVisible = () => {
    setSelectedIndices((prev) => new Set([...prev, ...genericFiltered.map((p) => p.index)]));
  };

  const clearAllVisible = () => {
    const visibleSet = new Set(genericFiltered.map((p) => p.index));
    setSelectedIndices((prev) => new Set([...prev].filter((i) => !visibleSet.has(i))));
  };

  // MS Project path preview (hierarchy based)
  const msValidGates = msProjectData ? msProjectData.gates.filter((g) => isValidDateRange(g.startDate, g.finishDate)) : [];
  const msInvalidCount = msProjectData ? msProjectData.gates.length - msValidGates.length : 0;

  const handleConfirmGeneric = () => {
    const gates = genericPreview
      .filter((p) => selectedIndices?.has(p.index) && isValidDateRange(p.startDate, p.finishDate))
      .map((p) => ({ name: p.name, startDate: p.startDate, finishDate: p.finishDate, phaseId: assignPhaseId || null }));
    onImport({ newPhases: [], gates });
  };

  const handleConfirmMsProject = () => {
    onImport({ newPhases: msProjectData.phases, gates: msValidGates });
  };

  const hasResults = msProjectData || rows.length > 0;

  return (
    <div className="fixed inset-0 bg-slate-900/40 backdrop-blur-sm flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-2xl shadow-2xl shadow-slate-900/20 w-full max-w-2xl max-h-[85vh] flex flex-col overflow-hidden">
        <div className="flex items-center justify-between px-5 py-4 border-b border-slate-100">
          <div>
            <h3 className="text-sm font-semibold text-slate-900">Import gates from XML</h3>
            <p className="text-xs text-slate-400 mt-0.5">Accepts real Microsoft Project XML exports, or any flat task/schedule XML</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-slate-100 text-slate-400 transition-colors">
            <X className="h-4 w-4" />
          </button>
        </div>

        <div className="px-5 py-4 space-y-4 overflow-y-auto">
          {error && <div className="text-xs text-red-700 bg-red-50 border border-red-100 rounded-xl px-3.5 py-2.5">{error}</div>}

          {!hasResults ? (
            <label className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-slate-300 rounded-xl py-10 cursor-pointer hover:border-indigo-300 hover:bg-indigo-50/30 transition-colors">
              <FileUp className="h-6 w-6 text-slate-400" />
              <span className="text-sm text-slate-500">Click to choose an XML file</span>
              <input type="file" accept=".xml,text/xml" className="hidden" onChange={handleFile} />
            </label>
          ) : msProjectData ? (
            <>
              <div className="flex items-center gap-2 text-xs text-indigo-700 bg-indigo-50 border border-indigo-100 rounded-xl px-3.5 py-2.5">
                <ShieldCheck className="h-3.5 w-3.5 flex-shrink-0" />
                Detected a Microsoft Project export in {fileName} - phases and gates below were built from its outline levels.
              </div>

              {msInvalidCount > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  {msInvalidCount} task{msInvalidCount === 1 ? '' : 's'} have a finish date before the start date and will be skipped.
                </div>
              )}

              <div className="border border-slate-100 rounded-xl divide-y divide-slate-50 max-h-72 overflow-y-auto">
                {msProjectData.phases.map((phase, pIndex) => (
                  <div key={pIndex} className="px-3.5 py-2.5">
                    <div className="flex items-center gap-2 text-sm font-medium text-slate-800">
                      <Layers className="h-3.5 w-3.5 text-indigo-500 flex-shrink-0" />
                      {phase.name}
                      <span className="text-xs text-slate-400 font-normal ml-auto whitespace-nowrap">
                        {phase.startDate || '—'} → {phase.finishDate || '—'}
                      </span>
                    </div>
                    <div className="mt-1.5 ml-5 space-y-1">
                      {msValidGates.filter((g) => g.phaseIndex === pIndex).map((g, gIndex) => (
                        <div key={gIndex} className="flex items-center justify-between text-xs text-slate-500">
                          <span className="truncate">{g.name}</span>
                          <span className="text-slate-400 whitespace-nowrap ml-2">{g.startDate || '—'} → {g.finishDate || '—'}</span>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
                {msValidGates.filter((g) => g.phaseIndex === null).length > 0 && (
                  <div className="px-3.5 py-2.5">
                    <div className="text-xs font-semibold text-slate-400 uppercase tracking-wide mb-1">No phase</div>
                    {msValidGates.filter((g) => g.phaseIndex === null).map((g, gIndex) => (
                      <div key={gIndex} className="flex items-center justify-between text-xs text-slate-500">
                        <span className="truncate">{g.name}</span>
                        <span className="text-slate-400 whitespace-nowrap ml-2">{g.startDate || '—'} → {g.finishDate || '—'}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            </>
          ) : (
            <>
              <p className="text-xs text-slate-400">
                Found {rows.length} row{rows.length === 1 ? '' : 's'} in {fileName} - confirm which field is which:
              </p>

              <div className="grid grid-cols-3 gap-3">
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Name field</label>
                  <select value={nameField} onChange={(e) => setNameField(e.target.value)} className="w-full mt-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg">
                    <option value="">—</option>
                    {fieldNames.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Start date field</label>
                  <select value={startField} onChange={(e) => setStartField(e.target.value)} className="w-full mt-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg">
                    <option value="">—</option>
                    {fieldNames.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
                <div>
                  <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Finish date field</label>
                  <select value={finishField} onChange={(e) => setFinishField(e.target.value)} className="w-full mt-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg">
                    <option value="">—</option>
                    {fieldNames.map((f) => <option key={f} value={f}>{f}</option>)}
                  </select>
                </div>
              </div>

              <div>
                <label className="text-xs font-semibold text-slate-500 uppercase tracking-wide">Assign all to phase (optional)</label>
                <select value={assignPhaseId} onChange={(e) => setAssignPhaseId(e.target.value)} className="w-full mt-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg">
                  <option value="">No phase</option>
                  {phases.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>

              {genericInvalid.length > 0 && (
                <div className="flex items-center gap-2 text-xs text-amber-700 bg-amber-50 border border-amber-100 rounded-xl px-3.5 py-2.5">
                  <AlertTriangle className="h-3.5 w-3.5 flex-shrink-0" />
                  {genericInvalid.length} row{genericInvalid.length === 1 ? '' : 's'} have a finish date before the start date and will be skipped.
                </div>
              )}

              <div>
                <div className="flex items-center gap-2 mb-2">
                  <input
                    value={filterText}
                    onChange={(e) => setFilterText(e.target.value)}
                    placeholder="Filter by name (e.g. milestone)…"
                    className="flex-1 px-2.5 py-1.5 text-sm border border-slate-200 rounded-lg"
                  />
                  <button onClick={selectAllVisible} className="text-xs font-medium text-indigo-600 hover:text-indigo-700 whitespace-nowrap">
                    Select all
                  </button>
                  <button onClick={clearAllVisible} className="text-xs font-medium text-slate-400 hover:text-slate-600 whitespace-nowrap">
                    Clear
                  </button>
                </div>
                <p className="text-xs text-slate-400 mb-2">
                  {selectedIndices?.size || 0} of {genericPreview.length} row{genericPreview.length === 1 ? '' : 's'} selected
                  {filterText && ` · showing ${genericFiltered.length} matching "${filterText}"`}
                </p>

                <div className="border border-slate-100 rounded-xl divide-y divide-slate-50 max-h-56 overflow-y-auto">
                  {genericFiltered.length === 0 && (
                    <div className="px-3.5 py-3 text-xs text-slate-400">No rows match "{filterText}".</div>
                  )}
                  {genericFiltered.map((p) => (
                    <label key={p.index} className="flex items-center gap-3 px-3.5 py-2 text-xs cursor-pointer hover:bg-slate-50">
                      <input
                        type="checkbox"
                        checked={selectedIndices?.has(p.index) || false}
                        onChange={() => toggleIndex(p.index)}
                        className="flex-shrink-0"
                      />
                      <span className="text-slate-700 truncate flex-1">{p.name}</span>
                      <span className="text-slate-400 whitespace-nowrap">{p.startDate || '—'} → {p.finishDate || '—'}</span>
                    </label>
                  ))}
                </div>
              </div>
            </>
          )}
        </div>

        {hasResults && (
          <div className="flex justify-end gap-2 px-5 py-4 border-t border-slate-100 bg-slate-50/60">
            <button onClick={onClose} className="px-3.5 py-2 text-sm font-medium rounded-xl text-slate-500 hover:bg-slate-100 transition-colors">
              Cancel
            </button>
            {msProjectData ? (
              <button
                onClick={handleConfirmMsProject}
                disabled={msProjectData.phases.length === 0 && msValidGates.length === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Check className="h-4 w-4" /> Create {msProjectData.phases.length} phase{msProjectData.phases.length === 1 ? '' : 's'} & {msValidGates.length} gate{msValidGates.length === 1 ? '' : 's'}
              </button>
            ) : (
              <button
                onClick={handleConfirmGeneric}
                disabled={!nameField || genericSelectedValidCount === 0}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-medium rounded-xl bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Check className="h-4 w-4" /> Create {genericSelectedValidCount} gate{genericSelectedValidCount === 1 ? '' : 's'}
              </button>
            )}
          </div>
        )}
      </div>
    </div>
  );
};

export default ImportXmlModal;
