"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Plus, Pencil, Trash2, KeyRound, Loader2, X, AlertTriangle, Check, Shield, User
} from "lucide-react";

interface AdminUser {
  id: string;
  first_name: string;
  last_name: string;
  email: string;
  role: "super_admin" | "admin";
  created_at: string;
  platforms: { platform_id: string; platform: { id: string; name: string; slug: string } }[];
}

interface Platform {
  id: string;
  name: string;
  slug: string;
}

// ── Helpers ────────────────────────────────────────────────────────────────────

function initials(first: string, last: string) {
  return `${first.charAt(0)}${last.charAt(0)}`.toUpperCase();
}

function avatarColor(role: "super_admin" | "admin") {
  return role === "super_admin"
    ? { background: "#1A3353", color: "#fff" }
    : { background: "#E4E7EB", color: "#2F3941" };
}

// ── Role Badge ─────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: "super_admin" | "admin" }) {
  if (role === "super_admin") {
    return (
      <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
        style={{ background: "#1A3353", color: "#fff" }}>
        <Shield size={10} />
        Super Admin
      </span>
    );
  }
  return (
    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-xs font-medium"
      style={{ background: "#E4E7EB", color: "#2F3941" }}>
      <User size={10} />
      Admin
    </span>
  );
}

// ── Create / Edit Modal ────────────────────────────────────────────────────────

interface CreateEditModalProps {
  open: boolean;
  onClose: () => void;
  onSaved: () => void;
  user: AdminUser | null;
  platforms: Platform[];
}

function CreateEditModal({ open, onClose, onSaved, user, platforms }: CreateEditModalProps) {
  const isEdit = !!user;

  const [firstName, setFirstName] = useState("");
  const [lastName, setLastName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [role, setRole] = useState<"admin" | "super_admin">("admin");
  const [selectedPlatforms, setSelectedPlatforms] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (user) {
      setFirstName(user.first_name);
      setLastName(user.last_name);
      setEmail(user.email);
      setPassword("");
      setRole(user.role);
      setSelectedPlatforms(user.platforms.map((p) => p.platform_id));
    } else {
      setFirstName("");
      setLastName("");
      setEmail("");
      setPassword("");
      setRole("admin");
      setSelectedPlatforms([]);
    }
    setError(null);
  }, [open, user]);

  function togglePlatform(id: string) {
    setSelectedPlatforms((prev) =>
      prev.includes(id) ? prev.filter((p) => p !== id) : [...prev, id]
    );
  }

  function handleRoleChange(newRole: "admin" | "super_admin") {
    setRole(newRole);
    if (newRole === "super_admin") {
      setSelectedPlatforms([]);
    }
  }

  async function handleSave() {
    setError(null);
    if (!firstName.trim() || !lastName.trim() || !email.trim()) {
      setError("First name, last name and email are required.");
      return;
    }
    if (!isEdit && !password.trim()) {
      setError("Password is required.");
      return;
    }
    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        first_name: firstName.trim(),
        last_name: lastName.trim(),
        email: email.trim(),
        role,
        platform_ids: role === "admin" ? selectedPlatforms : [],
      };
      if (!isEdit) body.password = password;

      const res = await fetch(
        isEdit ? `/api/admin/users/${user!.id}` : "/api/admin/users",
        {
          method: isEdit ? "PATCH" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(body),
        }
      );
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to save user.");
      }
      onSaved();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-md bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
        {/* Header */}
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8DCDE]">
          <h2 className="text-[14px] font-semibold text-[#2F3941]">
            {isEdit ? "Edit Admin" : "New Admin"}
          </h2>
          <button onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6]">
            <X size={15} />
          </button>
        </div>

        {/* Body */}
        <div className="px-5 py-4 flex flex-col gap-3 max-h-[70vh] overflow-y-auto">
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
              style={{ background: "#FFF0F1", color: "#CC3340" }}>
              <AlertTriangle size={14} className="shrink-0" />
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#2F3941]">First Name <span className="text-[#CC3340]">*</span></label>
              <input
                value={firstName}
                onChange={(e) => setFirstName(e.target.value)}
                className="h-8 px-3 rounded-md border border-[#D8DCDE] text-sm text-[#2F3941] placeholder:text-[#68717A] focus:outline-none focus:ring-1 focus:ring-[#038153] focus:border-[#038153]"
                placeholder="First name"
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#2F3941]">Last Name <span className="text-[#CC3340]">*</span></label>
              <input
                value={lastName}
                onChange={(e) => setLastName(e.target.value)}
                className="h-8 px-3 rounded-md border border-[#D8DCDE] text-sm text-[#2F3941] placeholder:text-[#68717A] focus:outline-none focus:ring-1 focus:ring-[#038153] focus:border-[#038153]"
                placeholder="Last name"
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#2F3941]">Email <span className="text-[#CC3340]">*</span></label>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-8 px-3 rounded-md border border-[#D8DCDE] text-sm text-[#2F3941] placeholder:text-[#68717A] focus:outline-none focus:ring-1 focus:ring-[#038153] focus:border-[#038153]"
              placeholder="email@example.com"
            />
          </div>

          {!isEdit && (
            <div className="flex flex-col gap-1">
              <label className="text-xs font-medium text-[#2F3941]">Password <span className="text-[#CC3340]">*</span></label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                className="h-8 px-3 rounded-md border border-[#D8DCDE] text-sm text-[#2F3941] placeholder:text-[#68717A] focus:outline-none focus:ring-1 focus:ring-[#038153] focus:border-[#038153]"
                placeholder="Min 8 characters"
              />
            </div>
          )}

          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#2F3941]">Role</label>
            <select
              value={role}
              onChange={(e) => handleRoleChange(e.target.value as "admin" | "super_admin")}
              className="h-8 px-3 rounded-md border border-[#D8DCDE] text-sm text-[#2F3941] focus:outline-none focus:ring-1 focus:ring-[#038153] focus:border-[#038153] bg-white">
              <option value="admin">Admin</option>
              <option value="super_admin">Super Admin</option>
            </select>
          </div>

          {role === "admin" && platforms.length > 0 && (
            <div className="flex flex-col gap-2">
              <label className="text-xs font-medium text-[#2F3941]">Platform Access</label>
              <div className="border border-[#D8DCDE] rounded-md overflow-hidden">
                {platforms.map((p, i) => (
                  <label key={p.id}
                    className={`flex items-center gap-2.5 px-3 py-2 cursor-pointer hover:bg-[#F8F9F9] ${i > 0 ? "border-t border-[#D8DCDE]" : ""}`}>
                    <div
                      onClick={() => togglePlatform(p.id)}
                      className={`w-4 h-4 rounded flex items-center justify-center shrink-0 border transition-colors cursor-pointer ${
                        selectedPlatforms.includes(p.id)
                          ? "border-[#038153] bg-[#038153]"
                          : "border-[#D8DCDE] bg-white"
                      }`}>
                      {selectedPlatforms.includes(p.id) && <Check size={10} className="text-white" strokeWidth={3} />}
                    </div>
                    <span className="text-sm text-[#2F3941]">{p.name}</span>
                    <span className="text-xs text-[#68717A] ml-auto">{p.slug}</span>
                  </label>
                ))}
              </div>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9]">
          <button onClick={onClose}
            className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6]">
            Cancel
          </button>
          <button
            onClick={handleSave}
            disabled={saving}
            className="h-8 px-4 text-sm font-medium rounded-md text-white flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: "#038153" }}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            {isEdit ? "Save Changes" : "Create Admin"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── Reset Password Modal ───────────────────────────────────────────────────────

