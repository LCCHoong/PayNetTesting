"use client";
import { useEffect, useRef, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BACKEND_URL } from "@/lib/backend-url";

// ─── Types ────────────────────────────────────────────────────────────────────
type Merchant = {
  id: string; name: string; location: string; description: string;
  email: string; phone_number: string; owner_name: string;
  is_active: boolean; is_preview?: boolean; duitnow_qr_url?: string; display_order?: number;
};
type Slot = { id: string; time_slot: string; current_bookings: number; max_capacity: number; is_full?: boolean };
type Item = { id: string; name: string; price: number; is_available: boolean; image_url?: string | null; approval_status?: string };
type Order = { id: string; order_number?: string; customer_name: string; status: string; total_price: number; transaction_ref?: string; items: { name: string; quantity: number }[] };
type Event = { id: string; name: string; location: string; description?: string; start_time: string; end_time: string; banner_image_url?: string; event_url?: string };
type AdminTab = "merchants" | "events";

const money = (n: number) => `RM ${Number(n).toFixed(2)}`;
const fmt = (ts: string) => new Date(ts).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur", dateStyle: "medium", timeStyle: "short" });
const inputCls = "mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500";

// ─── Spinner ─────────────────────────────────────────────────────────────────
function Spinner({ small }: { small?: boolean }) {
  return <div className={`animate-spin rounded-full border-4 border-violet-200 border-t-violet-600 ${small ? "h-4 w-4" : "h-7 w-7"}`} />;
}

// ─── Status badge ──────────────────────────────────────────────────────────────
function StatusBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    approved: "bg-emerald-100 text-emerald-700",
    rejected: "bg-red-100 text-red-600",
    pending: "bg-amber-100 text-amber-700",
  };
  return <span className={`inline-block rounded-full px-2.5 py-0.5 text-[10px] font-bold capitalize ${map[status] ?? map.pending}`}>{status}</span>;
}

