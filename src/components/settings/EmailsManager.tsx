"use client";

import { useState, useEffect, useCallback, useRef } from "react";
import {
  Plus, Pencil, Trash2, Loader2, FileText, PenLine,
  Bold, Italic, Heading1, Heading2, Quote, List, ListOrdered,
  Link2, Check, X,
} from "lucide-react";

// ── Types ─────────────────────────────────────────────────────────────────────

interface EmailTemplate {
  id: string;
  name: string;
  subject: string | null;
  body: string;
  created_at: string;
}

interface EmailSignature {
  id: string;
  name: string;
  body: string;
  created_at: string;
}

// ── Shared editor components ──────────────────────────────────────────────────

const FORMAT_COMMANDS = [
  { icon: <Bold size={13} />,        label: "Bold",          command: "bold" },
  { icon: <Italic size={13} />,      label: "Italic",        command: "italic" },
  { icon: <Heading1 size={13} />,    label: "Heading 1",     command: "formatBlock", value: "h1" },
  { icon: <Heading2 size={13} />,    label: "Heading 2",     command: "formatBlock", value: "h2" },
  { icon: <Quote size={13} />,       label: "Blockquote",    command: "formatBlock", value: "blockquote" },
  { icon: <List size={13} />,        label: "Bullet list",   command: "insertUnorderedList" },
  { icon: <ListOrdered size={13} />, label: "Numbered list", command: "insertOrderedList" },
];