interface ResetPasswordModalProps {
  open: boolean;
  onClose: () => void;
  user: AdminUser | null;
}

function ResetPasswordModal({ open, onClose, user }: ResetPasswordModalProps) {
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState(false);

  useEffect(() => {
    if (!open) return;
    setPassword("");
    setConfirm("");
    setError(null);
    setSuccess(false);
  }, [open]);

  async function handleReset() {
    setError(null);
    if (password.length < 8) {
      setError("Password must be at least 8 characters.");
      return;
    }
    if (password !== confirm) {
      setError("Passwords do not match.");
      return;
    }
    setSaving(true);
    try {
      const res = await fetch(`/api/admin/users/${user!.id}/reset-password`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password }),
      });
      if (!res.ok) {
        const data = await res.json().catch(() => ({}));
        throw new Error(data?.error || "Failed to reset password.");
      }
      setSuccess(true);
      setTimeout(() => { onClose(); }, 1200);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : "Unexpected error.");
    } finally {
      setSaving(false);
    }
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center">
      <div className="absolute inset-0 bg-black/40 backdrop-blur-[2px]" onClick={onClose} />
      <div className="relative z-10 w-full max-w-sm bg-white rounded-xl overflow-hidden"
        style={{ boxShadow: "0 25px 60px rgba(0,0,0,0.18)" }}>
        <div className="flex items-center justify-between px-5 py-4 border-b border-[#D8DCDE]">
          <div className="flex items-center gap-2.5">
            <div className="w-8 h-8 rounded-full bg-[#F0F4FF] flex items-center justify-center">
              <KeyRound size={14} className="text-[#1A3353]" />
            </div>
            <h2 className="text-[14px] font-semibold text-[#2F3941]">Reset Password</h2>
          </div>
          <button onClick={onClose}
            className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#F3F4F6]">
            <X size={15} />
          </button>
        </div>

        <div className="px-5 py-4 flex flex-col gap-3">
          {user && (
            <p className="text-sm text-[#68717A]">
              Set a new password for <span className="font-medium text-[#2F3941]">{user.first_name} {user.last_name}</span>.
            </p>
          )}
          {error && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
              style={{ background: "#FFF0F1", color: "#CC3340" }}>
              <AlertTriangle size={14} className="shrink-0" />
              {error}
            </div>
          )}
          {success && (
            <div className="flex items-center gap-2 px-3 py-2 rounded-md text-sm"
              style={{ background: "#F0FBF6", color: "#038153" }}>
              <Check size={14} className="shrink-0" />
              Password reset successfully.
            </div>
          )}
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#2F3941]">New Password</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-8 px-3 rounded-md border border-[#D8DCDE] text-sm text-[#2F3941] placeholder:text-[#68717A] focus:outline-none focus:ring-1 focus:ring-[#038153] focus:border-[#038153]"
              placeholder="Min 8 characters"
            />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-xs font-medium text-[#2F3941]">Confirm Password</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              className="h-8 px-3 rounded-md border border-[#D8DCDE] text-sm text-[#2F3941] placeholder:text-[#68717A] focus:outline-none focus:ring-1 focus:ring-[#038153] focus:border-[#038153]"
              placeholder="Repeat password"
              onKeyDown={(e) => { if (e.key === "Enter") handleReset(); }}
            />
          </div>
        </div>

        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-[#D8DCDE] bg-[#F8F9F9]">
          <button onClick={onClose}
            className="h-8 px-4 text-sm font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6]">
            Cancel
          </button>
          <button
            onClick={handleReset}
            disabled={saving || success}
            className="h-8 px-4 text-sm font-medium rounded-md text-white flex items-center gap-1.5 disabled:opacity-60"
            style={{ background: "#038153" }}>
            {saving && <Loader2 size={13} className="animate-spin" />}
            Reset Password
          </button>
        </div>
      </div>
    </div>
  );
}