export default function AdminMerchants() {
  const router = useRouter();

  // ── Global ──
  const [tab, setTab] = useState<AdminTab>("merchants");
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [toast, setToast] = useState<{ msg: string; type: "ok" | "err" } | null>(null);

  // ── Merchant detail ──
  const [selectedId, setSelectedId] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Edit modal ──
  const [editMerchant, setEditMerchant] = useState<Merchant | null>(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editBio, setEditBio] = useState("");

  // ── Reorder ──
  const [reorderMode, setReorderMode] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);

  // ── Events ──
  const [eventId, setEventId] = useState("");
  const [eventMemberIds, setEventMemberIds] = useState<string[]>([]);
  const [eventName, setEventName] = useState("");
  const [eventLocation, setEventLocation] = useState("");
  const [eventDesc, setEventDesc] = useState("");
  const [eventStart, setEventStart] = useState("");
  const [eventEnd, setEventEnd] = useState("");
  const [eventUrl, setEventUrl] = useState("");
  const [bannerFile, setBannerFile] = useState<File | null>(null);
  const [bannerPreview, setBannerPreview] = useState<string | null>(null);
  const [now] = useState(() => Date.now());

  const merchant = merchants.find(m => m.id === selectedId);

  // ── Toast helper ──
  const showToast = useCallback((msg: string, type: "ok" | "err" = "ok") => {
    setToast({ msg, type });
    setTimeout(() => setToast(null), 4000);
  }, []);

  // ── API helper ──
  async function api(path: string, options: { method?: string; body?: object } = {}) {
    const res = await fetch(`${BACKEND_URL}${path}`, {
      method: options.method || "GET",
      headers: { Authorization: `Bearer ${localStorage.getItem("token")}`, "Content-Type": "application/json" },
      ...(options.body ? { body: JSON.stringify(options.body) } : {}),
      cache: "no-store",
    });
    const data = await res.json();
    if (!res.ok) throw Error(typeof data.detail === "string" ? data.detail : "Request failed.");
    return data;
  }

  // ── Load everything on mount ──
  useEffect(() => {
    if (localStorage.getItem("userRole") !== "admin") { router.replace("/admin/login"); return; }
    Promise.all([api("/admin/merchants/ordered"), api("/events")])
      .then(([m, e]) => {
        const valid = (m as Merchant[]).filter(x => x.name && x.name.trim() !== "--");
        setMerchants(valid);
        setOrderedIds(valid.map(x => x.id));
        setEvents(e);
        setSelectedId(valid[0]?.id || "");
        const first = (e as Event[]).find(ev => new Date(ev.end_time).getTime() >= Date.now());
        if (first) setEventId(first.id);
      })
      .catch(e => showToast(e.message, "err"))
      .finally(() => setLoading(false));
  }, [router]);

  // ── Load merchant detail ──
  useEffect(() => {
    if (!selectedId) return;
    let stopped = false;
    setDetailLoading(true); setItems([]); setSlots([]); setOrders([]);
    Promise.all([
      api(`/admin/merchants/${selectedId}/items`),
      api(`/admin/merchants/${selectedId}/pickup-slots`),
      api(`/merchants/${selectedId}/orders`),
    ]).then(([i, s, o]) => {
      if (!stopped) { setItems(i); setSlots(s); setOrders(o); }
    }).catch(e => { if (!stopped) showToast(e.message, "err"); })
      .finally(() => { if (!stopped) setDetailLoading(false); });
    return () => { stopped = true; };
  }, [selectedId]);

  // ── Load event members ──
  useEffect(() => {
    if (!eventId) return;
    api(`/admin/events/${eventId}/merchant-ids`).then(setEventMemberIds).catch(e => showToast(e.message, "err"));
  }, [eventId]);

  // ─── Merchant actions ──────────────────────────────────────────────────────
  function openEdit(m: Merchant) {
    setEditMerchant(m); setEditName(m.name); setEditLocation(m.location); setEditBio(m.description || "");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editMerchant) return;
    setBusy(true);
    try {
      const updated = await api(`/admin/merchants/${editMerchant.id}`, {
        method: "PATCH", body: { name: editName, location: editLocation, description: editBio },
      });
      setMerchants(ms => ms.map(m => m.id === editMerchant.id ? { ...m, ...updated } : m));
      showToast("Merchant profile updated.");
      setEditMerchant(null);
    } catch (ex: any) { showToast(ex.message, "err"); }
    finally { setBusy(false); }
  }

  async function toggleActive(m: Merchant) {
    if (!window.confirm(`${m.is_active ? "Deactivate" : "Activate"} ${m.name}?`)) return;
    setBusy(true);
    try {
      const r = await api(`/admin/merchants/${m.id}/toggle-active`, { method: "PATCH" });
      setMerchants(ms => ms.map(x => x.id === m.id ? { ...x, is_active: r.is_active } : x));
      showToast(r.message);
    } catch (ex: any) { showToast(ex.message, "err"); }
    finally { setBusy(false); }
  }

  async function togglePreview(m: Merchant) {
    setBusy(true);
    try {
      const r = await api(`/admin/merchants/${m.id}/preview`, { method: "PATCH" });
      setMerchants(ms => ms.map(x => x.id === m.id ? { ...x, is_preview: r.is_preview } : x));
      showToast(r.is_preview ? "🔒 Stall hidden from public marketplace." : "✅ Stall is now publicly visible.");
    } catch (ex: any) { showToast(ex.message, "err"); }
    finally { setBusy(false); }
  }

  async function deleteMerchant(m: Merchant) {
    if (!window.confirm(`Permanently delete ${m.name}? This cannot be undone.`)) return;
    setBusy(true);
    try {
      await api(`/admin/merchants/${m.id}`, { method: "DELETE" });
      const remaining = merchants.filter(x => x.id !== m.id);
      setMerchants(remaining);
      setOrderedIds(ids => ids.filter(id => id !== m.id));
      setSelectedId(remaining[0]?.id || "");
      showToast("Merchant deleted.");
    } catch (ex: any) { showToast(ex.message, "err"); }
    finally { setBusy(false); }
  }

  // ─── Item actions ──────────────────────────────────────────────────────────
  async function approveItem(itemId: string, status: "approved" | "rejected") {
    setBusy(true);
    try {
      await api(`/admin/menu-items/${itemId}/approval`, { method: "PATCH", body: { approval_status: status } });
      setItems(is => is.map(i => i.id === itemId ? { ...i, approval_status: status, is_available: status === "approved" } : i));
      showToast(`Item ${status}.`);
    } catch (ex: any) { showToast(ex.message, "err"); }
    finally { setBusy(false); }
  }

  async function deleteItem(itemId: string) {
    if (!window.confirm("Delete this menu item?")) return;
    setBusy(true);
    try {
      await api(`/admin/menu-items/${itemId}`, { method: "DELETE" });
      setItems(is => is.filter(i => i.id !== itemId));
      showToast("Item deleted.");
    } catch (ex: any) { showToast(ex.message, "err"); }
    finally { setBusy(false); }
  }

  // ─── Slot actions ──────────────────────────────────────────────────────────
  async function deleteSlot(slotId: string) {
    setBusy(true);
    try {
      await api(`/admin/pickup-slots/${slotId}`, { method: "DELETE" });
      setSlots(ss => ss.filter(s => s.id !== slotId));
      showToast("Pickup slot removed.");
    } catch (ex: any) { showToast(ex.message, "err"); }
    finally { setBusy(false); }
  }

  // ─── Reorder ──────────────────────────────────────────────────────────────
  function moveUp(id: string) {
    const idx = orderedIds.indexOf(id);
    if (idx <= 0) return;
    const next = [...orderedIds]; [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]]; setOrderedIds(next);
  }
  function moveDown(id: string) {
    const idx = orderedIds.indexOf(id);
    if (idx < 0 || idx >= orderedIds.length - 1) return;
    const next = [...orderedIds]; [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]]; setOrderedIds(next);
  }
  async function saveOrder() {
    setBusy(true);
    try {
      await api("/admin/merchants/reorder", { method: "PUT", body: { ordered_ids: orderedIds } });
      setMerchants(ms => [...ms].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)));
      setReorderMode(false);
      showToast("✅ Order saved — customers will see vendors in this new order.");
    } catch (ex: any) { showToast(ex.message, "err"); }
    finally { setBusy(false); }
  }

  // ─── Event actions ─────────────────────────────────────────────────────────
  async function createEvent(e: React.FormEvent) {
    e.preventDefault(); setBusy(true);
    try {
      if (new Date(eventEnd) <= new Date(eventStart)) throw Error("End must be after start.");
      const created = await api("/events", {
        method: "POST",
        body: { name: eventName, location: eventLocation, description: eventDesc,
          event_date: eventStart.slice(0, 10), start_time: `${eventStart}:00+08:00`, end_time: `${eventEnd}:00+08:00`, merchant_ids: [] },
      });
      if (bannerFile && created.id) {
        const fd = new FormData(); fd.append("banner_file", bannerFile);
        await fetch(`${BACKEND_URL}/admin/events/${created.id}/banner`, {
          method: "PATCH", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, body: fd,
        });
      }
      if (eventUrl && created.id) {
        await api(`/admin/events/${created.id}`, { method: "PATCH", body: { event_url: eventUrl } });
      }
      const refreshed = await api("/events");
      setEvents(refreshed); setEventId(created.id); setEventMemberIds([]);
      showToast(`Event "${eventName}" created.`);
      setEventName(""); setEventLocation(""); setEventDesc(""); setEventStart(""); setEventEnd(""); setEventUrl(""); setBannerFile(null); setBannerPreview(null);
    } catch (ex: any) { showToast(ex.message, "err"); }
    finally { setBusy(false); }
  }

  async function deleteEvent() {
    if (!eventId || !window.confirm("Delete this event?")) return;
    setBusy(true);
    try {
      await api(`/events/${eventId}`, { method: "DELETE" });
      setEvents(evs => evs.filter(e => e.id !== eventId));
      setEventId(""); setEventMemberIds([]);
      showToast("Event deleted.");
    } catch (ex: any) { showToast(ex.message, "err"); }
    finally { setBusy(false); }
  }

  async function toggleEventMerchant(merchantId: string) {
    setBusy(true);
    try {
      if (eventMemberIds.includes(merchantId)) {
        await api(`/events/${eventId}/merchants/${merchantId}`, { method: "DELETE" });
        setEventMemberIds(ids => ids.filter(id => id !== merchantId));
        showToast("Vendor removed from event.");
      } else {
        await api(`/events/${eventId}/merchants`, { method: "POST", body: { merchant_id: merchantId } });
        setEventMemberIds(ids => [...ids, merchantId]);
        showToast("Vendor added to event.");
      }
    } catch (ex: any) { showToast(ex.message, "err"); }
    finally { setBusy(false); }
  }

  async function replaceBanner(targetEventId: string, file: File) {
    const fd = new FormData(); fd.append("banner_file", file);
    const res = await fetch(`${BACKEND_URL}/admin/events/${targetEventId}/banner`, {
      method: "PATCH", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, body: fd,
    });
    if (!res.ok) throw Error("Banner upload failed.");
    return res.json();
  }

  // ─── Sorted list for reorder view ─────────────────────────────────────────
  const sortedForReorder = orderedIds.map(id => merchants.find(m => m.id === id)).filter(Boolean) as Merchant[];

  // ─── Loading screen ────────────────────────────────────────────────────────
  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <Spinner />
    </div>
  );

  return (
    <div className="bg-[#f7f6f3] text-slate-900">

      {/* ── Toast ── */}
      {toast && (
        <div className={`fixed bottom-6 left-1/2 z-[100] -translate-x-1/2 rounded-2xl px-5 py-3 text-sm font-semibold shadow-xl transition-all
          ${toast.type === "err" ? "bg-red-600 text-white" : "bg-slate-900 text-white"}`}>
          {toast.msg}
        </div>
      )}

      {/* ── Section tabs ── */}
      <div className="border-b border-stone-200 bg-white">
        <div className="mx-auto max-w-7xl px-5">
          <div className="flex gap-0">
            {(["merchants", "events"] as AdminTab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-bold transition border-b-2 ${tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-slate-400 hover:text-slate-700"}`}>
                {t === "merchants" ? "🏪 Vendors" : "🎉 Events"}
              </button>
            ))}
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-5 py-6">

        {/* ══════════════════════════════════════════════════════════════════
            MERCHANTS TAB — sidebar + detail layout
        ═════════════════════════════════════════════════════════════════════ */}
        {tab === "merchants" && (
          <div className="flex gap-5 items-start">

            {/* ── Left sidebar: merchant list / reorder ── */}
            <aside className="w-64 shrink-0 sticky top-[89px]">
              <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                <div className="flex items-center justify-between border-b border-stone-100 px-4 py-3">
                  <p className="text-xs font-black uppercase tracking-widest text-stone-400">
                    {reorderMode ? "Drag to Reorder" : "All Merchants"}
                  </p>
                  <button
                    onClick={() => { setReorderMode(r => !r); }}
                    className={`rounded-lg px-2.5 py-1 text-[11px] font-bold transition ${reorderMode ? "bg-violet-600 text-white" : "text-violet-600 hover:bg-violet-50"}`}>
                    {reorderMode ? "Exit" : "⇅ Reorder"}
                  </button>
                </div>

                {reorderMode ? (
                  <div className="p-3 space-y-1.5">
                    <p className="text-[10px] text-stone-400 px-1 pb-1">Changes apply to the public marketplace. Save when done.</p>
                    {sortedForReorder.map((m, idx) => (
                      <div key={m.id} className="flex items-center gap-2 rounded-xl bg-violet-50 border border-violet-100 px-3 py-2">
                        <span className="text-[11px] font-black text-violet-300 w-4">{idx + 1}</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-xs font-bold truncate">{m.name}</p>
                          <p className="text-[10px] text-stone-400 truncate">{m.location}</p>
                        </div>
                        <div className="flex flex-col gap-0.5">
                          <button onClick={() => moveUp(m.id)} disabled={idx === 0}
                            className="h-5 w-5 rounded bg-white border border-stone-200 text-[10px] text-slate-500 hover:bg-slate-50 disabled:opacity-20 flex items-center justify-center">▲</button>
                          <button onClick={() => moveDown(m.id)} disabled={idx === sortedForReorder.length - 1}
                            className="h-5 w-5 rounded bg-white border border-stone-200 text-[10px] text-slate-500 hover:bg-slate-50 disabled:opacity-20 flex items-center justify-center">▼</button>
                        </div>
                      </div>
                    ))}
                    <button disabled={busy} onClick={saveOrder}
                      className="mt-2 w-full rounded-xl bg-emerald-600 py-2.5 text-xs font-black text-white disabled:opacity-50 hover:bg-emerald-700 transition">
                      {busy ? "Saving…" : "💾 Save Order"}
                    </button>
                  </div>
                ) : (
                  <ul className="divide-y divide-stone-50 max-h-[75vh] overflow-y-auto">
                    {merchants.map(m => (
                      <li key={m.id}>
                        <button
                          onClick={() => setSelectedId(m.id)}
                          className={`w-full px-4 py-3 text-left transition ${selectedId === m.id ? "bg-violet-50" : "hover:bg-stone-50"}`}>
                          <div className="flex items-center gap-2">
                            <div className={`h-2 w-2 shrink-0 rounded-full ${m.is_active ? "bg-emerald-500" : "bg-stone-300"}`} />
                            <div className="min-w-0">
                              <div className="flex items-center gap-1.5">
                                <p className={`text-sm font-bold truncate ${selectedId === m.id ? "text-violet-700" : "text-slate-800"}`}>{m.name}</p>
                                {m.is_preview && <span className="shrink-0 rounded-full bg-amber-100 px-1.5 py-0.5 text-[9px] font-black uppercase text-amber-600">Preview</span>}
                              </div>
                              <p className="text-[11px] text-stone-400 truncate">{m.location}</p>
                            </div>
                          </div>
                        </button>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            </aside>

            {/* ── Right: merchant detail ── */}
            <div className="flex-1 min-w-0 space-y-4">
              {!merchant ? (
                <div className="rounded-2xl border border-stone-200 bg-white p-12 text-center text-stone-400 shadow-sm">
                  Select a merchant to inspect
                </div>
              ) : (
                <>
                  {/* Profile card */}
                  <div className="rounded-2xl border border-stone-200 bg-white shadow-sm overflow-hidden">
                    {/* Card header bar */}
                    <div className={`h-2 w-full ${merchant.is_active ? "bg-gradient-to-r from-violet-500 to-indigo-400" : "bg-stone-200"}`} />
                    <div className="p-6">
                      <div className="flex flex-wrap items-start justify-between gap-4">
                        <div>
                          <h2 className="text-2xl font-black text-slate-900">{merchant.name}</h2>
                          <div className="mt-1 flex items-center gap-2 text-sm">
                            <span className="text-stone-500">{merchant.location}</span>
                            <span className="text-stone-300">·</span>
                            <span className={`font-semibold ${merchant.is_active ? "text-emerald-600" : "text-red-500"}`}>
                              {merchant.is_active ? "Active" : "Inactive"}
                            </span>
                          </div>
                        </div>
                        <div className="flex flex-wrap gap-2">
                          <button onClick={() => openEdit(merchant)}
                            className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 transition">
                            ✏️ Edit Profile
                          </button>
                          <button onClick={() => toggleActive(merchant)} disabled={busy}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-60 ${merchant.is_active ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                            {merchant.is_active ? "Deactivate" : "Activate"}
                          </button>
                          <button onClick={() => togglePreview(merchant)} disabled={busy}
                            className={`rounded-xl px-4 py-2 text-xs font-bold transition disabled:opacity-60 ${
                              merchant.is_preview
                                ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100"
                                : "border border-stone-200 bg-stone-50 text-stone-600 hover:bg-stone-100"
                            }`}>
                            {merchant.is_preview ? "🔓 Make Public" : "🔒 Preview Only"}
                          </button>
                          <button onClick={() => deleteMerchant(merchant)} disabled={busy}
                            className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition disabled:opacity-60">
                            🗑️ Delete
                          </button>
                        </div>
                      </div>

                      {merchant.description && (
                        <p className="mt-4 text-sm text-slate-600 leading-relaxed">{merchant.description}</p>
                      )}

                      <div className="mt-5 grid grid-cols-2 gap-4 border-t border-stone-100 pt-5">
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Owner</p>
                          <p className="mt-1 font-semibold text-sm">{merchant.owner_name}</p>
                        </div>
                        <div>
                          <p className="text-[10px] font-black uppercase tracking-widest text-stone-400">Contact</p>
                          <p className="mt-1 text-sm">{merchant.email}</p>
                          <p className="text-sm text-stone-500">{merchant.phone_number || "No phone"}</p>
                        </div>
                      </div>
                      <p className="mt-3 text-[11px] text-stone-400 italic">📧 Email and phone are editable by the merchant only.</p>
                    </div>

                    {/* DuitNow QR inline */}
                    {merchant.duitnow_qr_url && (
                      <div className="border-t border-stone-100 px-6 py-4 bg-gradient-to-r from-indigo-50 to-violet-50">
                        <p className="text-xs font-black uppercase tracking-widest text-indigo-400 mb-2">DuitNow QR</p>
                        <a href={merchant.duitnow_qr_url.startsWith("http") ? merchant.duitnow_qr_url : `${BACKEND_URL}${merchant.duitnow_qr_url}`}
                          target="_blank" rel="noopener noreferrer" className="inline-block">
                          <img
                            src={merchant.duitnow_qr_url.startsWith("http") ? merchant.duitnow_qr_url : `${BACKEND_URL}${merchant.duitnow_qr_url}`}
                            alt={`DuitNow QR – ${merchant.name}`}
                            className="h-40 rounded-xl border border-indigo-100 bg-white p-2 object-contain hover:shadow-md transition" />
                        </a>
                      </div>
                    )}
                  </div>

                  {/* Menu Items */}
                  <div className="rounded-2xl border border-stone-200 bg-white shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <div>
                        <h3 className="font-black text-slate-900">Menu Items <span className="text-stone-400 font-normal">({items.length})</span></h3>
                        <p className="mt-0.5 text-[11px] text-amber-600 font-medium">New items require your approval before going live publicly.</p>
                      </div>
                      {detailLoading && <Spinner small />}
                    </div>

                    {!detailLoading && items.length === 0 && (
                      <p className="mt-4 text-sm text-stone-400">No menu items yet.</p>
                    )}

                    {items.length > 0 && (
                      <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                        {items.map(item => {
                          const status = item.approval_status || "approved";
                          return (
                            <div key={item.id} className="overflow-hidden rounded-2xl border border-stone-200 bg-stone-50">
                              {item.image_url ? (
                                <img
                                  src={item.image_url.startsWith("/") ? `${BACKEND_URL}${item.image_url}` : item.image_url}
                                  alt={item.name} className="h-28 w-full object-cover" />
                              ) : (
                                <div className="h-16 bg-gradient-to-br from-stone-100 to-stone-200 flex items-center justify-center text-2xl">🍽️</div>
                              )}
                              <div className="p-3">
                                <div className="flex items-start justify-between gap-1">
                                  <p className="font-bold text-sm leading-tight">{item.name}</p>
                                  <p className="shrink-0 font-extrabold text-orange-600 text-sm">{money(item.price)}</p>
                                </div>
                                <div className="mt-2"><StatusBadge status={status} /></div>
                                <div className="mt-3 flex gap-1.5 flex-wrap">
                                  {status !== "approved" && (
                                    <button onClick={() => approveItem(item.id, "approved")} disabled={busy}
                                      className="rounded-lg bg-emerald-600 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-emerald-700 disabled:opacity-50 transition">
                                      ✓ Approve
                                    </button>
                                  )}
                                  {status !== "rejected" && (
                                    <button onClick={() => approveItem(item.id, "rejected")} disabled={busy}
                                      className="rounded-lg bg-amber-500 px-2.5 py-1.5 text-[11px] font-bold text-white hover:bg-amber-600 disabled:opacity-50 transition">
                                      ✗ Reject
                                    </button>
                                  )}
                                  <button onClick={() => deleteItem(item.id)} disabled={busy}
                                    className="rounded-lg border border-red-100 bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 transition">
                                    Delete
                                  </button>
                                </div>
                              </div>
                            </div>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* Pickup Slots */}
                  <div className="rounded-2xl border border-stone-200 bg-white shadow-sm p-6">
                    <div className="flex items-center justify-between">
                      <h3 className="font-black text-slate-900">Pickup Slots <span className="text-stone-400 font-normal">({slots.length})</span></h3>
                      {detailLoading && <Spinner small />}
                    </div>
                    {!detailLoading && slots.length === 0 && (
                      <p className="mt-4 text-sm text-stone-400">No pickup slots configured.</p>
                    )}
                    {slots.length > 0 && (
                      <ul className="mt-4 space-y-2">
                        {slots.map(s => (
                          <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                            <div>
                              <p className="text-sm font-semibold">{fmt(s.time_slot)}</p>
                              <div className="mt-0.5 flex items-center gap-2 text-xs text-stone-500">
                                <span>{s.current_bookings} / {s.max_capacity} booked</span>
                                {s.is_full && (
                                  <span className="rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">FULL</span>
                                )}
                              </div>
                            </div>
                            <button onClick={() => deleteSlot(s.id)} disabled={busy}
                              className="rounded-lg border border-red-100 bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 transition">
                              Delete
                            </button>
                          </li>
                        ))}
                      </ul>
                    )}
                  </div>

                  {/* Orders */}
                  <div className="rounded-2xl border border-stone-200 bg-white shadow-sm p-6">
                    <h3 className="font-black text-slate-900">Orders <span className="text-stone-400 font-normal">({orders.length})</span></h3>
                    {!detailLoading && orders.length === 0 && (
                      <p className="mt-4 text-sm text-stone-400">No orders yet.</p>
                    )}
                    {orders.length > 0 && (
                      <div className="mt-4 max-h-96 space-y-2 overflow-auto">
                        {orders.map(o => (
                          <details key={o.id} className="rounded-xl border border-stone-100 bg-stone-50 p-4">
                            <summary className="cursor-pointer text-sm font-semibold">
                              {o.order_number || o.id.slice(0, 8)} · {o.customer_name} ·{" "}
                              <span className="capitalize">{o.status.replaceAll("_", " ")}</span> · {money(o.total_price)}
                            </summary>
                            <ul className="mt-3 text-sm text-stone-600">{o.items.map((i, n) => <li key={n}>{i.quantity} × {i.name}</li>)}</ul>
                            {o.transaction_ref && (
                              <p className="mt-2 break-all text-xs text-stone-400">
                                Receipt:{" "}
                                {o.transaction_ref.startsWith("https://")
                                  ? <a className="underline text-violet-700" href={o.transaction_ref} target="_blank" rel="noopener noreferrer">View</a>
                                  : o.transaction_ref}
                              </p>
                            )}
                          </details>
                        ))}
                      </div>
                    )}
                  </div>
                </>
              )}
            </div>
          </div>
        )}

        {/* ══════════════════════════════════════════════════════════════════
            EVENTS TAB
        ═════════════════════════════════════════════════════════════════════ */}
        {tab === "events" && (
          <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

            {/* Left: Create form + vendor picker */}
            <div className="space-y-6">
              {/* Create event */}
              <div className="rounded-2xl border border-violet-200 bg-white p-6 shadow-sm">
                <h2 className="text-lg font-black text-slate-900">Create New Event</h2>
                <p className="mt-1 text-xs text-stone-400">Events appear as a live banner on the marketplace homepage.</p>
                <form onSubmit={createEvent} className="mt-5 grid gap-4 sm:grid-cols-2">
                  <label className="text-xs font-bold uppercase tracking-wide text-stone-500">Event Name *
                    <input required value={eventName} onChange={e => setEventName(e.target.value)} className={inputCls} placeholder="e.g. SDG Day 2026" />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-stone-500">Location *
                    <input required value={eventLocation} onChange={e => setEventLocation(e.target.value)} className={inputCls} placeholder="e.g. Sunway Boulevard" />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-stone-500 sm:col-span-2">Description
                    <textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} className={`${inputCls} resize-none`} rows={2} placeholder="What's this event about?" />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-stone-500">Starts (MY Time) *
                    <input required type="datetime-local" value={eventStart} onChange={e => setEventStart(e.target.value)} className={inputCls} />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-stone-500">Ends (MY Time) *
                    <input required type="datetime-local" value={eventEnd} onChange={e => setEventEnd(e.target.value)} className={inputCls} />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-stone-500 sm:col-span-2">In-App Event Page URL
                    <input value={eventUrl} onChange={e => setEventUrl(e.target.value)} className={inputCls} placeholder="/events/sdg-day" />
                  </label>
                  <label className="text-xs font-bold uppercase tracking-wide text-stone-500 sm:col-span-2">Event Poster / Banner
                    <input type="file" accept="image/*"
                      onChange={e => { const f = e.target.files?.[0]; if (f) { setBannerFile(f); setBannerPreview(URL.createObjectURL(f)); } }}
                      className="mt-1 block w-full text-xs text-slate-600 file:mr-3 file:py-2 file:px-4 file:rounded-xl file:border-0 file:text-xs file:font-bold file:bg-violet-50 file:text-violet-700 hover:file:bg-violet-100 cursor-pointer" />
                    {bannerPreview && (
                      <div className="mt-2 flex items-center gap-3">
                        <img src={bannerPreview} alt="Preview" className="h-20 rounded-xl object-cover border border-violet-200" />
                        <button type="button" onClick={() => { setBannerFile(null); setBannerPreview(null); }} className="text-xs text-red-600 font-semibold">Remove</button>
                      </div>
                    )}
                  </label>
                  <button disabled={busy} className="sm:col-span-2 rounded-xl bg-violet-700 py-3 font-bold text-white disabled:opacity-50 hover:bg-violet-800 transition">
                    {busy ? "Creating…" : "Create Event"}
                  </button>
                </form>
              </div>

              {/* Vendor picker for selected event */}
              {eventId && (
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                  <h2 className="font-black text-slate-900">Event Vendors</h2>
                  <p className="mt-0.5 text-xs text-stone-400">{eventMemberIds.length} vendor{eventMemberIds.length !== 1 ? "s" : ""} in this event</p>
                  <div className="mt-4 grid gap-2 sm:grid-cols-2">
                    {merchants.map(m => {
                      const included = eventMemberIds.includes(m.id);
                      return (
                        <div key={m.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${included ? "border-violet-200 bg-violet-50" : "border-stone-200 bg-stone-50"}`}>
                          <div className="min-w-0">
                            <p className="font-bold text-sm truncate">{m.name}</p>
                            <p className="text-[11px] text-stone-400">{m.location}</p>
                          </div>
                          <button disabled={busy} onClick={() => toggleEventMerchant(m.id)}
                            className={`shrink-0 rounded-lg px-3 py-1.5 text-xs font-bold transition disabled:opacity-50 ${included ? "bg-red-50 text-red-700 hover:bg-red-100" : "bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                            {included ? "Remove" : "Add"}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}
            </div>

            {/* Right: Event list / selector */}
            <div className="space-y-4">
              <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
                <h2 className="font-black text-slate-900 mb-3">Manage Existing Event</h2>
                <select className={inputCls} value={eventId} onChange={e => setEventId(e.target.value)}>
                  <option value="">— select an event —</option>
                  {events.filter(e => new Date(e.end_time).getTime() >= now).map(e => (
                    <option key={e.id} value={e.id}>{e.name} · {e.location}</option>
                  ))}
                  {events.filter(e => new Date(e.end_time).getTime() < now).map(e => (
                    <option key={e.id} value={e.id}>[Past] {e.name}</option>
                  ))}
                </select>

                {eventId && (() => {
                  const ev = events.find(e => e.id === eventId);
                  if (!ev) return null;
                  return (
                    <div className="mt-4 space-y-4">
                      {ev.banner_image_url && (
                        <img src={ev.banner_image_url} alt="Event banner"
                          className="w-full h-32 rounded-xl object-cover border border-violet-100" />
                      )}
                      <div>
                        <p className="font-bold text-slate-900">{ev.name}</p>
                        <p className="text-xs text-stone-500">📍 {ev.location}</p>
                        {ev.description && <p className="text-xs text-stone-500 mt-1">{ev.description}</p>}
                        {ev.event_url && <p className="text-xs text-violet-600 mt-1">🔗 {ev.event_url}</p>}
                        <p className="text-xs text-stone-400 mt-1">{fmt(ev.start_time)} → {fmt(ev.end_time)}</p>
                      </div>
                      {/* Replace banner */}
                      <label className="cursor-pointer flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 transition w-fit">
                        📷 Replace Poster
                        <input type="file" accept="image/*" className="hidden"
                          onChange={async e => {
                            const f = e.target.files?.[0]; if (!f) return;
                            setBusy(true);
                            try {
                              await replaceBanner(eventId, f);
                              const refreshed = await api("/events");
                              setEvents(refreshed);
                              showToast("Banner updated.");
                            } catch (ex: any) { showToast(ex.message, "err"); }
                            finally { setBusy(false); }
                          }} />
                      </label>
                      <button disabled={busy} onClick={deleteEvent}
                        className="w-full rounded-xl border border-red-200 bg-red-50 py-2.5 text-xs font-bold text-red-700 hover:bg-red-100 transition disabled:opacity-50">
                        🗑️ Delete This Event
                      </button>
                    </div>
                  );
                })()}
              </div>
            </div>
          </div>
        )}
      </div>

      {/* ── Edit Merchant Modal ── */}
      {editMerchant && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-sm">
          <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl space-y-5">
            <div className="flex items-start justify-between">
              <div>
                <h3 className="text-lg font-black">Edit Merchant Profile</h3>
                <p className="text-[11px] text-stone-400 mt-0.5">Name, location and bio only. Email and phone are merchant-only.</p>
              </div>
              <button onClick={() => setEditMerchant(null)} className="h-8 w-8 rounded-full bg-stone-100 text-stone-500 font-bold hover:bg-stone-200 flex items-center justify-center">✕</button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-500">Store Name *
                <input required value={editName} onChange={e => setEditName(e.target.value)} className={inputCls} />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-500">Campus Location *
                <input required value={editLocation} onChange={e => setEditLocation(e.target.value)} className={inputCls} />
              </label>
              <label className="block text-xs font-bold uppercase tracking-wide text-stone-500">Store Bio
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} className={`${inputCls} resize-none`} rows={3} />
              </label>
              <div className="flex gap-2 pt-1">
                <button type="submit" disabled={busy} className="flex-1 rounded-xl bg-violet-700 py-2.5 font-bold text-white disabled:opacity-50 hover:bg-violet-800 transition">
                  {busy ? "Saving…" : "Save Changes"}
                </button>
                <button type="button" onClick={() => setEditMerchant(null)} className="flex-1 rounded-xl bg-stone-100 py-2.5 font-bold text-stone-700 hover:bg-stone-200 transition">
                  Cancel
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