function EditorToolbar({ editorRef }: { editorRef: React.RefObject<HTMLDivElement | null> }) {
  const [active, setActive] = useState<Record<string, boolean>>({});
  const [linkOpen, setLinkOpen] = useState(false);
  const [linkUrl, setLinkUrl] = useState("https://");
  const [linkText, setLinkText] = useState("");
  const savedRangeRef = useRef<Range | null>(null);

  const queryActive = () => {
    try {
      const blockRaw = (document.queryCommandValue("formatBlock") ?? "")
        .toLowerCase().replace(/^<|>$/g, "");
      setActive({
        bold:                document.queryCommandState("bold"),
        italic:              document.queryCommandState("italic"),
        insertUnorderedList: document.queryCommandState("insertUnorderedList"),
        insertOrderedList:   document.queryCommandState("insertOrderedList"),
        [`block_${blockRaw}`]: !!blockRaw,
      });
    } catch { /* ignore */ }
  };

  const isActive = (command: string, value?: string) =>
    command === "formatBlock"
      ? active[`block_${value?.toLowerCase() ?? ""}`] ?? false
      : active[command] ?? false;

  const handleLinkInsert = () => {
    const trimmed = linkUrl.trim();
    if (!trimmed || trimmed === "https://") return;
    const displayText = linkText.trim() || trimmed;
    const editor = editorRef.current;
    if (!editor) return;

    const link = document.createElement("a");
    link.href = trimmed;
    link.textContent = displayText;
    link.setAttribute("data-editor-link", "true");
    link.style.color = "#1D6FA4";
    link.style.textDecoration = "underline";
    link.style.textDecorationStyle = "dotted";
    link.style.cursor = "pointer";

    const range = savedRangeRef.current;
    if (range) {
      const sel = window.getSelection();
      sel?.removeAllRanges();
      sel?.addRange(range);
      range.deleteContents();
      range.insertNode(link);
      const newRange = document.createRange();
      newRange.setStartAfter(link);
      newRange.collapse(true);
      sel?.removeAllRanges();
      sel?.addRange(newRange);
    } else {
      editor.focus();
      editor.appendChild(link);
    }
    setLinkOpen(false);
    setLinkUrl("https://");
    setLinkText("");
    savedRangeRef.current = null;
  };

  return (
    <div className="flex items-center gap-0.5 px-2 py-1.5 border-b border-[#D8DCDE] bg-[#F8F9F9] flex-wrap">
      {FORMAT_COMMANDS.map(({ icon, label, command, value }) => {
        const on = isActive(command, value);
        return (
          <button
            key={label}
            type="button"
            title={label}
            onMouseDown={(e) => {
              e.preventDefault();
              editorRef.current?.focus();
              // eslint-disable-next-line @typescript-eslint/no-deprecated
              document.execCommand(command, false, value);
              requestAnimationFrame(() => queryActive());
            }}
            className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
              on ? "bg-[#EAF7F0] text-[#038153]" : "text-[#2F3941] hover:bg-[#F3F4F6]"
            }`}
          >
            {icon}
          </button>
        );
      })}

      <span className="w-px h-4 bg-[#D8DCDE] mx-1" />

      {/* Link button */}
      <div className="relative">
        <button
          type="button"
          title="Insert link"
          onMouseDown={(e) => {
            e.preventDefault();
            const sel = window.getSelection();
            if (sel && sel.rangeCount > 0 && editorRef.current?.contains(sel.anchorNode)) {
              savedRangeRef.current = sel.getRangeAt(0).cloneRange();
              setLinkText(sel.toString());
            }
            setLinkOpen((o) => !o);
          }}
          className={`w-7 h-7 flex items-center justify-center rounded-md transition-colors ${
            linkOpen ? "bg-[#EAF7F0] text-[#038153]" : "text-[#2F3941] hover:bg-[#F3F4F6]"
          }`}
        >
          <Link2 size={13} />
        </button>

        {linkOpen && (
          <div className="absolute z-50 top-full mt-1 left-0 w-64 bg-white rounded-lg border border-[#D8DCDE] shadow-lg p-3 flex flex-col gap-2">
            <input
              autoFocus
              value={linkUrl}
              onChange={(e) => setLinkUrl(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLinkInsert(); if (e.key === "Escape") setLinkOpen(false); }}
              placeholder="https://..."
              className="h-7 px-2.5 text-xs rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153]"
            />
            <input
              value={linkText}
              onChange={(e) => setLinkText(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") handleLinkInsert(); if (e.key === "Escape") setLinkOpen(false); }}
              placeholder="Display text (optional)"
              className="h-7 px-2.5 text-xs rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153]"
            />
            <div className="flex justify-end gap-1.5">
              <button type="button" onClick={() => setLinkOpen(false)}
                className="h-6 px-2.5 text-xs rounded-md border border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6]">
                Cancel
              </button>
              <button type="button" onClick={handleLinkInsert}
                className="h-6 px-2.5 text-xs rounded-md text-white flex items-center gap-1 hover:brightness-110"
                style={{ background: "#038153" }}>
                <Check size={10} /> Insert
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

// ── Rich editor ───────────────────────────────────────────────────────────────

function RichEditor({
  editorRef,
  placeholder = "Write content...",
  onInput,
}: {
  editorRef: React.RefObject<HTMLDivElement | null>;
  placeholder?: string;
  onInput: (text: string) => void;
}) {
  const [empty, setEmpty] = useState(true);

  return (
    <div className="border border-[#D8DCDE] rounded-md overflow-hidden focus-within:border-[#038153] focus-within:ring-1 focus-within:ring-[#038153] transition-colors">
      <EditorToolbar editorRef={editorRef} />
      <div className="relative">
        <div
          ref={editorRef}
          contentEditable
          suppressContentEditableWarning
          onInput={() => {
            const text = editorRef.current?.innerText?.trim() ?? "";
            setEmpty(!text);
            onInput(text);
          }}
          className="min-h-[120px] px-3 py-2 text-sm text-[#2F3941] focus:outline-none"
          style={{ resize: "vertical", overflow: "auto" }}
        />
        {empty && (
          <div className="absolute top-2 left-3 text-sm text-[#C2C8CC] pointer-events-none select-none">
            {placeholder}
          </div>
        )}
      </div>
    </div>
  );
}

// ── Delete confirmation ───────────────────────────────────────────────────────

function DeleteConfirm({ name, onConfirm, onCancel }: { name: string; onConfirm: () => void; onCancel: () => void }) {
  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/30">
      <div className="bg-white rounded-xl shadow-xl p-6 w-80 space-y-4">
        <h3 className="text-sm font-semibold text-[#2F3941]">Delete &ldquo;{name}&rdquo;?</h3>
        <p className="text-sm text-[#68717A]">This action cannot be undone.</p>
        <div className="flex justify-end gap-2">
          <button onClick={onCancel} className="h-8 px-4 text-sm rounded-md border border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6] transition-colors">
            Cancel
          </button>
          <button onClick={onConfirm} className="h-8 px-4 text-sm rounded-md text-white hover:brightness-110 transition-all" style={{ background: "#CC3340" }}>
            Delete
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Templates tab ─────────────────────────────────────────────────────────────

function TemplatesTab() {
  const [items, setItems] = useState<EmailTemplate[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<EmailTemplate | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailTemplate | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [subject, setSubject] = useState("");
  const [bodyText, setBodyText] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-templates");
      if (!res.ok) throw new Error("Failed to load");
      setItems(await res.json());
    } catch { setError("Failed to load templates"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditItem(null);
    setName("");
    setSubject("");
    setBodyText("");
    if (editorRef.current) editorRef.current.innerHTML = "";
    setError(null);
    setShowForm(true);
  };

  const openEdit = (item: EmailTemplate) => {
    setEditItem(item);
    setName(item.name);
    setSubject(item.subject ?? "");
    setBodyText(item.body);
    setError(null);
    setShowForm(true);
    // Populate editor after render
    requestAnimationFrame(() => {
      if (editorRef.current) editorRef.current.innerHTML = item.body;
    });
  };

  const handleSave = async () => {
    if (!name.trim() || !bodyText.trim()) {
      setError("Name and content are required.");
      return;
    }
    const html = editorRef.current?.innerHTML ?? bodyText;
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), subject: subject.trim() || null, body: html };
      const res = editItem
        ? await fetch(`/api/email-templates/${editItem.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/email-templates", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleDelete = async (item: EmailTemplate) => {
    try {
      await fetch(`/api/email-templates/${item.id}`, { method: "DELETE" });
      await load();
    } catch { /* ignore */ }
    finally { setDeleteTarget(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-[#68717A]" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreate} className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md text-white hover:brightness-110 transition-all" style={{ background: "#038153" }}>
          <Plus size={14} /> New Template
        </button>
      </div>

      {items.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <FileText size={32} className="text-[#C2C8CC] mb-3" />
          <p className="text-sm font-medium text-[#68717A]">No templates yet</p>
          <p className="text-xs text-[#C2C8CC] mt-1">Create a template to quickly reuse email content.</p>
        </div>
      )}

      {items.map((item) => (
        <div key={item.id} className="bg-white rounded-lg border border-[#D8DCDE] px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#2F3941] truncate">{item.name}</p>
            {item.subject && <p className="text-xs text-[#68717A] mt-0.5 truncate">Subject: {item.subject}</p>}
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => openEdit(item)} title="Edit" className="w-7 h-7 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={() => setDeleteTarget(item)} title="Delete" className="w-7 h-7 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      {/* Create / Edit form */}
      {showForm && (
        <div className="bg-white rounded-xl border border-[#D8DCDE] shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#2F3941]">{editItem ? "Edit Template" : "New Template"}</h3>
            <button onClick={() => setShowForm(false)} className="text-[#68717A] hover:text-[#2F3941]"><X size={15} /></button>
          </div>

          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Template name *"
              className="w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
            />
            <input
              value={subject}
              onChange={(e) => setSubject(e.target.value)}
              placeholder="Subject (optional)"
              className="w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
            />
            <RichEditor
              editorRef={editorRef}
              placeholder="Write email content..."
              onInput={setBodyText}
            />
          </div>

          {error && <p className="text-xs text-[#CC3340]">{error}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="h-8 px-4 text-sm rounded-md border border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6] transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 h-8 px-4 text-sm rounded-md text-white hover:brightness-110 disabled:opacity-50 transition-all" style={{ background: "#038153" }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : null}
              {editItem ? "Save Changes" : "Create Template"}
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ── Signatures tab ────────────────────────────────────────────────────────────

function SignaturesTab() {
  const [items, setItems] = useState<EmailSignature[]>([]);
  const [loading, setLoading] = useState(true);
  const [showForm, setShowForm] = useState(false);
  const [editItem, setEditItem] = useState<EmailSignature | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<EmailSignature | null>(null);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [name, setName] = useState("");
  const [bodyText, setBodyText] = useState("");
  const editorRef = useRef<HTMLDivElement>(null);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/email-signatures");
      if (!res.ok) throw new Error("Failed to load");
      setItems(await res.json());
    } catch { setError("Failed to load tags"); }
    finally { setLoading(false); }
  }, []);

  useEffect(() => { void load(); }, [load]);

  const openCreate = () => {
    setEditItem(null);
    setName("");
    setBodyText("");
    if (editorRef.current) editorRef.current.innerHTML = "";
    setError(null);
    setShowForm(true);
  };

  const openEdit = (item: EmailSignature) => {
    setEditItem(item);
    setName(item.name);
    setBodyText(item.body);
    setError(null);
    setShowForm(true);
    requestAnimationFrame(() => {
      if (editorRef.current) editorRef.current.innerHTML = item.body;
    });
  };

  const handleSave = async () => {
    if (!name.trim() || !bodyText.trim()) {
      setError("Name and content are required.");
      return;
    }
    const html = editorRef.current?.innerHTML ?? bodyText;
    setSaving(true);
    setError(null);
    try {
      const payload = { name: name.trim(), body: html };
      const res = editItem
        ? await fetch(`/api/email-signatures/${editItem.id}`, { method: "PUT", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) })
        : await fetch("/api/email-signatures", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify(payload) });
      if (!res.ok) throw new Error((await res.json()).error ?? "Failed to save");
      setShowForm(false);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : "Failed to save");
    } finally { setSaving(false); }
  };

  const handleDelete = async (item: EmailSignature) => {
    try {
      await fetch(`/api/email-signatures/${item.id}`, { method: "DELETE" });
      await load();
    } catch { /* ignore */ }
    finally { setDeleteTarget(null); }
  };

  if (loading) return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-[#68717A]" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex justify-end">
        <button onClick={openCreate} className="flex items-center gap-1.5 h-8 px-3 text-sm font-medium rounded-md text-white hover:brightness-110 transition-all" style={{ background: "#038153" }}>
          <Plus size={14} /> New Tag
        </button>
      </div>

      {items.length === 0 && !showForm && (
        <div className="flex flex-col items-center justify-center py-16 text-center">
          <PenLine size={32} className="text-[#C2C8CC] mb-3" />
          <p className="text-sm font-medium text-[#68717A]">No tags yet</p>
          <p className="text-xs text-[#C2C8CC] mt-1">Create a tag to quickly insert into your emails.</p>
        </div>
      )}

      {items.map((item) => (
        <div key={item.id} className="bg-white rounded-lg border border-[#D8DCDE] px-4 py-3 flex items-start justify-between gap-3">
          <div className="min-w-0">
            <p className="text-sm font-medium text-[#2F3941] truncate">{item.name}</p>
          </div>
          <div className="flex items-center gap-1 shrink-0">
            <button onClick={() => openEdit(item)} title="Edit" className="w-7 h-7 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#F3F4F6] hover:text-[#2F3941] transition-colors">
              <Pencil size={13} />
            </button>
            <button onClick={() => setDeleteTarget(item)} title="Delete" className="w-7 h-7 flex items-center justify-center rounded-md text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] transition-colors">
              <Trash2 size={13} />
            </button>
          </div>
        </div>
      ))}

      {showForm && (
        <div className="bg-white rounded-xl border border-[#D8DCDE] shadow-sm p-5 space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-sm font-semibold text-[#2F3941]">{editItem ? "Edit Tag" : "New Tag"}</h3>
            <button onClick={() => setShowForm(false)} className="text-[#68717A] hover:text-[#2F3941]"><X size={15} /></button>
          </div>

          <div className="space-y-3">
            <input
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Tag name *"
              className="w-full h-9 px-3 text-sm rounded-md border border-[#D8DCDE] text-[#2F3941] placeholder-[#C2C8CC] focus:outline-none focus:border-[#038153] focus:ring-1 focus:ring-[#038153] transition-colors"
            />
            <RichEditor
              editorRef={editorRef}
              placeholder="Write tag content..."
              onInput={setBodyText}
            />
          </div>

          {error && <p className="text-xs text-[#CC3340]">{error}</p>}

          <div className="flex justify-end gap-2">
            <button onClick={() => setShowForm(false)} className="h-8 px-4 text-sm rounded-md border border-[#D8DCDE] text-[#68717A] hover:bg-[#F3F4F6] transition-colors">
              Cancel
            </button>
            <button onClick={handleSave} disabled={saving} className="flex items-center gap-1.5 h-8 px-4 text-sm rounded-md text-white hover:brightness-110 disabled:opacity-50 transition-all" style={{ background: "#038153" }}>
              {saving ? <Loader2 size={12} className="animate-spin" /> : null}
              {editItem ? "Save Changes" : "Create Tag"}
            </button>
          </div>
        </div>
      )}

      {deleteTarget && (
        <DeleteConfirm
          name={deleteTarget.name}
          onConfirm={() => handleDelete(deleteTarget)}
          onCancel={() => setDeleteTarget(null)}
        />
      )}
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function EmailsManager() {
  const [tab, setTab] = useState<"templates" | "tags">("templates");

  const tabLabels: Record<string, string> = { templates: "Templates", tags: "Tags" };

  return (
    <div className="bg-white rounded-xl border border-[#D8DCDE] shadow-sm overflow-hidden">
      {/* Tab bar */}
      <div className="flex border-b border-[#D8DCDE] px-4">
        {(["templates", "tags"] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={[
              "px-4 py-3 text-sm font-medium transition-colors focus:outline-none",
              tab === t
                ? "border-b-2 border-[#038153] text-[#2F3941] -mb-px"
                : "text-[#68717A] hover:text-[#2F3941]",
            ].join(" ")}
          >
            {tabLabels[t]}
          </button>
        ))}
      </div>

      <div className="p-5">
        {tab === "templates" ? <TemplatesTab /> : <SignaturesTab />}
      </div>
    </div>
  );
}
