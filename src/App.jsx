import React, { useState, useMemo, useEffect, useRef } from "react";

/* =========================================================
   PIPELINE MATERIAL DESCRIPTION TOOL — web version of r5E
   Sheet logic ported 1:1 from PIPE / OTHER / LISTS
   ========================================================= */

const IN = '"'; // inch mark

/* ---------------- LISTS (from LISTS sheet) ---------------- */
const L = {
  PIPE_SIZE: [2.375, 3.5, 4.5, 6.625, 8.625, 10.75, 12.75, 16, 20, 24, 30, 36, 42, 48, 60],
  PIPE_GRADE: ["X-52", "X-56", "X-60", "X-65", "X-70", "X-80"],
  STANDARD_1: ["API-5L"],
  STANDARD_2: ["PSL 1", "PSL 2"],
  SEAM_TYPE: ["HSAW", "LSAW", "DSAW", "ERW", "SEAMLESS"],
  COATING_THICKNESS: ["NONE", "12-14 MILS", "14-16 MILS", "16-20 MILS", "20-30 MILS", "30 MILS", "PER SPEC"],
  COATING_TYPE: ["NONE", "FBE", "ARO", "3LPE", "3LPP", "CTBE", "MRO", "LIQUID EPOXY"],
  INTERNAL_COATING: ["NONE", "1-2 MILS", "2-4 MILS", "PER SPEC"],
  DESIGN_FACTOR: ["0.72", "0.60", "0.50", "0.40"],
  TYPE_ELBOW: ["SEGMENTABLE ELBOW", "FITTING", "INDUCTION BEND"],
  ELBOW_ANGLE: ["30", "45", "60", "90", "CTF"],
  RADIUS: ["3R", "5R"],
  ENDS: ["BW", "SW", "THD", "RF", "RTJ"],
  FITTING_STANDARD: ["ASME B16.9", "ASME B16.49", "MSS SP-75", "MSS SP-97"],
  TYPE_TEE: ["STRAIGHT", "REDUCING", "FLOW", "SPLIT"],
  YESNO: ["Y", "N"],
  TYPE_REDUCER: ["CONCENTRIC", "ECCENTRIC"],
  FLANGE_TYPE: ["WN", "SO", "BLIND", "LAP JOINT", "THREADED", "ORIFICE"],
  FLANGE_CLASS: ["150", "300", "400", "600", "900", "1500", "2500"],
  FLANGE_FACE: ["RF", "RTJ", "FF"],
  FLANGE_MATERIAL: ["A105", "A105N", "A350 LF2", "A694 F52", "A694 F60", "A694 F65", "A694 F70"],
  FLANGE_STANDARD: ["ASME B16.5", "ASME B16.47", "ASME B16.36"],
  TYPE_VALVE: ["MAINLINE", "BLOCK", "TAP", "BLOW DOWN", "KICKER", "CHECK", "TRAP", "INTERCONNECT", "SUCTION", "DISCHARGE"],
  VALVE_TYPE: ["BALL", "GATE", "CHECK", "GLOBE", "PLUG", "BUTTERFLY", "NEEDLE", "SCREWED & SOCKET WELDED", "BELLOWS SEALED"],
  VALVE_OPERATION: ["MANUAL", "ACTUATED"],
  ASSEMBLY_TYPE: ["MAINLINE VALVE", "LAUNCHER", "RECEIVER"],
  BUOYANCY_TYPE: ["SET-ON CONCRETE WEIGHT", "BOLT-ON CONCRETE WEIGHT", "CONTINUOUS CONCRETE COATING", "GEOTEXTILE WEIGHT BAG", "SCREW ANCHOR SET"],
  CPTS_STYLE: ["ABOVE GRADE POST", "FLUSH MOUNT", "POLE MOUNT"],
  RIBBON_SIZE: [`1/2${IN} X 9/16${IN}`, `5/8${IN} X 7/8${IN}`, `1${IN} X 1-1/4${IN}`],
  DECOUPLER_MOUNT: ["DIRECT BURIAL", "ABOVE GRADE"],
  DECOUPLER_RATING: ["1.2KA", "3.7KA", "5KA", "10KA"],
  BED_TYPE: ["DEEP WELL", "SHALLOW VERTICAL", "SHALLOW HORIZONTAL"],
  ANODE_TYPE: ["HSCI", "MMO", "GRAPHITE", "MAGNESIUM", "ZINC"],
  ROD_MATERIAL: ["COPPER CLAD STEEL", "GALVANIZED STEEL"],
  ROD_DIA: [`5/8${IN}`, `3/4${IN}`],
  ROD_LEN: ["8'", "10'"],
};

/* Standard-dependent material lists (INDIRECT validation in r5E) */
const MAT_BY_STANDARD = {
  "ASME B16.9": ["A234 WPB", "A420 WPL6", "A403 WP304", "A403 WP316"],
  "ASME B16.49": ["X-52", "X-56", "X-60", "X-65", "X-70", "X-80"],
  "MSS SP-75": ["A860 WPHY42", "A860 WPHY52", "A860 WPHY60", "A860 WPHY65", "A860 WPHY70"],
  "MSS SP-97": ["A105", "A105N", "A350 LF2", "A694 F52", "A694 F60", "A694 F65", "A694 F70"],
};