// ── User Row ───────────────────────────────────────────────────────────────────

interface UserRowProps {
  user: AdminUser;
  onEdit: () => void;
  onResetPassword: () => void;
  onDelete: () => void;
  confirmingDelete: boolean;
  onConfirmDelete: () => void;
  onCancelDelete: () => void;
  deleting: boolean;
}

function UserRow({
  user, onEdit, onResetPassword, onDelete,
  confirmingDelete, onConfirmDelete, onCancelDelete, deleting
}: UserRowProps) {
  const avatarStyle = avatarColor(user.role);

  return (
    <div className="group flex items-center gap-3 px-4 py-3 border-b border-[#D8DCDE] last:border-b-0 hover:bg-[#F8F9F9] transition-colors">
      {/* Avatar */}
      <div className="w-8 h-8 rounded-full flex items-center justify-center text-xs font-semibold shrink-0"
        style={avatarStyle}>
        {initials(user.first_name, user.last_name)}
      </div>

      {/* Name + email */}
      <div className="flex flex-col min-w-0 flex-1">
        <div className="flex items-center gap-2 flex-wrap">
          <span className="text-sm font-medium text-[#2F3941] truncate">
            {user.first_name} {user.last_name}
          </span>
          <RoleBadge role={user.role} />
        </div>
        <span className="text-xs text-[#68717A] truncate">{user.email}</span>
      </div>

      {/* Platform tags */}
      <div className="hidden sm:flex items-center gap-1 flex-wrap max-w-[220px]">
        {user.platforms.length === 0 ? (
          <span className="text-xs text-[#68717A] italic">All platforms</span>
        ) : (
          user.platforms.slice(0, 3).map((p) => (
            <span key={p.platform_id}
              className="px-2 py-0.5 text-xs rounded-md border border-[#D8DCDE] text-[#2F3941] bg-white">
              {p.platform.name}
            </span>
          ))
        )}
        {user.platforms.length > 3 && (
          <span className="px-2 py-0.5 text-xs rounded-md border border-[#D8DCDE] text-[#68717A] bg-white">
            +{user.platforms.length - 3}
          </span>
        )}
      </div>

      {/* Actions */}
      <div className="flex items-center gap-1 ml-auto shrink-0">
        {confirmingDelete ? (
          <div className="flex items-center gap-2">
            <span className="text-xs text-[#CC3340] font-medium">Are you sure?</span>
            <button
              onClick={onConfirmDelete}
              disabled={deleting}
              className="h-7 px-3 text-xs font-medium rounded-md text-white flex items-center gap-1 disabled:opacity-60"
              style={{ background: "#CC3340" }}>
              {deleting ? <Loader2 size={11} className="animate-spin" /> : <Check size={11} />}
              Confirm
            </button>
            <button
              onClick={onCancelDelete}
              className="h-7 px-3 text-xs font-medium rounded-md border border-[#D8DCDE] bg-white text-[#2F3941] hover:bg-[#F3F4F6]">
              Cancel
            </button>
          </div>
        ) : (
          <>
            <button
              onClick={onEdit}
              title="Edit"
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#E4E7EB] opacity-0 group-hover:opacity-100 transition-opacity">
              <Pencil size={13} />
            </button>
            <button
              onClick={onResetPassword}
              title="Reset Password"
              className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#E4E7EB] opacity-0 group-hover:opacity-100 transition-opacity">
              <KeyRound size={13} />
            </button>
            {user.role !== "super_admin" && (
              <button
                onClick={onDelete}
                title="Delete"
                className="w-7 h-7 rounded-md flex items-center justify-center text-[#68717A] hover:bg-[#FFF0F1] hover:text-[#CC3340] opacity-0 group-hover:opacity-100 transition-opacity">
                <Trash2 size={13} />
              </button>
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ── Main Component ─────────────────────────────────────────────────────────────

export default function AdminManager() {
  const [users, setUsers] = useState<AdminUser[]>([]);
  const [platforms, setPlatforms] = useState<Platform[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const [modalOpen, setModalOpen] = useState(false);
  const [editUser, setEditUser] = useState<AdminUser | null>(null);

  const [resetUser, setResetUser] = useState<AdminUser | null>(null);
  const [resetModalOpen, setResetModalOpen] = useState(false);

  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);
  const [deletingId, setDeletingId] = useState<string | null>(null);

  const fetchAll = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const [usersRes, platformsRes] = await Promise.all([
        fetch("/api/admin/users"),
        fetch("/api/platforms"),
      ]);
      if (!usersRes.ok) throw new Error("Failed to load users.");
      if (!platformsRes.ok) throw new Error("Failed to load platforms.");
      const usersData = await usersRes.json();
      const platformsData = await platformsRes.json();
      setUsers(usersData.users ?? []);
      setPlatforms(platformsData.platforms ?? []);
    } catch (e: unknown) {
      setFetchError(e instanceof Error ? e.message : "Failed to load data.");
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchAll(); }, [fetchAll]);

  function openCreate() {
    setEditUser(null);
    setModalOpen(true);
  }

  function openEdit(user: AdminUser) {
    setEditUser(user);
    setModalOpen(true);
  }

  function openResetPassword(user: AdminUser) {
    setResetUser(user);
    setResetModalOpen(true);
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    try {
      const res = await fetch(`/api/admin/users/${id}`, { method: "DELETE" });
      if (!res.ok) throw new Error("Delete failed.");
      setUsers((prev) => prev.filter((u) => u.id !== id));
    } catch {
      // silently fall through — row stays visible
    } finally {
      setDeletingId(null);
      setConfirmDeleteId(null);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-[#68717A]">
        <Loader2 size={20} className="animate-spin mr-2" />
        <span className="text-sm">Loading admins...</span>
      </div>
    );
  }

  if (fetchError) {
    return (
      <div className="flex items-center gap-2 px-4 py-3 rounded-lg text-sm"
        style={{ background: "#FFF0F1", color: "#CC3340" }}>
        <AlertTriangle size={15} className="shrink-0" />
        {fetchError}
        <button onClick={fetchAll} className="ml-auto text-xs underline hover:no-underline">Retry</button>
      </div>
    );
  }

  return (
    <>
      {/* Toolbar */}
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-[#68717A]">
          {users.length} {users.length === 1 ? "admin" : "admins"}
        </span>
        <button
          onClick={openCreate}
          className="h-8 px-3 text-sm font-medium rounded-md text-white flex items-center gap-1.5 hover:brightness-110 transition-all"
          style={{ background: "#038153" }}>
          <Plus size={14} />
          New Admin
        </button>
      </div>

      {/* Table */}
      <div className="border border-[#D8DCDE] rounded-xl overflow-hidden bg-white">
        {users.length === 0 ? (
          <div className="py-12 text-center text-sm text-[#68717A]">
            No admin users found. Create one to get started.
          </div>
        ) : (
          users.map((user) => (
            <UserRow
              key={user.id}
              user={user}
              onEdit={() => openEdit(user)}
              onResetPassword={() => openResetPassword(user)}
              onDelete={() => setConfirmDeleteId(user.id)}
              confirmingDelete={confirmDeleteId === user.id}
              onConfirmDelete={() => handleDelete(user.id)}
              onCancelDelete={() => setConfirmDeleteId(null)}
              deleting={deletingId === user.id}
            />
          ))
        )}
      </div>

      {/* Modals */}
      <CreateEditModal
        open={modalOpen}
        onClose={() => setModalOpen(false)}
        onSaved={fetchAll}
        user={editUser}
        platforms={platforms}
      />
      <ResetPasswordModal
        open={resetModalOpen}
        onClose={() => setResetModalOpen(false)}
        user={resetUser}
      />
    </>
  );
}
