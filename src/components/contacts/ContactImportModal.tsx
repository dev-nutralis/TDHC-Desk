"use client";

import { useRef, useState, useCallback } from "react";
import { createPortal } from "react-dom";
import Papa from "papaparse";
import { Upload, X, CheckCircle2, AlertCircle, Loader2, FileText, ArrowRight } from "lucide-react";

// ── CSV column → internal key mapping ────────────────────────────────────────

const CSV_COLUMN_MAP: Record<string, keyof ImportRow> = {
  "contact":                   "full_name",
  "email address":             "email",
  "datum kreacije kontakta":   "created_at",
  "evalley i contact date created": "created_at",  // fallback
  "mobile":                    "mobile",
  "contact id":                "contact_id",
  "date of birth":             "date_of_birth",
  "dodatni email #2":          "additional_email",
  "dodatni email":             "additional_email",
  "spol":                      "gender",
  "street":                    "street",
  "city":                      "city",
  "zip code":                  "zip_code",
};

interface ImportRow {
  full_name: string;
  email: string;
  created_at: string;
  mobile: string;
  contact_id: string;
  date_of_birth: string;
  additional_email: string;
  gender: string;
  street: string;
  city: string;
  zip_code: string;
}

type Step = "upload" | "preview" | "importing" | "done";

interface ImportResult {
  created: number;
  skipped: number;
  errors: Array<{ row: number; message: string }>;
}

// ── Props ────────────────────────────────────────────────────────────────────

interface Props {
  open: boolean;
  onClose: () => void;
  onDone: () => void;
  defaultUserId: string;
}

// ── Component ─────────────────────────────────────────────────────────────────

