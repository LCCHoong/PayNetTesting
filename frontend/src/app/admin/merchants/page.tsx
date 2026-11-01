"use client";
import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { BACKEND_URL } from "@/lib/backend-url";

// ─── Types ────────────────────────────────────────────────────────────────────
type Merchant = {
  id: string; name: string; location: string; description: string;
  email: string; phone_number: string; owner_name: string;
  is_active: boolean; duitnow_qr_url?: string; display_order?: number;
};
type Slot = { id: string; time_slot: string; current_bookings: number; max_capacity: number; is_full?: boolean };
type Item = { id: string; name: string; price: number; is_available: boolean; image_url?: string | null; approval_status?: string };
type Order = { id: string; order_number?: string; customer_name: string; status: string; total_price: number; transaction_ref?: string; items: { name: string; quantity: number }[] };
type Event = { id: string; name: string; location: string; description?: string; start_time: string; end_time: string; banner_image_url?: string; event_url?: string };

const money = (n: number) => `RM ${Number(n).toFixed(2)}`;
const input = "mt-1 w-full rounded-xl border border-stone-200 bg-white px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-violet-500";

// ─── Tab nav config ───────────────────────────────────────────────────────────
type AdminTab = "merchants" | "events";

export default function AdminMerchants() {
  const router = useRouter();
  const bannerInputRef = useRef<HTMLInputElement>(null);

  // ── Global state ──
  const [tab, setTab] = useState<AdminTab>("merchants");
  const [merchants, setMerchants] = useState<Merchant[]>([]);
  const [events, setEvents] = useState<Event[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [message, setMessage] = useState("");

  // ── Merchant detail state ──
  const [selected, setSelected] = useState("");
  const [slots, setSlots] = useState<Slot[]>([]);
  const [items, setItems] = useState<Item[]>([]);
  const [orders, setOrders] = useState<Order[]>([]);
  const [detailLoading, setDetailLoading] = useState(false);

  // ── Merchant edit modal ──
  const [editMerchant, setEditMerchant] = useState<Merchant | null>(null);
  const [editName, setEditName] = useState("");
  const [editLocation, setEditLocation] = useState("");
  const [editBio, setEditBio] = useState("");

  // ── Vendor reorder state ──
  const [reorderMode, setReorderMode] = useState(false);
  const [orderedIds, setOrderedIds] = useState<string[]>([]);

  // ── Event management state ──
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
  const [pageLoadedAt] = useState(() => Date.now());

  const merchant = merchants.find(m => m.id === selected);
  const activeEvents = events.filter(e => new Date(e.end_time).getTime() >= pageLoadedAt);

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

  // ── Initial load ──
  useEffect(() => {
    if (localStorage.getItem("userRole") !== "admin") { router.replace("/admin/login"); return; }
    Promise.all([api("/admin/merchants/ordered"), api("/events")])
      .then(([m, e]) => {
        setMerchants(m);
        setOrderedIds(m.map((x: Merchant) => x.id));
        setEvents(e);
        setSelected(m[0]?.id || "");
        const first = e.filter((ev: Event) => new Date(ev.end_time).getTime() >= Date.now())[0];
        if (first) setEventId(first.id);
      })
      .catch(e => setError(e.message))
      .finally(() => setLoading(false));
  }, [router]);

  // ── Load merchant detail when selection changes ──
  useEffect(() => {
    if (!selected) return;
    let stopped = false;
    setDetailLoading(true); setItems([]); setSlots([]); setOrders([]);
    Promise.all([
      api(`/admin/merchants/${selected}/items`),
      api(`/admin/merchants/${selected}/pickup-slots`),
      api(`/merchants/${selected}/orders`),
    ]).then(([i, s, o]) => {
      if (!stopped) { setItems(i); setSlots(s); setOrders(o); }
    }).catch(e => { if (!stopped) setError(e.message); })
      .finally(() => { if (!stopped) setDetailLoading(false); });
    return () => { stopped = true; };
  }, [selected]);

  // ── Load event members ──
  useEffect(() => {
    if (!eventId) return;
    api(`/admin/events/${eventId}/merchant-ids`).then(setEventMemberIds).catch(e => setError(e.message));
  }, [eventId]);

  // ─── Merchant actions ──────────────────────────────────────────────────────
  function openEdit(m: Merchant) {
    setEditMerchant(m); setEditName(m.name); setEditLocation(m.location); setEditBio(m.description || "");
  }

  async function saveEdit(e: React.FormEvent) {
    e.preventDefault(); if (!editMerchant) return;
    setBusy(true); setError(""); setMessage("");
    try {
      const updated = await api(`/admin/merchants/${editMerchant.id}`, {
        method: "PATCH", body: { name: editName, location: editLocation, description: editBio },
      });
      setMerchants(ms => ms.map(m => m.id === editMerchant.id ? { ...m, ...updated } : m));
      setMessage("Merchant profile updated.");
      setEditMerchant(null);
    } catch (ex: any) { setError(ex.message); }
    finally { setBusy(false); }
  }

  async function toggleActive(m: Merchant) {
    if (!window.confirm(`${m.is_active ? "Deactivate" : "Activate"} ${m.name}?`)) return;
    setBusy(true); setError("");
    try {
      const r = await api(`/admin/merchants/${m.id}/toggle-active`, { method: "PATCH" });
      setMerchants(ms => ms.map(x => x.id === m.id ? { ...x, is_active: r.is_active } : x));
      setMessage(r.message);
    } catch (ex: any) { setError(ex.message); }
    finally { setBusy(false); }
  }

  async function deleteMerchant(m: Merchant) {
    if (!window.confirm(`Permanently delete ${m.name}? This cannot be undone.`)) return;
    setBusy(true); setError("");
    try {
      await api(`/admin/merchants/${m.id}`, { method: "DELETE" });
      setMerchants(ms => ms.filter(x => x.id !== m.id));
      setOrderedIds(ids => ids.filter(id => id !== m.id));
      if (selected === m.id) setSelected(merchants.find(x => x.id !== m.id)?.id || "");
      setMessage("Merchant deleted.");
    } catch (ex: any) { setError(ex.message); }
    finally { setBusy(false); }
  }

  // ─── Menu item actions ─────────────────────────────────────────────────────
  async function approveItem(itemId: string, status: "approved" | "rejected") {
    setBusy(true); setError("");
    try {
      await api(`/admin/menu-items/${itemId}/approval`, { method: "PATCH", body: { approval_status: status } });
      setItems(is => is.map(i => i.id === itemId ? { ...i, approval_status: status, is_available: status === "approved" } : i));
      setMessage(`Item ${status}.`);
    } catch (ex: any) { setError(ex.message); }
    finally { setBusy(false); }
  }

  async function deleteItem(itemId: string) {
    if (!window.confirm("Delete this menu item?")) return;
    setBusy(true); setError("");
    try {
      await api(`/admin/menu-items/${itemId}`, { method: "DELETE" });
      setItems(is => is.filter(i => i.id !== itemId));
      setMessage("Item deleted.");
    } catch (ex: any) { setError(ex.message); }
    finally { setBusy(false); }
  }

  // ─── Pickup slot actions ────────────────────────────────────────────────────
  async function deleteSlot(slotId: string) {
    if (!window.confirm("Delete this pickup slot?")) return;
    setBusy(true); setError("");
    try {
      await api(`/admin/pickup-slots/${slotId}`, { method: "DELETE" });
      setSlots(ss => ss.filter(s => s.id !== slotId));
      setMessage("Pickup slot deleted.");
    } catch (ex: any) { setError(ex.message); }
    finally { setBusy(false); }
  }

  // ─── Vendor reorder ─────────────────────────────────────────────────────────
  function moveUp(id: string) {
    const idx = orderedIds.indexOf(id);
    if (idx <= 0) return;
    const next = [...orderedIds];
    [next[idx - 1], next[idx]] = [next[idx], next[idx - 1]];
    setOrderedIds(next);
  }
  function moveDown(id: string) {
    const idx = orderedIds.indexOf(id);
    if (idx < 0 || idx >= orderedIds.length - 1) return;
    const next = [...orderedIds];
    [next[idx], next[idx + 1]] = [next[idx + 1], next[idx]];
    setOrderedIds(next);
  }
  async function saveOrder() {
    setBusy(true); setError("");
    try {
      await api("/admin/merchants/reorder", { method: "PUT", body: { ordered_ids: orderedIds } });
      setMerchants(ms => [...ms].sort((a, b) => orderedIds.indexOf(a.id) - orderedIds.indexOf(b.id)));
      setReorderMode(false);
      setMessage("Vendor display order saved. Customers will see this order on the marketplace.");
    } catch (ex: any) { setError(ex.message); }
    finally { setBusy(false); }
  }

  // ─── Event actions ──────────────────────────────────────────────────────────
  async function createEvent(e: React.FormEvent) {
    e.preventDefault(); setBusy(true); setError(""); setMessage("");
    try {
      if (new Date(eventEnd) <= new Date(eventStart)) throw Error("End must be after start.");
      const created = await api("/events", {
        method: "POST",
        body: { name: eventName, location: eventLocation, description: eventDesc,
          event_date: eventStart.slice(0, 10), start_time: `${eventStart}:00+08:00`, end_time: `${eventEnd}:00+08:00`, merchant_ids: [] },
      });
      // Upload banner if selected
      if (bannerFile && created.id) {
        const fd = new FormData(); fd.append("banner_file", bannerFile);
        await fetch(`${BACKEND_URL}/admin/events/${created.id}/banner`, {
          method: "PATCH",
          headers: { Authorization: `Bearer ${localStorage.getItem("token")}` },
          body: fd,
        });
      }
      // Save event_url if provided
      if (eventUrl && created.id) {
        await api(`/admin/events/${created.id}`, { method: "PATCH", body: { event_url: eventUrl } });
      }
      const refreshed = await api("/events");
      setEvents(refreshed);
      setEventId(created.id);
      setEventMemberIds([]);
      setMessage(`Event "${eventName}" created. Now add vendors below.`);
      setEventName(""); setEventLocation(""); setEventDesc(""); setEventStart(""); setEventEnd(""); setEventUrl(""); setBannerFile(null); setBannerPreview(null);
    } catch (ex: any) { setError(ex.message); }
    finally { setBusy(false); }
  }

  async function deleteEvent() {
    if (!eventId || !window.confirm("Delete this event? All vendor assignments will be removed.")) return;
    setBusy(true); setError("");
    try {
      const r = await api(`/events/${eventId}`, { method: "DELETE" });
      setEvents(evs => evs.filter(e => e.id !== eventId));
      setEventId(""); setEventMemberIds([]);
      setMessage(r.message);
    } catch (ex: any) { setError(ex.message); }
    finally { setBusy(false); }
  }

  async function toggleEventMerchant(merchantId: string) {
    setBusy(true); setError("");
    try {
      if (eventMemberIds.includes(merchantId)) {
        await api(`/events/${eventId}/merchants/${merchantId}`, { method: "DELETE" });
        setEventMemberIds(ids => ids.filter(id => id !== merchantId));
        setMessage("Vendor removed from event.");
      } else {
        await api(`/events/${eventId}/merchants`, { method: "POST", body: { merchant_id: merchantId } });
        setEventMemberIds(ids => [...ids, merchantId]);
        setMessage("Vendor added to event.");
      }
    } catch (ex: any) { setError(ex.message); }
    finally { setBusy(false); }
  }

  async function uploadBanner(eventIdTarget: string, file: File) {
    const fd = new FormData(); fd.append("banner_file", file);
    const res = await fetch(`${BACKEND_URL}/admin/events/${eventIdTarget}/banner`, {
      method: "PATCH", headers: { Authorization: `Bearer ${localStorage.getItem("token")}` }, body: fd,
    });
    if (!res.ok) throw Error("Banner upload failed.");
    return res.json();
  }

  if (loading) return (
    <div className="flex min-h-screen items-center justify-center bg-stone-50">
      <div className="h-8 w-8 animate-spin rounded-full border-4 border-violet-200 border-t-violet-600" />
    </div>
  );

  const sortedMerchants = reorderMode
    ? orderedIds.map(id => merchants.find(m => m.id === id)).filter(Boolean) as Merchant[]
    : merchants;

  return (
    <main className="min-h-screen bg-stone-50 text-slate-900">
      {/* ── Header ── */}
      <header className="sticky top-0 z-30 border-b border-stone-200 bg-white/95 backdrop-blur-sm">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-4 py-4 sm:px-8">
          <div>
            <p className="text-[10px] font-bold uppercase tracking-widest text-orange-600">Administration</p>
            <h1 className="text-xl font-black text-slate-900">Payvolution Admin</h1>
          </div>
          <nav className="flex flex-wrap gap-1 text-xs font-semibold">
            <Link href="/admin/users" className="rounded-lg px-3 py-2 text-slate-500 hover:bg-stone-100 hover:text-slate-900 transition">Users</Link>
            <Link href="/admin/analytics" className="rounded-lg px-3 py-2 text-slate-500 hover:bg-stone-100 hover:text-slate-900 transition">Analytics</Link>
            <Link href="/" className="rounded-lg px-3 py-2 text-slate-500 hover:bg-stone-100 hover:text-slate-900 transition">Marketplace ↗</Link>
          </nav>
        </div>
        {/* Tab bar */}
        <div className="mx-auto max-w-7xl px-4 sm:px-8">
          <div className="flex gap-0 border-t border-stone-100">
            {(["merchants", "events"] as AdminTab[]).map(t => (
              <button key={t} onClick={() => setTab(t)}
                className={`px-5 py-3 text-sm font-semibold capitalize transition border-b-2 ${tab === t ? "border-violet-600 text-violet-700" : "border-transparent text-slate-500 hover:text-slate-800"}`}>
                {t === "merchants" ? "🏪 Merchants" : "🎉 Events"}
              </button>
            ))}
          </div>
        </div>
      </header>

      <div className="mx-auto max-w-7xl space-y-6 px-4 py-6 sm:px-8">
        {/* Alerts */}
        {error && <div role="alert" className="rounded-xl border border-red-200 bg-red-50 px-4 py-3 text-sm text-red-700">{error}<button onClick={() => setError("")} className="ml-3 font-bold">✕</button></div>}
        {message && <div role="status" className="rounded-xl border border-green-200 bg-green-50 px-4 py-3 text-sm text-green-800">{message}<button onClick={() => setMessage("")} className="ml-3 font-bold">✕</button></div>}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: MERCHANTS
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "merchants" && (
          <div className="space-y-6">
            {/* Merchant selector */}
            <div className="rounded-2xl border border-stone-200 bg-white p-5 shadow-sm">
              <div className="flex flex-wrap items-center justify-between gap-3">
                <h2 className="font-bold text-slate-900">Inspect Merchant</h2>
                <div className="flex gap-2">
                  <button onClick={() => { setReorderMode(!reorderMode); }}
                    className={`rounded-lg px-3 py-2 text-xs font-bold transition ${reorderMode ? "bg-violet-600 text-white" : "border border-violet-200 text-violet-700 hover:bg-violet-50"}`}>
                    {reorderMode ? "Exit Reorder" : "⇅ Reorder Vendors"}
                  </button>
                  {reorderMode && (
                    <button disabled={busy} onClick={saveOrder}
                      className="rounded-lg bg-emerald-600 px-3 py-2 text-xs font-bold text-white disabled:opacity-50 hover:bg-emerald-700 transition">
                      💾 Save Order
                    </button>
                  )}
                </div>
              </div>

              {reorderMode ? (
                <div className="mt-4 space-y-2">
                  <p className="text-xs text-slate-500 mb-3">Drag order determines the display order on the public marketplace. Customers see vendors in this exact order.</p>
                  {sortedMerchants.map((m, idx) => (
                    <div key={m.id} className="flex items-center gap-3 rounded-xl border border-violet-100 bg-violet-50 p-3">
                      <span className="w-6 text-center text-xs font-black text-violet-400">{idx + 1}</span>
                      <div className="flex-1 min-w-0">
                        <p className="font-bold text-sm truncate">{m.name}</p>
                        <p className="text-xs text-slate-500">{m.location}</p>
                      </div>
                      <div className="flex gap-1">
                        <button onClick={() => moveUp(m.id)} disabled={idx === 0}
                          className="h-7 w-7 rounded-lg bg-white border border-stone-200 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30">▲</button>
                        <button onClick={() => moveDown(m.id)} disabled={idx === sortedMerchants.length - 1}
                          className="h-7 w-7 rounded-lg bg-white border border-stone-200 text-sm font-bold text-slate-600 hover:bg-slate-100 disabled:opacity-30">▼</button>
                      </div>
                    </div>
                  ))}
                </div>
              ) : (
                <select className={`${input} mt-3`} value={selected} onChange={e => setSelected(e.target.value)}>
                  <option value="">Select a merchant</option>
                  {merchants.map(m => <option key={m.id} value={m.id}>{m.name} — {m.location} {!m.is_active ? "(Inactive)" : ""}</option>)}
                </select>
              )}
            </div>

            {/* Merchant detail */}
            {merchant && !reorderMode && (
              <div className="space-y-4">
                {/* Profile card */}
                <div className="grid gap-4 md:grid-cols-[1fr_220px]">
                  <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div>
                        <h2 className="text-2xl font-black">{merchant.name}</h2>
                        <p className="mt-1 text-stone-500 text-sm">{merchant.location} · <span className={`font-semibold ${merchant.is_active ? "text-emerald-600" : "text-red-500"}`}>{merchant.is_active ? "Active" : "Inactive"}</span></p>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        <button onClick={() => openEdit(merchant)}
                          className="rounded-xl border border-violet-200 bg-violet-50 px-4 py-2 text-xs font-bold text-violet-700 hover:bg-violet-100 transition">
                          ✏️ Edit Profile
                        </button>
                        <button onClick={() => toggleActive(merchant)} disabled={busy}
                          className={`rounded-xl px-4 py-2 text-xs font-bold transition ${merchant.is_active ? "border border-amber-200 bg-amber-50 text-amber-700 hover:bg-amber-100" : "border border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100"}`}>
                          {merchant.is_active ? "Deactivate" : "Activate"}
                        </button>
                        <button onClick={() => deleteMerchant(merchant)} disabled={busy}
                          className="rounded-xl border border-red-200 bg-red-50 px-4 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition">
                          🗑️ Delete
                        </button>
                      </div>
                    </div>
                    <p className="mt-4 text-sm text-slate-600">{merchant.description || "No store description yet."}</p>
                    <dl className="mt-5 grid grid-cols-2 gap-3 text-sm">
                      <div><dt className="text-xs font-bold uppercase text-stone-400">Owner</dt><dd className="mt-1 font-medium">{merchant.owner_name}</dd></div>
                      <div><dt className="text-xs font-bold uppercase text-stone-400">Contact</dt><dd className="mt-1 break-all">{merchant.email}</dd><dd className="text-stone-500">{merchant.phone_number || "No phone"}</dd></div>
                    </dl>
                    <p className="mt-3 text-xs text-stone-400 italic">📧 Email and phone are editable by the merchant only.</p>
                  </div>

                  {/* QR panel */}
                  <div className="rounded-2xl border border-indigo-100 bg-gradient-to-br from-indigo-50 to-violet-50 p-5 shadow-sm">
                    <h3 className="font-bold text-sm text-slate-800">DuitNow QR</h3>
                    {merchant.duitnow_qr_url ? (
                      <a href={merchant.duitnow_qr_url.startsWith("http") ? merchant.duitnow_qr_url : `${BACKEND_URL}${merchant.duitnow_qr_url}`}
                        target="_blank" rel="noopener noreferrer">
                        <img alt={`DuitNow QR for ${merchant.name}`}
                          src={merchant.duitnow_qr_url.startsWith("http") ? merchant.duitnow_qr_url : `${BACKEND_URL}${merchant.duitnow_qr_url}`}
                          className="mt-3 w-full rounded-xl bg-white p-2 object-contain border border-indigo-100 hover:shadow-md transition" />
                      </a>
                    ) : (
                      <div className="mt-3 rounded-xl bg-white/60 border border-dashed border-indigo-200 p-6 text-center text-xs text-stone-400">
                        QR not uploaded yet
                      </div>
                    )}
                  </div>
                </div>

                {/* Menu items with approval */}
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900">Menu Items ({items.length})</h3>
                  <p className="mt-1 text-xs text-stone-400">New items from merchants require your approval before they appear publicly.</p>
                  {detailLoading ? <p className="mt-4 text-sm text-stone-400">Loading…</p> : items.length === 0 ? (
                    <p className="mt-4 text-sm text-stone-400">No menu items yet.</p>
                  ) : (
                    <div className="mt-4 grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
                      {items.map(item => {
                        const status = item.approval_status || "approved";
                        const statusColor = status === "approved" ? "bg-emerald-100 text-emerald-700" : status === "rejected" ? "bg-red-100 text-red-600" : "bg-amber-100 text-amber-700";
                        return (
                          <div key={item.id} className="overflow-hidden rounded-xl border border-stone-200 bg-stone-50">
                            {item.image_url && (
                              <img src={item.image_url.startsWith("/") ? `${BACKEND_URL}${item.image_url}` : item.image_url}
                                alt={item.name} className="h-28 w-full object-cover" />
                            )}
                            <div className="p-3">
                              <div className="flex items-start justify-between gap-1">
                                <p className="font-bold text-sm leading-tight">{item.name}</p>
                                <p className="shrink-0 font-extrabold text-orange-600 text-sm">{money(item.price)}</p>
                              </div>
                              <span className={`mt-2 inline-block rounded-full px-2 py-0.5 text-[10px] font-bold capitalize ${statusColor}`}>{status}</span>
                              <div className="mt-3 flex gap-2 flex-wrap">
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
                                  className="rounded-lg bg-red-50 px-2.5 py-1.5 text-[11px] font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 transition">
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

                {/* Pickup slots */}
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900">Pickup Slots ({slots.length})</h3>
                  {detailLoading ? <p className="mt-4 text-sm text-stone-400">Loading…</p> : slots.length === 0 ? (
                    <p className="mt-4 text-sm text-stone-400">No pickup slots configured.</p>
                  ) : (
                    <ul className="mt-4 space-y-2">
                      {slots.map(s => (
                        <li key={s.id} className="flex items-center justify-between gap-3 rounded-xl border border-stone-100 bg-stone-50 px-4 py-3">
                          <div>
                            <p className="text-sm font-semibold">{new Date(s.time_slot).toLocaleString("en-MY", { timeZone: "Asia/Kuala_Lumpur" })}</p>
                            <p className="text-xs text-stone-500">
                              {s.current_bookings} / {s.max_capacity} booked
                              {s.is_full && <span className="ml-2 rounded-full bg-red-100 px-2 py-0.5 text-[10px] font-bold text-red-600">FULL</span>}
                            </p>
                          </div>
                          <button onClick={() => deleteSlot(s.id)} disabled={busy}
                            className="rounded-lg bg-red-50 px-3 py-1.5 text-xs font-bold text-red-600 hover:bg-red-100 disabled:opacity-50 transition">
                            Delete
                          </button>
                        </li>
                      ))}
                    </ul>
                  )}
                </div>

                {/* Orders */}
                <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
                  <h3 className="font-bold text-slate-900">Orders ({orders.length})</h3>
                  <div className="mt-4 max-h-96 space-y-2 overflow-auto">
                    {orders.map(o => (
                      <details key={o.id} className="rounded-xl border border-stone-100 bg-stone-50 p-4">
                        <summary className="cursor-pointer text-sm font-semibold">
                          {o.order_number || o.id.slice(0, 8)} · {o.customer_name} · <span className="capitalize">{o.status.replaceAll("_", " ")}</span> · {money(o.total_price)}
                        </summary>
                        <ul className="mt-3 text-sm text-stone-600">{o.items.map((i, n) => <li key={n}>{i.quantity} × {i.name}</li>)}</ul>
                        {o.transaction_ref && (
                          <p className="mt-2 break-all text-xs text-stone-400">
                            Receipt: {o.transaction_ref.startsWith("https://")
                              ? <a className="underline text-violet-700" href={o.transaction_ref} target="_blank" rel="noopener noreferrer">View</a>
                              : o.transaction_ref}
                          </p>
                        )}
                      </details>
                    ))}
                    {!orders.length && <p className="text-sm text-stone-400">No orders yet.</p>}
                  </div>
                </div>
              </div>
            )}
          </div>
        )}

        {/* ═══════════════════════════════════════════════════════════════
            TAB: EVENTS
        ══════════════════════════════════════════════════════════════════ */}
        {tab === "events" && (
          <div className="space-y-6">
            {/* Create event form */}
            <div className="rounded-2xl border border-violet-200 bg-gradient-to-br from-violet-50 to-rose-50 p-6 shadow-sm">
              <h2 className="text-xl font-black text-slate-900">Create New Event</h2>
              <p className="mt-1 text-sm text-stone-500">Events appear as a highlighted banner on the marketplace. Customers can tap to visit the event's dedicated page.</p>
              <form onSubmit={createEvent} className="mt-5 grid gap-4 sm:grid-cols-2">
                <label className="text-sm font-semibold">Event Name *
                  <input required value={eventName} onChange={e => setEventName(e.target.value)} className={input} placeholder="e.g. SDG Day 2026" />
                </label>
                <label className="text-sm font-semibold">Location *
                  <input required value={eventLocation} onChange={e => setEventLocation(e.target.value)} className={input} placeholder="e.g. Sunway Campus Boulevard" />
                </label>
                <label className="text-sm font-semibold sm:col-span-2">Description
                  <textarea value={eventDesc} onChange={e => setEventDesc(e.target.value)} className={`${input} resize-none`} rows={2} placeholder="What's this event about?" />
                </label>
                <label className="text-sm font-semibold">Starts (Malaysia) *
                  <input required type="datetime-local" value={eventStart} onChange={e => setEventStart(e.target.value)} className={input} />
                </label>
                <label className="text-sm font-semibold">Ends (Malaysia) *
                  <input required type="datetime-local" value={eventEnd} onChange={e => setEventEnd(e.target.value)} className={input} />
                </label>
                <label className="text-sm font-semibold sm:col-span-2">Event Page URL (within the app, e.g. /events/sdg-day)
                  <input value={eventUrl} onChange={e => setEventUrl(e.target.value)} className={input} placeholder="/events/sdg-day" />
                </label>
                <label className="text-sm font-semibold sm:col-span-2">Event Poster / Banner Image
                  <input type="file" accept="image/png,image/jpeg,image/jpg,image/webp"
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

            {/* Manage event vendors */}
            <div className="rounded-2xl border border-stone-200 bg-white p-6 shadow-sm">
              <h2 className="font-bold text-slate-900">Manage Event Vendors</h2>
              <label className="mt-3 block text-sm font-semibold">Select Event
                <select className={input} value={eventId} onChange={e => setEventId(e.target.value)}>
                  <option value="">— choose an event —</option>
                  {activeEvents.map(e => <option key={e.id} value={e.id}>{e.name} · {e.location}</option>)}
                  {events.filter(e => new Date(e.end_time).getTime() < pageLoadedAt).map(e => <option key={e.id} value={e.id}>[Past] {e.name}</option>)}
                </select>
              </label>

              {eventId && (() => {
                const ev = events.find(e => e.id === eventId);
                return (
                  <div className="mt-5 space-y-5">
                    {/* Event info bar */}
                    {ev && (
                      <div className="rounded-xl border border-violet-100 bg-violet-50 p-4 flex flex-wrap items-start gap-4">
                        {ev.banner_image_url && (
                          <img src={ev.banner_image_url} alt="Event banner" className="h-16 w-24 rounded-lg object-cover border border-violet-200" />
                        )}
                        <div className="flex-1 min-w-0">
                          <p className="font-bold text-slate-900">{ev.name}</p>
                          <p className="text-xs text-stone-500">📍 {ev.location}</p>
                          {ev.description && <p className="text-xs text-stone-500 mt-1">{ev.description}</p>}
                          {ev.event_url && <p className="text-xs text-violet-600 mt-1">🔗 {ev.event_url}</p>}
                        </div>
                        {/* Upload new banner for existing event */}
                        <div>
                          <label className="cursor-pointer rounded-lg border border-violet-200 bg-white px-3 py-2 text-xs font-bold text-violet-700 hover:bg-violet-50 transition">
                            📷 Replace Poster
                            <input type="file" accept="image/*" className="hidden"
                              onChange={async e => {
                                const f = e.target.files?.[0]; if (!f) return;
                                setBusy(true);
                                try {
                                  await uploadBanner(eventId, f);
                                  const refreshed = await api("/events");
                                  setEvents(refreshed);
                                  setMessage("Event banner updated.");
                                } catch (ex: any) { setError(ex.message); }
                                finally { setBusy(false); }
                              }} />
                          </label>
                        </div>
                      </div>
                    )}

                    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl bg-stone-50 border border-stone-100 p-4">
                      <p className="text-sm"><strong>{eventMemberIds.length}</strong> vendor{eventMemberIds.length !== 1 ? "s" : ""} in this event</p>
                      <button disabled={busy} onClick={deleteEvent}
                        className="rounded-lg bg-red-50 px-3 py-2 text-xs font-bold text-red-700 hover:bg-red-100 transition disabled:opacity-50">
                        🗑️ Delete Event
                      </button>
                    </div>

                    <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
                      {merchants.filter(m => m.is_active !== false).map(m => {
                        const included = eventMemberIds.includes(m.id);
                        return (
                          <div key={m.id} className={`flex items-center justify-between gap-3 rounded-xl border p-3 transition ${included ? "border-violet-200 bg-violet-50" : "border-stone-200 bg-white"}`}>
                            <div className="min-w-0">
                              <p className="font-bold text-sm truncate">{m.name}</p>
                              <p className="text-xs text-stone-500">{m.location}</p>
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
                );
              })()}
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
                <p className="text-xs text-stone-400 mt-0.5">You can edit store name, campus location, and store bio. Email and phone can only be changed by the merchant.</p>
              </div>
              <button onClick={() => setEditMerchant(null)} className="h-8 w-8 rounded-full bg-stone-100 text-stone-500 font-bold hover:bg-stone-200 flex items-center justify-center">✕</button>
            </div>
            <form onSubmit={saveEdit} className="space-y-4">
              <label className="block text-sm font-semibold">Store Name *
                <input required value={editName} onChange={e => setEditName(e.target.value)} className={input} />
              </label>
              <label className="block text-sm font-semibold">Campus Location *
                <input required value={editLocation} onChange={e => setEditLocation(e.target.value)} className={input} />
              </label>
              <label className="block text-sm font-semibold">Store Bio / Description
                <textarea value={editBio} onChange={e => setEditBio(e.target.value)} className={`${input} resize-none`} rows={3} />
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
    </main>
  );
}