/* SMYS (ksi) — RIGHT(grade,2) in the workbook */
const SMYS = { "X-52": 52, "X-56": 56, "X-60": 60, "X-65": 65, "X-70": 70, "X-80": 80 };

const fmt3 = (v) => (isFinite(v) ? Number(v).toFixed(3) : "—");
const roundUp3 = (v) => Math.ceil(v * 1000) / 1000;

/* quantity formatting — display with thousands separators, store/parse raw digits */
const onlyDigits = (v) => String(v).replace(/[^0-9]/g, "");
const withCommas = (v) => {
  const d = onlyDigits(v);
  return d ? Number(d).toLocaleString("en-US") : "";
};

/* Barlow: ROUNDUP((MAOP*OD)/(2*SMYS*1000*DF),3) */
const barlowWT = (maop, od, grade, df) => {
  const s = SMYS[grade];
  if (!s || !maop || !od || !df) return null;
  return roundUp3((maop * od) / (2 * s * 1000 * df));
};

const coat = (t, ty) => (t === "NONE" || ty === "NONE" ? "" : `, ${t} ${ty}`);

/* ---------------- Material catalog: fields + description builders ---------------- */

const CATALOG = {
  PIPE: {
    label: "Pipe",
    group: "Line pipe",
    defaults: {
      maop: "1440", df: "0.72", size: "42", grade: "X-70", std1: "API-5L", std2: "PSL 2",
      seam: "HSAW", c1t: "14-16 MILS", c1ty: "FBE", c2t: "NONE", c2ty: "NONE", int: "NONE",
      wtOverride: "", useShort: false,
    },
    fields: [
      { k: "maop", label: "MAOP (psig)", type: "number" },
      { k: "df", label: "Design factor", type: "select", opts: L.DESIGN_FACTOR },
      { k: "size", label: `Size — OD (in)`, type: "select", opts: L.PIPE_SIZE.map(String) },
      { k: "grade", label: "Grade", type: "select", opts: L.PIPE_GRADE },
      { k: "wtOverride", label: `Wall thickness override (in)`, type: "number", step: "0.001", hint: "Leave blank to use the calculated Barlow value" },
      { k: "std1", label: "Standard 1", type: "select", opts: L.STANDARD_1 },
      { k: "std2", label: "Standard 2", type: "select", opts: L.STANDARD_2 },
      { k: "seam", label: "Seam type", type: "select", opts: L.SEAM_TYPE },
      { k: "c1t", label: "Coating 1 thickness", type: "select", opts: L.COATING_THICKNESS },
      { k: "c1ty", label: "Coating 1 type", type: "select", opts: L.COATING_TYPE },
      { k: "c2t", label: "Coating 2 thickness", type: "select", opts: L.COATING_THICKNESS },
      { k: "c2ty", label: "Coating 2 type", type: "select", opts: L.COATING_TYPE },
      { k: "int", label: "Internal coating", type: "select", opts: L.INTERNAL_COATING },
    ],
    describe: (v) => {
      const calc = barlowWT(+v.maop, +v.size, v.grade, +v.df);
      const wt = v.wtOverride !== "" ? +v.wtOverride : calc;
      const base = `${v.size}${IN} OD X ${fmt3(wt)}${IN} WT, ${v.std1} ${v.std2}`;
      const full =
        `PIPE, ${base}, GRADE ${v.grade}, ${v.seam}` +
        (v.c1t === "NONE" ? "" : `, ${v.c1t} ${v.c1ty}`) +
        (v.c2t === "NONE" ? "" : ` + ${v.c2t} ${v.c2ty}`) +
        (v.int === "NONE" ? "" : `, ${v.int} INT. COATING`);
      const short =
        `PIPE, ${base}, ${v.grade}, ${v.seam}` +
        (v.c1t === "NONE" ? "" : `, ${v.c1ty}`) +
        (v.c2t === "NONE" ? "" : ` + ${v.c2ty}`) +
        (v.int === "NONE" ? "" : `, INT. COATED`);
      return { text: v.useShort ? short : full, alt: { full, short }, calcWT: calc, usedWT: wt };
    },
  },

  BEND: {
    label: "Bend / Elbow",
    group: "Fittings",
    defaults: { type: "INDUCTION BEND", size: "42", angle: "CTF", radius: "5R", wt: "0.720", std: "MSS SP-75", mat: "A860 WPHY70", ends: "BW", ct: "14-16 MILS", cty: "FBE" },
    fields: [
      { k: "type", label: "Bend type", type: "select", opts: L.TYPE_ELBOW, allowOther: true },
      { k: "size", label: "Size — OD (in)", type: "select", opts: L.PIPE_SIZE.map(String) },
      { k: "angle", label: "Angle (deg)", type: "select", opts: L.ELBOW_ANGLE },
      { k: "radius", label: "Radius", type: "select", opts: L.RADIUS },
      { k: "wt", label: "Wall thickness (in)", type: "number", step: "0.001" },
      { k: "std", label: "Standard", type: "select", opts: L.FITTING_STANDARD },
      { k: "mat", label: "Material", type: "select", optsBy: { dep: "std", map: MAT_BY_STANDARD } },
      { k: "ends", label: "Ends", type: "select", opts: L.ENDS },
      { k: "ct", label: "Coating thickness", type: "select", opts: L.COATING_THICKNESS },
      { k: "cty", label: "Coating type", type: "select", opts: L.COATING_TYPE },
    ],
    describe: (v) => {
      const ang = v.angle === "CTF" ? "CTF" : `${v.angle}°`;
      return { text: `BEND, ${v.type}, ${v.size}${IN} OD X ${fmt3(+v.wt)}${IN} WT, ${ang} ${v.radius}, ${v.mat} ${v.std} ${v.ends}${coat(v.ct, v.cty)}` };
    },
  },

  TEE: {
    label: "Tee",
    group: "Fittings",
    defaults: { type: "STRAIGHT", run: "42", branch: "12", barred: "Y", wt: "0.720", std: "MSS SP-75", mat: "A860 WPHY70", ends: "BW", ct: "NONE", cty: "NONE" },
    fields: [
      { k: "type", label: "Tee type", type: "select", opts: L.TYPE_TEE, allowOther: true },
      { k: "run", label: "Run size (in)", type: "select", opts: L.PIPE_SIZE.map(String) },
      { k: "branch", label: "Branch size (in)", type: "number", step: "0.001" },
      { k: "barred", label: "Barred (Y/N)", type: "select", opts: L.YESNO },
      { k: "wt", label: "Wall thickness (in)", type: "number", step: "0.001" },
      { k: "std", label: "Standard", type: "select", opts: L.FITTING_STANDARD },
      { k: "mat", label: "Material", type: "select", optsBy: { dep: "std", map: MAT_BY_STANDARD } },
      { k: "ends", label: "Ends", type: "select", opts: L.ENDS },
      { k: "ct", label: "Coating thickness", type: "select", opts: L.COATING_THICKNESS },
      { k: "cty", label: "Coating type", type: "select", opts: L.COATING_TYPE },
    ],
    notice: (v) =>
      +v.branch >= +v.run / 3
        ? { tone: "warn", msg: `Bars required — branch (${v.branch}") ≥ 1/3 of run (${(+v.run / 3).toFixed(2)}")` }
        : { tone: "ok", msg: `Bars optional — branch (${v.branch}") < 1/3 of run (${(+v.run / 3).toFixed(2)}")` },
    describe: (v) => ({
      text: `TEE, ${v.type} ${v.run}${IN} X ${v.branch}${IN} X ${fmt3(+v.wt)}${IN} WT, ${v.mat} ${v.std} ${v.ends}, ${v.barred === "Y" ? "BARRED" : "STANDARD"}${coat(v.ct, v.cty)}`,
    }),
  },

  REDUCER: {
    label: "Reducer",
    group: "Fittings",
    defaults: { type: "CONCENTRIC", large: "36", small: "24", wt: "0.515", std: "ASME B16.9", mat: "A234 WPB", ends: "BW", ct: "12-14 MILS", cty: "FBE" },
    fields: [
      { k: "type", label: "Reducer type", type: "select", opts: L.TYPE_REDUCER, allowOther: true },
      { k: "large", label: "Large end (in)", type: "select", opts: L.PIPE_SIZE.map(String) },
      { k: "small", label: "Small end (in)", type: "select", opts: L.PIPE_SIZE.map(String) },
      { k: "wt", label: "Wall thickness (in)", type: "number", step: "0.001" },
      { k: "std", label: "Standard", type: "select", opts: L.FITTING_STANDARD },
      { k: "mat", label: "Material", type: "select", optsBy: { dep: "std", map: MAT_BY_STANDARD } },
      { k: "ends", label: "Ends", type: "select", opts: L.ENDS },
      { k: "ct", label: "Coating thickness", type: "select", opts: L.COATING_THICKNESS },
      { k: "cty", label: "Coating type", type: "select", opts: L.COATING_TYPE },
    ],
    describe: (v) => ({
      text: `REDUCER, ${v.type} ${v.large}${IN} X ${v.small}${IN} X ${fmt3(+v.wt)}${IN} WT, ${v.mat} ${v.std} ${v.ends}${coat(v.ct, v.cty)}`,
    }),
  },

  FLANGE: {
    label: "Flange",
    group: "Fittings",
    defaults: { ftype: "BLIND", size: "36", cls: "600", face: "RTJ", cdt: "N", mat: "A105", std: "ASME B16.5", ct: "NONE", cty: "NONE" },
    fields: [
      { k: "ftype", label: "Flange type", type: "select", opts: L.FLANGE_TYPE, allowOther: true },
      { k: "size", label: "Size (in)", type: "select", opts: L.PIPE_SIZE.map(String) },
      { k: "cls", label: "Class", type: "select", opts: L.FLANGE_CLASS },
      { k: "face", label: "Face", type: "select", opts: L.FLANGE_FACE },
      { k: "cdt", label: "CD&T (blind only)", type: "select", opts: L.YESNO, showIf: (v) => v.ftype === "BLIND" },
      { k: "mat", label: "Material", type: "select", opts: L.FLANGE_MATERIAL },
      { k: "std", label: "Standard", type: "select", opts: L.FLANGE_STANDARD },
      { k: "ct", label: "Coating thickness", type: "select", opts: L.COATING_THICKNESS },
      { k: "cty", label: "Coating type", type: "select", opts: L.COATING_TYPE },
    ],
    describe: (v) => ({
      text: `FLANGE, ${v.size}${IN} ${v.ftype} ${v.face}${v.ftype === "BLIND" && v.cdt === "Y" ? " CD&T" : ""}, CLASS ${v.cls}, ${v.mat} ${v.std}${coat(v.ct, v.cty)}`,
    }),
  },

  VALVE: {
    label: "Valve",
    group: "Valves & assemblies",
    defaults: { type: "MAINLINE", vtype: "BALL", size: "42", mfr: "CAMERON T-32", cls: "900", e1: "BW", e2: "RF", op: "ACTUATED" },
    fields: [
      { k: "type", label: "Service", type: "select", opts: L.TYPE_VALVE, allowOther: true },
      { k: "vtype", label: "Valve type", type: "select", opts: L.VALVE_TYPE, allowOther: true },
      { k: "size", label: "Size (in)", type: "select", opts: L.PIPE_SIZE.map(String) },
      { k: "mfr", label: "Manufacturer & model", type: "text" },
      { k: "cls", label: "Class", type: "select", opts: L.FLANGE_CLASS },
      { k: "e1", label: "End 1", type: "select", opts: L.ENDS },
      { k: "e2", label: "End 2", type: "select", opts: L.ENDS },
      { k: "op", label: "Operation", type: "select", opts: L.VALVE_OPERATION },
    ],
    describe: (v) => ({
      text: `${v.type} VALVE, ${v.size}${IN} ${v.vtype}, ${v.mfr}, CLASS ${v.cls}, ${v.e1}x${v.e2}, ${v.op}`,
    }),
  },

  ASSEMBLY: {
    label: "Assembly",
    group: "Valves & assemblies",
    defaults: { type: "LAUNCHER", fab: "CI", desc: `CAMERON 42${IN} BALL, 2-12${IN} PLUG BLOW DOWN`, cls: "600", pup: "5" },
    fields: [
      { k: "type", label: "Assembly type", type: "select", opts: L.ASSEMBLY_TYPE, allowOther: true },
      { k: "fab", label: "Fabricator", type: "text" },
      { k: "desc", label: "Component description", type: "text" },
      { k: "cls", label: "Class", type: "select", opts: L.FLANGE_CLASS },
      { k: "pup", label: "Pup length (ft)", type: "number" },
    ],
    describe: (v) => ({ text: `${v.type} ASSEMBLY, ${v.fab} FAB, ${v.desc}, CLASS ${v.cls}, W/${v.pup}' PUPS` }),
  },

  BUOYANCY: {
    label: "Buoyancy control",
    group: "Field materials",
    defaults: { type: "GEOTEXTILE WEIGHT BAG", spacing: "12.5" },
    fields: [
      { k: "type", label: "Type", type: "select", opts: L.BUOYANCY_TYPE, allowOther: true },
      { k: "spacing", label: "Spacing (ft)", type: "number", step: "0.5" },
    ],
    describe: (v) => ({ text: `BUOYANCY CONTROL, ${v.type} @ ${v.spacing}' SPACING` }),
  },

  CPTS: {
    label: "CP test station",
    group: "Field materials",
    defaults: { style: "ABOVE GRADE POST", wires: "4" },
    fields: [
      { k: "style", label: "Style", type: "select", opts: L.CPTS_STYLE, allowOther: true },
      { k: "wires", label: "Number of wires", type: "number", min: "1", max: "11" },
    ],
    describe: (v) => {
      const n = Math.min(11, Math.max(1, parseInt(v.wires) || 1));
      return { text: `CP TEST STATION, ${v.style}, ${n}-WIRE` };
    },
  },

  AC_RIBBON: {
    label: "AC mitigation ribbon",
    group: "Field materials",
    defaults: { material: "ZINC RIBBON", size: L.RIBBON_SIZE[1] },
    fields: [
      { k: "material", label: "Material", type: "text" },
      { k: "size", label: "Ribbon size", type: "select", opts: L.RIBBON_SIZE },
    ],
    describe: (v) => ({ text: `AC MITIGATION, ${(v.material || "ZINC RIBBON").toUpperCase()} ANODE, ${v.size}` }),
  },

  AC_DECOUPLER: {
    label: "AC decoupler",
    group: "Field materials",
    defaults: { mount: "DIRECT BURIAL", rating: "5KA" },
    fields: [
      { k: "mount", label: "Mounting", type: "select", opts: L.DECOUPLER_MOUNT, allowOther: true },
      { k: "rating", label: "Fault rating", type: "select", opts: L.DECOUPLER_RATING },
    ],
    describe: (v) => ({ text: `AC DECOUPLER, SOLID STATE, ${v.mount}, ${v.rating}` }),
  },

  ANODE_BED: {
    label: "Anode bed",
    group: "Field materials",
    defaults: { bed: "DEEP WELL", anode: "HSCI", qty: "12" },
    fields: [
      { k: "bed", label: "Bed type", type: "select", opts: L.BED_TYPE, allowOther: true },
      { k: "anode", label: "Anode type", type: "select", opts: L.ANODE_TYPE, allowOther: true },
      { k: "qty", label: "Anode quantity", type: "number" },
    ],
    describe: (v) => ({ text: `ANODE BED, ${v.bed}, ${v.anode} ANODES, QTY ${v.qty}` }),
  },

  GROUND_ROD: {
    label: "Grounding rod",
    group: "Field materials",
    defaults: { mat: "COPPER CLAD STEEL", dia: `3/4${IN}`, len: "10'" },
    fields: [
      { k: "mat", label: "Material", type: "select", opts: L.ROD_MATERIAL, allowOther: true },
      { k: "dia", label: "Diameter", type: "select", opts: L.ROD_DIA },
      { k: "len", label: "Length", type: "select", opts: L.ROD_LEN },
    ],
    describe: (v) => ({ text: `GROUNDING ROD, ${v.mat}, ${v.dia} X ${v.len}` }),
  },
};