export default function ContactImportModal({ open, onClose, onDone, defaultUserId }: Props) {
  const [step, setStep] = useState<Step>("upload");
  const [rows, setRows] = useState<ImportRow[]>([]);
  const [fileName, setFileName] = useState("");
  const [result, setResult] = useState<ImportResult | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [parseError, setParseError] = useState("");
  const fileRef = useRef<HTMLInputElement>(null);

  const reset = () => {
    setStep("upload");
    setRows([]);
    setFileName("");
    setResult(null);
    setParseError("");
  };

  const handleClose = () => {
    reset();
    onClose();
  };

  const parseCSV = useCallback((file: File) => {
    setParseError("");
    Papa.parse(file, {
      header: true,
      skipEmptyLines: true,
      complete: (res) => {
        const rawRows = res.data as Record<string, string>[];
        if (rawRows.length === 0) {
          setParseError("CSV fajl je prazan.");
          return;
        }

        // Detect column mapping from headers
        const headers = Object.keys(rawRows[0]);
        const colMap: Record<string, keyof ImportRow> = {};
        for (const h of headers) {
          const mapped = CSV_COLUMN_MAP[h.toLowerCase().trim()];
          if (mapped && !colMap[h]) colMap[h] = mapped;
        }

        const mapped: ImportRow[] = rawRows.map(raw => {
          const row: ImportRow = {
            full_name: "", email: "", created_at: "", mobile: "",
            contact_id: "", date_of_birth: "", additional_email: "", gender: "",
            street: "", city: "", zip_code: "",
          };
          for (const [col, key] of Object.entries(colMap)) {
            // created_at: prefer "datum kreacije kontakta" over evalley fallback
            if (key === "created_at" && row.created_at && col.toLowerCase().includes("evalley")) continue;
            row[key] = (raw[col] ?? "").trim();
          }
          return row;
        });

        setRows(mapped);
        setFileName(file.name);
        setStep("preview");
      },
      error: (err) => {
        setParseError(`Greška pri parsiranju: ${err.message}`);
      },
    });
  }, []);

  const handleFile = (file: File | undefined) => {
    if (!file) return;
    if (!file.name.endsWith(".csv")) {
      setParseError("Molimo uploadujte CSV fajl.");
      return;
    }
    parseCSV(file);
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    handleFile(e.dataTransfer.files[0]);
  }, [parseCSV]); // eslint-disable-line

  const handleImport = async () => {
    setStep("importing");
    try {
      const res = await fetch("/api/contacts/import", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rows, user_id: defaultUserId }),
      });
      const data = await res.json();
      setResult(data);
      setStep("done");
      onDone();
    } catch {
      setResult({ created: 0, skipped: 0, errors: [{ row: 0, message: "Greška pri importu." }] });
      setStep("done");
    }
  };

  if (!open || typeof window === "undefined") return null;

  const previewRows = rows.slice(0, 8);

  const modal = (
    <>
      <div className="fixed inset-0 bg-black/40 backdrop-blur-sm z-[9998]" onClick={handleClose} />
      <div
        className="fixed z-[9999] bg-white rounded-2xl shadow-2xl border border-[#D8DCDE] flex flex-col"
        style={{
          top: "50%", left: "50%",
          transform: "translate(-50%, -50%)",
          width: step === "preview" ? 820 : 480,
          maxWidth: "95vw",
          maxHeight: "90vh",
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-[#D8DCDE] shrink-0">
          <div className="flex items-center gap-2.5">
            <FileText size={18} className="text-[#038153]" />
            <span className="text-base font-semibold text-[#2F3941]">Import kontakata</span>
            {step === "preview" && (
              <span className="text-sm text-[#68717A] font-normal">
                — {rows.length} redova pronađeno
              </span>
            )}
          </div>
          <button onClick={handleClose} className="w-7 h-7 flex items-center justify-center rounded-lg hover:bg-[#F3F4F6] transition-colors text-[#68717A]">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="overflow-y-auto flex-1 p-6">

          {/* ── Upload step ─────────────────────────── */}
          {step === "upload" && (
            <div className="space-y-4">
              <div
                onDrop={handleDrop}
                onDragOver={e => { e.preventDefault(); setIsDragging(true); }}
                onDragLeave={() => setIsDragging(false)}
                onClick={() => fileRef.current?.click()}
                className={`border-2 border-dashed rounded-xl p-10 flex flex-col items-center gap-3 cursor-pointer transition-colors ${
                  isDragging ? "border-[#038153] bg-[#F0FAF6]" : "border-[#D8DCDE] hover:border-[#038153] hover:bg-[#F8FFFC]"
                }`}
              >
                <Upload size={32} className={isDragging ? "text-[#038153]" : "text-[#C2C8CC]"} />
                <div className="text-center">
                  <p className="text-sm font-medium text-[#2F3941]">Prevucite CSV fajl ovdje</p>
                  <p className="text-xs text-[#68717A] mt-0.5">ili kliknite da odaberete fajl</p>
                </div>
                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={e => handleFile(e.target.files?.[0])}
                />
              </div>

              {parseError && (
                <div className="flex items-center gap-2 text-sm text-[#CC3340] bg-[#FFF0F1] px-3 py-2 rounded-lg">
                  <AlertCircle size={14} /> {parseError}
                </div>
              )}

              <div className="bg-[#F8F9F9] rounded-xl p-4 space-y-2">
                <p className="text-xs font-semibold text-[#68717A] uppercase tracking-wide">Podržane kolone u CSV-u</p>
                <div className="grid grid-cols-2 gap-x-4 gap-y-1">
                  {[
                    ["Contact", "Ime i prezime"],
                    ["Contact ID", "SerialID"],
                    ["Email address", "Primarni email"],
                    ["Dodatni email #2", "Dodatni email"],
                    ["Mobile", "Mobilni broj"],
                    ["Date of birth", "Datum rođenja"],
                    ["Datum kreacije kontakta", "Datum kreiranja"],
                    ["Spol", "Spol (Z / M)"],
                    ["Street", "Ulica"],
                    ["City", "Grad"],
                    ["Zip Code", "Poštanski broj"],
                  ].map(([col, desc]) => (
                    <div key={col} className="flex items-center gap-1.5 text-xs text-[#2F3941]">
                      <span className="font-mono bg-white border border-[#D8DCDE] px-1.5 py-0.5 rounded text-[11px] text-[#038153]">{col}</span>
                      <ArrowRight size={10} className="text-[#C2C8CC]" />
                      <span className="text-[#68717A]">{desc}</span>
                    </div>
                  ))}
                </div>
              </div>
            </div>
          )}

          {/* ── Preview step ─────────────────────────── */}
          {step === "preview" && (
            <div className="space-y-4">
              <div className="flex items-center gap-2 text-sm text-[#68717A]">
                <FileText size={13} />
                <span className="font-medium text-[#2F3941]">{fileName}</span>
                <span>· pregled prvih {Math.min(rows.length, 8)} redova</span>
              </div>

              <div className="overflow-x-auto rounded-xl border border-[#D8DCDE]">
                <table className="text-xs w-full">
                  <thead>
                    <tr className="bg-[#F8F9F9] border-b border-[#D8DCDE]">
                      {[
                        "Ime", "Prezime", "Email", "Dod. email",
                        "Mobitel", "Datum rođ.", "Spol", "Contact ID", "Kreiran",
                        "Ulica", "Grad", "Zip",
                      ].map(h => (
                        <th key={h} className="text-left px-3 py-2.5 font-semibold text-[#68717A] whitespace-nowrap">
                          {h}
                        </th>
                      ))}
                    </tr>
                  </thead>
                  <tbody>
                    {previewRows.map((row, i) => {
                      const parts = row.full_name.split(/\s+/).filter(Boolean);
                      const firstName = parts[0] ?? "—";
                      const lastName = parts.slice(1).join(" ") || "—";
                      const gender = row.gender.toUpperCase() === "Z" ? "female" : row.gender.toUpperCase() === "M" ? "male" : row.gender || "—";
                      const mobile = row.mobile.replace(/^'+/, "") || "—";
                      return (
                        <tr key={i} className={`border-b border-[#F3F4F6] ${i % 2 === 0 ? "" : "bg-[#FAFAFA]"}`}>
                          <td className="px-3 py-2 text-[#2F3941] font-medium whitespace-nowrap">{firstName}</td>
                          <td className="px-3 py-2 text-[#2F3941] whitespace-nowrap">{lastName}</td>
                          <td className="px-3 py-2 text-[#2F3941] max-w-[160px] truncate">{row.email || "—"}</td>
                          <td className="px-3 py-2 text-[#2F3941] max-w-[140px] truncate">{row.additional_email || "—"}</td>
                          <td className="px-3 py-2 text-[#2F3941] whitespace-nowrap">{mobile}</td>
                          <td className="px-3 py-2 text-[#2F3941] whitespace-nowrap">{row.date_of_birth || "—"}</td>
                          <td className="px-3 py-2 text-[#2F3941]">{gender}</td>
                          <td className="px-3 py-2 font-mono text-[#68717A]">{row.contact_id || "—"}</td>
                          <td className="px-3 py-2 text-[#68717A] whitespace-nowrap">{row.created_at ? row.created_at.slice(0, 10) : "—"}</td>
                          <td className="px-3 py-2 text-[#2F3941] max-w-[120px] truncate">{row.street || "—"}</td>
                          <td className="px-3 py-2 text-[#2F3941] whitespace-nowrap">{row.city || "—"}</td>
                          <td className="px-3 py-2 text-[#2F3941] whitespace-nowrap">{row.zip_code || "—"}</td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>

              {rows.length > 8 && (
                <p className="text-xs text-[#68717A] text-center">
                  + još {rows.length - 8} redova koji nisu prikazani
                </p>
              )}
            </div>
          )}

          {/* ── Importing step ─────────────────────────── */}
          {step === "importing" && (
            <div className="flex flex-col items-center gap-4 py-8">
              <Loader2 size={36} className="animate-spin text-[#038153]" />
              <div className="text-center">
                <p className="text-sm font-medium text-[#2F3941]">Import u toku...</p>
                <p className="text-xs text-[#68717A] mt-1">Uvoze se {rows.length} kontakata</p>
              </div>
            </div>
          )}

          {/* ── Done step ─────────────────────────── */}
          {step === "done" && result && (
            <div className="space-y-4">
              <div className="flex flex-col items-center gap-3 py-4">
                <CheckCircle2 size={40} className="text-[#038153]" />
                <div className="text-center">
                  <p className="text-base font-semibold text-[#2F3941]">Import završen</p>
                  <p className="text-sm text-[#68717A] mt-1">
                    {result.created} kontakata uvezeno
                    {result.errors.length > 0 ? `, ${result.errors.length} grešaka` : ""}
                  </p>
                </div>
              </div>

              {result.errors.length > 0 && (
                <div className="bg-[#FFF8F0] border border-[#FFCC80] rounded-xl p-4 space-y-2 max-h-48 overflow-y-auto">
                  <p className="text-xs font-semibold text-[#C77700] uppercase tracking-wide">Greške</p>
                  {result.errors.map((e, i) => (
                    <div key={i} className="text-xs text-[#2F3941]">
                      <span className="font-medium">Red {e.row}:</span> {e.message}
                    </div>
                  ))}
                </div>
              )}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="px-6 py-4 border-t border-[#D8DCDE] flex items-center justify-between shrink-0">
          <button
            onClick={step === "done" ? handleClose : step === "preview" ? reset : handleClose}
            className="h-8 px-4 text-sm font-medium rounded-lg border border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6] transition-colors"
          >
            {step === "done" ? "Zatvori" : step === "preview" ? "Nazad" : "Otkaži"}
          </button>

          {step === "preview" && (
            <button
              onClick={handleImport}
              className="h-8 px-5 text-sm font-medium rounded-lg text-white hover:brightness-110 active:scale-95 transition-all flex items-center gap-2"
              style={{ background: "#038153" }}
            >
              <Upload size={13} />
              Importuj {rows.length} kontakata
            </button>
          )}

          {step === "done" && result && result.errors.length === 0 && (
            <div className="flex items-center gap-1.5 text-sm text-[#038153] font-medium">
              <CheckCircle2 size={14} /> Uspješno
            </div>
          )}
        </div>
      </div>
    </>
  );

  return createPortal(modal, document.body);
}