const GROUPS = ["Line pipe", "Fittings", "Valves & assemblies", "Field materials"];

/* =========================================================
   App
   ========================================================= */
export default function App() {
  const [matKey, setMatKey] = useState("PIPE");
  const [values, setValues] = useState({ ...CATALOG.PIPE.defaults });
  const [qty, setQty] = useState("1");
  const [rows, setRows] = useState([]);
  const [view, setView] = useState("input"); // mobile tab
  const [flash, setFlash] = useState(null);

  const cat = CATALOG[matKey];

  const pickMaterial = (k) => {
    setMatKey(k);
    setValues({ ...CATALOG[k].defaults });
  };

  const setVal = (k, v) => {
    setValues((prev) => {
      const next = { ...prev, [k]: v };
      // keep dependent material list valid when standard changes
      const dep = cat.fields.find((f) => f.optsBy && f.optsBy.dep === k);
      if (dep) {
        const opts = dep.optsBy.map[v] || [];
        if (!opts.includes(next[dep.k])) next[dep.k] = opts[0] || "";
      }
      return next;
    });
  };

  // dropdown change: handle the OTHER sentinel, otherwise behave like setVal
  const selectOpt = (f, val) => {
    if (f.allowOther && val === "OTHER") {
      setValues((prev) => ({ ...prev, [f.k + "__o"]: true, [f.k]: "" }));
      return;
    }
    setValues((prev) => {
      const next = { ...prev, [f.k]: val, [f.k + "__o"]: false };
      const dep = cat.fields.find((x) => x.optsBy && x.optsBy.dep === f.k);
      if (dep) {
        const opts = dep.optsBy.map[val] || [];
        if (!opts.includes(next[dep.k])) next[dep.k] = opts[0] || "";
      }
      return next;
    });
  };

  const desc = useMemo(() => {
    try { return cat.describe(values); } catch { return { text: "" }; }
  }, [cat, values]);

  const notice = cat.notice ? cat.notice(values) : null;

  const addToSchedule = () => {
    const nextNo = rows.length ? Math.max(...rows.map((r) => r.no)) + 1 : 1;
    setRows((r) => [...r, { id: Date.now() + Math.random(), no: nextNo, qty: Math.max(1, parseInt(onlyDigits(qty)) || 1), type: cat.label.toUpperCase(), text: desc.text }]);
    setFlash(desc.text);
    setTimeout(() => setFlash(null), 1800);
  };

  const sorted = useMemo(() => [...rows].sort((a, b) => a.no - b.no), [rows]);

  const updateRow = (id, patch) => setRows((r) => r.map((x) => (x.id === id ? { ...x, ...patch } : x)));
  const removeRow = (id) => setRows((r) => r.filter((x) => x.id !== id));
  const renumber = () => setRows(sorted.map((r, i) => ({ ...r, no: i + 1 })));

  const exportCSV = () => {
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    const lines = [["ITEM", "QTY", "TYPE", "MATERIAL DESCRIPTION"].join(","),
      ...sorted.map((r) => [r.no, r.qty, esc(r.type), esc(r.text)].join(","))];
    const blob = new Blob([lines.join("\n")], { type: "text/csv" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "material-list.csv";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  /* ---- save / load schedule as JSON ---- */
  const fileRef = useRef(null);
  const [loadMsg, setLoadMsg] = useState(null);

  const saveJSON = () => {
    const payload = {
      tool: "PIPELINE MATERIAL DESCRIPTION TOOL",
      rev: "5E-web",
      savedAt: new Date().toISOString(),
      rows: sorted.map(({ no, qty, type, text }) => ({ no, qty, type, text })),
    };
    const blob = new Blob([JSON.stringify(payload, null, 2)], { type: "application/json" });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = "material-list.json";
    a.click();
    URL.revokeObjectURL(a.href);
  };

  const loadJSON = (e) => {
    const file = e.target.files && e.target.files[0];
    e.target.value = ""; // allow re-loading the same file later
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const data = JSON.parse(reader.result);
        const list = Array.isArray(data) ? data : data.rows;
        if (!Array.isArray(list)) throw new Error("no rows");
        const cleaned = list
          .filter((r) => r && typeof r.text === "string")
          .map((r, i) => ({
            id: Date.now() + i + Math.random(),
            no: Number.isFinite(+r.no) && +r.no > 0 ? +r.no : i + 1,
            qty: Number.isFinite(+r.qty) && +r.qty > 0 ? +r.qty : 1,
            type: typeof r.type === "string" ? r.type : "",
            text: r.text,
          }));
        if (!cleaned.length) throw new Error("empty");
        setRows(cleaned);
        setLoadMsg({ tone: "ok", msg: `Loaded ${cleaned.length} item${cleaned.length === 1 ? "" : "s"} from ${file.name} — replaced the current list` });
      } catch {
        setLoadMsg({ tone: "err", msg: `Couldn't read ${file.name} — choose a list saved from this tool (.json)` });
      }
      setTimeout(() => setLoadMsg(null), 5000);
    };
    reader.readAsText(file);
  };

  useEffect(() => {
    document.title = "Pipeline Material Description Tool";
  }, []);

  return (
    <div className="app">
      <style>{CSS}</style>

      <header className="hdr">
        <div className="hdr-mark">PMDT</div>
        <div>
          <h1>Pipeline Material Description Tool</h1>
          <div className="hdr-sub">rev 6</div>
        </div>
        <div className="hdr-count">{rows.length} item{rows.length === 1 ? "" : "s"} in list</div>
      </header>

      <nav className="tabs">
        <button className={view === "input" ? "on" : ""} onClick={() => setView("input")}>1 · Material input</button>
        <button className={view === "schedule" ? "on" : ""} onClick={() => setView("schedule")}>2 · Material list {rows.length > 0 && <span className="pill">{rows.length}</span>}</button>
      </nav>

      <main className={`cols view-${view}`}>
        {/* ---------------- INPUT ---------------- */}
        <section className="panel input-panel">
          <h2 className="panel-title">Select material type</h2>
          <div className="type-grid">
            {GROUPS.map((g) => (
              <div key={g} className="type-group">
                <div className="type-group-label">{g}</div>
                <div className="chips">
                  {Object.entries(CATALOG).filter(([, c]) => c.group === g).map(([k, c]) => (
                    <button key={k} className={`chip ${matKey === k ? "chip-on" : ""}`} onClick={() => pickMaterial(k)}>{c.label}</button>
                  ))}
                </div>
              </div>
            ))}
          </div>

          <h2 className="panel-title">Specifications — {cat.label}</h2>
          <div className="fields">
            {cat.fields.filter((f) => !f.showIf || f.showIf(values)).map((f) => {
              const opts = f.optsBy ? (f.optsBy.map[values[f.optsBy.dep]] || []) : f.opts;
              const isOther = !!values[f.k + "__o"];
              return (
                <label key={f.k} className="field">
                  <span className="field-label">{f.label}</span>
                  {f.type === "select" ? (
                    <>
                      <select value={isOther ? "OTHER" : values[f.k]} onChange={(e) => selectOpt(f, e.target.value)}>
                        {opts.map((o) => <option key={o} value={o}>{o}</option>)}
                        {f.allowOther && <option value="OTHER">OTHER…</option>}
                      </select>
                      {isOther && (
                        <input className="other-input" type="text" autoFocus placeholder="Enter value"
                          value={values[f.k]} onChange={(e) => setVal(f.k, e.target.value.toUpperCase())} />
                      )}
                    </>
                  ) : (
                    <input type={f.type} step={f.step} min={f.min} max={f.max} value={values[f.k]} placeholder={f.hint ? "auto" : ""} onChange={(e) => setVal(f.k, e.target.value)} />
                  )}
                  {f.hint && <span className="field-hint">{f.hint}</span>}
                </label>
              );
            })}
          </div>

          {matKey === "PIPE" && desc.calcWT != null && (
            <div className="calc-line">
              Barlow WT = ({values.maop} × {values.size}) / (2 × {SMYS[values.grade]},000 × {values.df}) → <strong>{fmt3(desc.calcWT)}{IN}</strong>
              {values.wtOverride !== "" && <span className="calc-override"> · using override {fmt3(+values.wtOverride)}{IN}</span>}
            </div>
          )}

          {matKey === "PIPE" && (
            <label className="toggle">
              <input type="checkbox" checked={values.useShort} onChange={(e) => setVal("useShort", e.target.checked)} />
              <span>Use short description</span>
            </label>
          )}

          {notice && <div className={`notice notice-${notice.tone}`}>{notice.msg}</div>}

          <div className="preview">
            <div className="preview-label">Material description</div>
            <div className="preview-text">{desc.text}</div>
          </div>

          <div className="submit-row">
            <label className="qty-field">
              <span className="field-label">Qty</span>
              <input type="text" inputMode="numeric" value={withCommas(qty)} onChange={(e) => setQty(onlyDigits(e.target.value))} />
            </label>
            <button className="btn-primary" onClick={addToSchedule}>Add to list →</button>
          </div>
          {flash && <div className="flash">Added: {flash.slice(0, 60)}{flash.length > 60 ? "…" : ""}</div>}
        </section>

        {/* ---------------- SCHEDULE ---------------- */}
        <section className="panel sched-panel">
          <div className="sched-head">
            <h2 className="panel-title">Material list</h2>
            <div className="sched-actions">
              <button className="btn-ghost" onClick={saveJSON} disabled={!rows.length}>Save list</button>
              <button className="btn-ghost" onClick={() => fileRef.current && fileRef.current.click()}>Load list</button>
              <input ref={fileRef} type="file" accept=".json,application/json" style={{ display: "none" }} onChange={loadJSON} />
              <button className="btn-ghost" onClick={renumber} disabled={!rows.length}>Renumber 1–{rows.length || "n"}</button>
              <button className="btn-ghost" onClick={exportCSV} disabled={!rows.length}>Export CSV</button>
            </div>
          </div>

          {loadMsg && <div className={`notice ${loadMsg.tone === "ok" ? "notice-ok" : "notice-err"}`}>{loadMsg.msg}</div>}

          {rows.length === 0 ? (
            <div className="empty">
              No materials yet. Build a description on the input page and select <strong>Add to list</strong> — items are numbered automatically and the numbers stay editable here.
            </div>
          ) : (
            <table className="sched">
              <thead>
                <tr><th className="col-no">Item</th><th className="col-qty">Qty</th><th>Description</th><th className="col-x"></th></tr>
              </thead>
              <tbody>
                {sorted.map((r) => (
                  <tr key={r.id}>
                    <td className="col-no">
                      <input className="no-input" type="number" min="1" value={r.no}
                        onChange={(e) => updateRow(r.id, { no: parseInt(e.target.value) || 0 })} />
                    </td>
                    <td className="col-qty">
                      <input className="no-input qty-input" type="text" inputMode="numeric" value={withCommas(r.qty)}
                        onChange={(e) => updateRow(r.id, { qty: Math.max(1, parseInt(onlyDigits(e.target.value)) || 1) })} />
                    </td>
                    <td>
                      <div className="row-type">{r.type}</div>
                      <div className="row-text">{r.text}</div>
                    </td>
                    <td className="col-x"><button className="del" title="Remove" onClick={() => removeRow(r.id)}>✕</button></td>
                  </tr>
                ))}
              </tbody>
            </table>
          )}
        </section>
      </main>
    </div>
  );
}

/* ---------------- styles ---------------- */
const CSS = `
@import url('https://fonts.googleapis.com/css2?family=Barlow+Condensed:wght@500;600;700&family=Barlow:wght@400;500;600&family=IBM+Plex+Mono:wght@400;500;600&display=swap');

:root{
  --ink:#16232c; --ink-2:#43545f; --line:#cfd8dc; --paper:#eef1f2; --card:#ffffff;
  --safety:#e8650d; --safety-dark:#c5530a; --steel:#21323e; --ok:#1c7c4d; --warn:#b3540e;
}
*{box-sizing:border-box}
.app{min-height:100vh;background:var(--paper);color:var(--ink);font-family:'Barlow',system-ui,sans-serif;font-size:15px}

.hdr{display:flex;align-items:center;gap:14px;background:var(--steel);color:#fff;padding:14px 20px}
.hdr-mark{font-family:'Barlow Condensed';font-weight:700;font-size:20px;letter-spacing:.08em;background:var(--safety);color:#fff;padding:6px 10px;border-radius:3px}
.hdr h1{margin:0;font-family:'Barlow Condensed';font-weight:600;font-size:22px;letter-spacing:.03em;text-transform:uppercase}
.hdr-sub{font-size:12px;color:#9fb2bd;letter-spacing:.04em}
.hdr-count{margin-left:auto;font-family:'IBM Plex Mono';font-size:12px;color:#cdd9e0;white-space:nowrap}

.tabs{display:none;background:var(--card);border-bottom:1px solid var(--line)}
.tabs button{flex:1;padding:12px;border:none;background:none;font:inherit;font-weight:600;color:var(--ink-2);border-bottom:3px solid transparent;cursor:pointer}
.tabs button.on{color:var(--safety-dark);border-bottom-color:var(--safety)}
.pill{background:var(--safety);color:#fff;border-radius:10px;padding:1px 7px;font-size:11px;margin-left:6px}

.cols{display:grid;grid-template-columns:minmax(380px,520px) 1fr;gap:18px;padding:18px;max-width:1400px;margin:0 auto}
.panel{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:18px 20px}
.panel-title{font-family:'Barlow Condensed';font-weight:600;font-size:17px;letter-spacing:.06em;text-transform:uppercase;color:var(--ink-2);margin:0 0 10px;border-bottom:2px solid var(--line);padding-bottom:6px}
.panel-title + .panel-title, .fields + .panel-title{margin-top:20px}

.type-group{margin-bottom:10px}
.type-group-label{font-size:11px;letter-spacing:.1em;text-transform:uppercase;color:var(--ink-2);margin-bottom:5px}
.chips{display:flex;flex-wrap:wrap;gap:6px}
.chip{font:inherit;font-size:13px;font-weight:500;padding:6px 11px;border:1px solid var(--line);border-radius:999px;background:#fff;color:var(--ink);cursor:pointer}
.chip:hover{border-color:var(--safety)}
.chip-on{background:var(--safety);border-color:var(--safety);color:#fff;font-weight:600}

.fields{display:grid;grid-template-columns:1fr 1fr;gap:10px 14px;margin-top:12px}
.field{display:flex;flex-direction:column;gap:3px}
.field-label{font-size:11px;letter-spacing:.07em;text-transform:uppercase;color:var(--ink-2);font-weight:600}
.field select,.field input,.qty-field input{font:inherit;padding:7px 9px;border:1px solid var(--line);border-radius:5px;background:#fff;color:var(--ink)}
.field select:focus,.field input:focus,.qty-field input:focus,.no-input:focus{outline:2px solid var(--safety);outline-offset:1px}
.field-hint{font-size:11px;color:var(--ink-2)}
.other-input{margin-top:5px;font:inherit;padding:7px 9px;border:1px solid var(--safety);border-radius:5px;background:#fff;color:var(--ink)}
.other-input:focus{outline:2px solid var(--safety);outline-offset:1px}

.calc-line{margin-top:12px;font-family:'IBM Plex Mono';font-size:12px;color:var(--ink-2);background:#f4f6f7;border-left:3px solid var(--steel);padding:8px 10px;border-radius:0 4px 4px 0}
.calc-override{color:var(--safety-dark);font-weight:600}
.toggle{display:flex;align-items:center;gap:8px;margin-top:10px;font-size:13px;cursor:pointer}
.notice{margin-top:12px;padding:8px 12px;border-radius:5px;font-size:13px;font-weight:500}
.notice-warn{background:#fdf0e4;color:var(--warn);border:1px solid #f0cba8}
.notice-ok{background:#e9f5ee;color:var(--ok);border:1px solid #bfe0cd}
.notice-err{background:#fbeaea;color:#a02020;border:1px solid #ecc6c6}

.preview{margin-top:16px;background:var(--steel);border-radius:6px;padding:12px 14px;position:relative}
.preview-label{font-size:10px;letter-spacing:.18em;text-transform:uppercase;color:var(--safety);font-weight:700;margin-bottom:6px}
.preview-text{font-family:'IBM Plex Mono';font-size:13.5px;line-height:1.55;color:#f2f6f8;word-break:break-word}

.submit-row{display:flex;gap:10px;margin-top:14px;align-items:flex-end}
.qty-field{display:flex;flex-direction:column;gap:3px;width:128px}
.btn-primary{flex:1;font:inherit;font-weight:700;font-size:15px;letter-spacing:.03em;background:var(--safety);color:#fff;border:none;border-radius:6px;padding:11px;cursor:pointer}
.btn-primary:hover{background:var(--safety-dark)}
.flash{margin-top:8px;font-size:12px;color:var(--ok);font-family:'IBM Plex Mono'}

.sched-head{display:flex;align-items:center;justify-content:space-between;gap:10px;flex-wrap:wrap}
.sched-head .panel-title{border:none;margin:0;padding:0}
.sched-actions{display:flex;gap:8px}
.btn-ghost{font:inherit;font-size:13px;font-weight:600;padding:7px 12px;border:1px solid var(--line);border-radius:5px;background:#fff;color:var(--ink);cursor:pointer}
.btn-ghost:hover:not(:disabled){border-color:var(--safety);color:var(--safety-dark)}
.btn-ghost:disabled{opacity:.45;cursor:default}

.empty{margin-top:14px;padding:28px 18px;border:1.5px dashed var(--line);border-radius:6px;color:var(--ink-2);font-size:14px;text-align:center}

.sched{width:100%;border-collapse:collapse;margin-top:12px}
.sched th{font-family:'Barlow Condensed';font-weight:600;font-size:13px;letter-spacing:.08em;text-transform:uppercase;color:var(--ink-2);text-align:left;padding:6px 8px;border-bottom:2px solid var(--steel)}
.sched td{padding:9px 8px;border-bottom:1px solid var(--line);vertical-align:top}
.col-no{width:64px}.col-qty{width:108px}.col-x{width:36px}
.no-input{width:56px;font-family:'IBM Plex Mono';font-size:13px;padding:5px 6px;border:1px solid var(--line);border-radius:4px;text-align:center}
.qty-input{width:96px;text-align:right}
.row-type{font-size:10px;letter-spacing:.12em;color:var(--safety-dark);font-weight:700;margin-bottom:2px}
.row-text{font-family:'IBM Plex Mono';font-size:13px;line-height:1.5;word-break:break-word}
.del{border:none;background:none;color:var(--ink-2);font-size:14px;cursor:pointer;padding:4px;border-radius:4px}
.del:hover{color:#a02020;background:#fbeaea}

@media (max-width: 980px){
  .tabs{display:flex}
  .cols{display:block;padding:12px}
  .panel{margin-bottom:12px}
  .view-input .sched-panel{display:none}
  .view-schedule .input-panel{display:none}
  .fields{grid-template-columns:1fr 1fr}
  .hdr-count{display:none}
}
@media (max-width: 520px){ .fields{grid-template-columns:1fr} }
@media (prefers-reduced-motion: reduce){ *{transition:none!important} }
`;
