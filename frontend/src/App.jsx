import React, { useState, useRef, useCallback, useEffect } from 'react'

const API = '/api/items'

// ── tiny helpers ──────────────────────────────────────────────────────────────
const fmt = (n) => Number(n ?? 0).toLocaleString(undefined, { minimumFractionDigits: 2, maximumFractionDigits: 4 })

function StatusBadge({ type, children }) {
    const colors = {
        success: { bg: 'rgba(22,163,74,0.08)', color: '#16a34a', border: 'rgba(22,163,74,0.25)' },
        error: { bg: 'rgba(220,38,38,0.08)', color: '#dc2626', border: 'rgba(220,38,38,0.25)' },
        warning: { bg: 'rgba(217,119,6,0.08)', color: '#d97706', border: 'rgba(217,119,6,0.25)' },
        info: { bg: 'rgba(37,99,235,0.08)', color: '#2563eb', border: 'rgba(37,99,235,0.25)' },
    }
    const s = colors[type] || colors.info
    return (
        <span style={{
            display: 'inline-flex', alignItems: 'center', gap: 6,
            background: s.bg, color: s.color,
            border: `1px solid ${s.border}`,
            borderRadius: 20, padding: '4px 12px', fontSize: 13, fontWeight: 600,
        }}>
            {children}
        </span>
    )
}

// ── main component ─────────────────────────────────────────────────────────────
export default function App() {
    // upload state
    const [dragging, setDragging] = useState(false)
    const [file, setFile] = useState(null)
    const [uploading, setUploading] = useState(false)
    const [result, setResult] = useState(null)   // { message, totalRows, savedRows, errors[] }
    const [uploadErr, setUploadErr] = useState(null)
    const fileRef = useRef()

    // items table state
    const [items, setItems] = useState([])
    const [total, setTotal] = useState(0)
    const [page, setPage] = useState(1)
    const [search, setSearch] = useState('')
    const [searchInput, setSearchInput] = useState('')
    const [loadingItems, setLoadingItems] = useState(false)
    const [tableErr, setTableErr] = useState(null)
    const [clearing, setClearing] = useState(false)
    const PAGE_SIZE = 50

    // history state
    const [history, setHistory] = useState([])
    const [selectedUpload, setSelectedUpload] = useState(null) // null = all items
    const [loadingHistory, setLoadingHistory] = useState(false)
    const [view, setView] = useState('inventory') // 'inventory' or 'history'

    // ── fetch history ───────────────────────────────────────────────────────────
    const fetchHistory = useCallback(async () => {
        setLoadingHistory(true)
        try {
            const res = await fetch(`${API}/history`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setHistory(data || [])
        } catch (e) {
            console.error('History fetch failed:', e)
        } finally {
            setLoadingHistory(false)
        }
    }, [])

    // ── fetch items ──────────────────────────────────────────────────────────────
    const fetchItems = useCallback(async (p = 1, s = search, uId = selectedUpload?.id) => {
        setLoadingItems(true)
        setTableErr(null)
        try {
            const params = new URLSearchParams({ page: p, pageSize: PAGE_SIZE })
            if (s) params.set('search', s)
            if (uId) params.set('uploadId', uId)
            const res = await fetch(`${API}?${params}`)
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            const data = await res.json()
            setItems(data.items || [])
            setTotal(data.total || 0)
            setPage(p)
        } catch (e) {
            setTableErr(e.message)
        } finally {
            setLoadingItems(false)
        }
    }, [search, selectedUpload])

    // Auto-load items and history on mount
    useEffect(() => {
        fetchItems(1)
        fetchHistory()
    }, [fetchItems, fetchHistory])

    // ── file pick helpers ────────────────────────────────────────────────────────
    const pickFile = (f) => {
        if (!f) return
        if (!f.name.endsWith('.csv')) { setUploadErr('Only .csv files are accepted.'); return }
        setFile(f); setResult(null); setUploadErr(null)
    }

    const onDrop = (e) => {
        e.preventDefault(); setDragging(false)
        pickFile(e.dataTransfer.files[0])
    }

    // ── upload ───────────────────────────────────────────────────────────────────
    const upload = async () => {
        if (!file) return
        setUploading(true); setResult(null); setUploadErr(null)
        try {
            const form = new FormData()
            form.append('file', file)
            const res = await fetch(`${API}/upload`, { method: 'POST', body: form })
            const data = await res.json()
            if (!res.ok) throw new Error(data.message || `HTTP ${res.status}`)
            setResult(data)
            setFile(null)
            fetchItems(1, search)
            fetchHistory()
        } catch (e) {
            setUploadErr(e.message)
        } finally {
            setUploading(false)
        }
    }

    // ── clear all ────────────────────────────────────────────────────────────────
    const clearAll = async () => {
        if (!window.confirm('Delete ALL items and upload history from the database?')) return
        setClearing(true)
        try {
            const res = await fetch(`${API}/clear`, { method: 'DELETE' })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            setItems([]); setTotal(0); setResult(null); setHistory([]); setSelectedUpload(null)
        } catch (e) {
            setTableErr(e.message)
        } finally {
            setClearing(false)
        }
    }

    const removeHistoryEntry = async (id, e) => {
        e.stopPropagation()
        if (!window.confirm('Remove this history entry? (Items will remain)')) return
        try {
            const res = await fetch(`${API}/history/${id}`, { method: 'DELETE' })
            if (res.ok) {
                if (selectedUpload?.id === id) setSelectedUpload(null)
                fetchHistory()
            }
        } catch (err) { console.error(err) }
    }

    const handleSearch = (e) => {
        e.preventDefault()
        const s = searchInput.trim()
        setSearch(s)
        fetchItems(1, s)
    }

    const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE))

    // ── styles (inline design system) ────────────────────────────────────────────
    const css = {
        shell: { minHeight: '100vh', display: 'flex', flexDirection: 'column' },
        header: {
            background: 'linear-gradient(135deg, #1e40af 0%, #2563eb 100%)',
            borderBottom: '1px solid #1d4ed8',
            padding: '20px 32px', display: 'flex', alignItems: 'center', gap: 16,
        },
        logo: {
            width: 42, height: 42, borderRadius: 10,
            background: 'rgba(255,255,255,0.2)',
            display: 'flex', alignItems: 'center', justifyContent: 'center',
            fontSize: 20, boxShadow: '0 0 16px rgba(255,255,255,0.15)',
        },
        main: { flex: 1, padding: '36px 32px', maxWidth: 1200, margin: '0 auto', width: '100%' },
        card: {
            background: 'var(--bg-card)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius)', padding: 28, marginBottom: 28,
            boxShadow: '0 1px 8px rgba(0,0,0,0.07)',
        },
        zone: (active) => ({
            border: `2px dashed ${active ? 'var(--accent)' : 'var(--border-light)'}`,
            borderRadius: 'var(--radius)', padding: '48px 24px',
            textAlign: 'center', cursor: 'pointer',
            background: active ? 'var(--accent-glow)' : 'transparent',
            transition: 'all var(--transition)',
        }),
        btn: (variant = 'primary', disabled = false, small = false) => ({
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: small ? '6px 12px' : '10px 20px', borderRadius: 'var(--radius-sm)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: small ? 12 : 14,
            opacity: disabled ? 0.5 : 1, transition: 'all var(--transition)',
            background: variant === 'primary' ? 'linear-gradient(135deg, var(--accent), #a78bfa)'
                : variant === 'danger' ? 'var(--error-bg)'
                    : variant === 'active' ? 'var(--accent)'
                        : 'var(--bg-card-hover)',
            color: variant === 'danger' ? 'var(--error)'
                : variant === 'active' || variant === 'primary' ? '#fff'
                    : 'var(--text-primary)',
            border: variant === 'danger' ? '1px solid rgba(239,68,68,0.3)' : '1px solid var(--border)',
            boxShadow: variant === 'primary' && !disabled ? '0 4px 16px var(--accent-glow)' : 'none',
        }),
        input: {
            background: 'var(--bg-secondary)', border: '1px solid var(--border)',
            borderRadius: 'var(--radius-sm)', color: 'var(--text-primary)',
            padding: '9px 14px', fontSize: 14, fontFamily: 'Inter, sans-serif',
            outline: 'none', flex: 1,
        },
        table: { width: '100%', borderCollapse: 'collapse', fontSize: 14 },
        th: {
            color: 'var(--text-muted)', fontWeight: 600, fontSize: 12,
            textTransform: 'uppercase', letterSpacing: 0.6,
            padding: '10px 14px', textAlign: 'left',
            borderBottom: '1px solid var(--border)',
        },
        td: (i) => ({
            padding: '11px 14px', borderBottom: '1px solid var(--border)',
            color: 'var(--text-primary)',
            background: i % 2 === 0 ? 'transparent' : 'rgba(255,255,255,0.015)',
        }),
        tab: (active) => ({
            padding: '12px 24px', cursor: 'pointer', fontWeight: 600, fontSize: 15,
            borderBottom: `2px solid ${active ? 'var(--accent)' : 'transparent'}`,
            color: active ? 'var(--accent)' : 'var(--text-muted)',
            transition: 'all 0.2s',
        }),
        historyItem: (active) => ({
            padding: '14px 18px', borderRadius: 'var(--radius-sm)',
            border: `1px solid ${active ? 'var(--accent)' : 'var(--border)'}`,
            background: active ? 'var(--accent-glow)' : 'var(--bg-secondary)',
            cursor: 'pointer', transition: 'all 0.2s', marginBottom: 10,
            display: 'flex', alignItems: 'center', justifyContent: 'space-between',
        }),
    }

    return (
        <div style={css.shell}>
            {/* ── Header ── */}
            <header style={css.header}>
                <div style={css.logo}>📦</div>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#ffffff' }}>CSV Item Management</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Advanced Inventory & Upload History</div>
                </div>
                {total > 0 && (
                    <div style={{ marginLeft: 'auto' }}>
                        <StatusBadge type="info">🗄 {total.toLocaleString()} rows total</StatusBadge>
                    </div>
                )}
            </header>

            <main style={css.main}>

                {/* ── Tabs ── */}
                <div style={{ display: 'flex', gap: 8, marginBottom: 24, borderBottom: '1px solid var(--border)' }}>
                    <div style={css.tab(view === 'inventory')} onClick={() => setView('inventory')}>Dashboard</div>
                    <div style={css.tab(view === 'history')} onClick={() => setView('history')}>Upload History</div>
                </div>

                {view === 'inventory' ? (
                    <>
                        {/* ── Upload Card ── */}
                        <div style={css.card}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                                <div>
                                    <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Upload New CSV</h2>
                                    <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                                        Recognized columns: <code style={{ color: 'var(--accent)' }}>Item Code, Item Description, Bulk, Loose</code>
                                    </p>
                                </div>
                            </div>

                            <div
                                style={css.zone(dragging)}
                                onClick={() => fileRef.current?.click()}
                                onDragOver={(e) => { e.preventDefault(); setDragging(true) }}
                                onDragLeave={() => setDragging(false)}
                                onDrop={onDrop}
                            >
                                <input
                                    ref={fileRef} type="file" accept=".csv" style={{ display: 'none' }}
                                    onChange={(e) => pickFile(e.target.files[0])}
                                />
                                {file ? (
                                    <>
                                        <div style={{ marginTop: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                            {(file.size / 1024).toFixed(1)} KB · Click to change
                                        </div>
                                    </>
                                ) : (
                                    <>
                                        <div style={{ fontSize: 32 }}>⬆</div>
                                        <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 10 }}>
                                            Drag & drop your CSV here
                                        </div>
                                        <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                            or click to browse
                                        </div>
                                    </>
                                )}
                            </div>

                            {file && (
                                <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                                    <button style={css.btn('primary', uploading)} disabled={uploading} onClick={upload}>
                                        {uploading ? ' Uploading…' : ' Process & Save'}
                                    </button>
                                    <button style={css.btn('secondary')} onClick={() => { setFile(null); setResult(null); setUploadErr(null) }}>✕ Cancel</button>
                                </div>
                            )}

                            {result && (
                                <div style={{ marginTop: 16, padding: '16px 20px', background: 'var(--success-bg)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-sm)' }}>
                                    <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>{result.message}</div>
                                    <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                        Found: {result.totalRows} rows · {result.savedRows} saved successfully.
                                    </div>
                                </div>
                            )}

                            {uploadErr && (
                                <div style={{ marginTop: 16, padding: '14px 18px', background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', color: 'var(--error)' }}>
                                    {uploadErr}
                                </div>
                            )}
                        </div>

                        {/* ── Items Table Card ── */}
                        <div style={css.card}>
                            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20, flexWrap: 'wrap', gap: 12 }}>
                                <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>
                                    {selectedUpload ? `Items from: ${selectedUpload.fileName}` : 'All Inventory Items'}
                                    {selectedUpload && (
                                        <button
                                            style={{ marginLeft: 12, border: 'none', background: 'none', color: 'var(--accent)', cursor: 'pointer', fontSize: 13 }}
                                            onClick={() => { setSelectedUpload(null); fetchItems(1, search, null) }}
                                        >
                                            Show All ✕
                                        </button>
                                    )}
                                </h2>
                                <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                                    <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
                                        <input
                                            style={css.input}
                                            placeholder="Search items…"
                                            value={searchInput}
                                            onChange={(e) => setSearchInput(e.target.value)}
                                        />
                                        <button type="submit" style={css.btn('secondary')}>🔍</button>
                                    </form>
                                    <button style={css.btn('danger', clearing)} disabled={clearing} onClick={clearAll}>
                                        {clearing ? 'Clearing…' : ' Reset Database'}
                                    </button>
                                </div>
                            </div>

                            {tableErr && (
                                <div style={{ padding: '12px 16px', background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', color: 'var(--error)', marginBottom: 16 }}>
                                    {tableErr}
                                </div>
                            )}

                            <div style={{ overflowX: 'auto' }}>
                                <table style={css.table}>
                                    <thead>
                                        <tr>
                                            {['#', 'Item Code', 'Description', 'Bulk (Qty1)', 'Loose (Qty2)'].map(h => (
                                                <th key={h} style={css.th}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((row, i) => (
                                            <tr key={`${row.itemCode}-${i}`}>
                                                <td style={css.td(i)}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                                                <td style={css.td(i)}><strong>{row.itemCode}</strong></td>
                                                <td style={css.td(i)}>{row.description || '—'}</td>
                                                <td style={css.td(i)}>{fmt(row.qty1)}</td>
                                                <td style={css.td(i)}>{fmt(row.qty2)}</td>
                                            </tr>
                                        ))}
                                        {items.length === 0 && (
                                            <tr><td colSpan="5" style={{ textAlign: 'center', padding: 40, color: 'var(--text-muted)' }}>No data found</td></tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {totalPages > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                                    <button style={css.btn('secondary', page === 1)} disabled={page === 1} onClick={() => fetchItems(page - 1)}>‹</button>
                                    <span style={{ fontSize: 13, color: 'var(--text-muted)' }}>Page {page} / {totalPages}</span>
                                    <button style={css.btn('secondary', page === totalPages)} disabled={page === totalPages} onClick={() => fetchItems(page + 1)}>+</button>
                                </div>
                            )}
                        </div>
                    </>
                ) : (
                    <div style={css.card}>
                        <h2 style={{ fontSize: 18, fontWeight: 800, color: 'var(--text-primary)', marginBottom: 20 }}>Upload History</h2>
                        {history.length === 0 ? (
                            <div style={{ textAlign: 'center', padding: 60, color: 'var(--text-muted)' }}>
                                <div style={{ fontSize: 40 }}>📜</div>
                                <p>No uploads recorded yet.</p>
                            </div>
                        ) : (
                            <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(350px, 1fr))', gap: 16 }}>
                                {history.map(entry => (
                                    <div
                                        key={entry.id}
                                        style={css.historyItem(selectedUpload?.id === entry.id)}
                                        onClick={() => {
                                            setSelectedUpload(entry);
                                            setView('inventory');
                                            fetchItems(1, search, entry.id);
                                        }}
                                    >
                                        <div>
                                            <div style={{ fontWeight: 700, fontSize: 15, color: 'var(--text-primary)' }}>{entry.fileName}</div>
                                            <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>
                                                {new Date(entry.uploadDate).toLocaleString()} · {entry.savedRows} items
                                            </div>
                                        </div>
                                        <button
                                            style={{ ...css.btn('danger', false, true), padding: '4px 8px' }}
                                            onClick={(e) => removeHistoryEntry(entry.id, e)}
                                        >
                                            🗑
                                        </button>
                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                )}
            </main>

            <footer style={{ textAlign: 'center', padding: '16px 32px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, background: '#fff' }}>
                CSV Item Adder · MSSQL Connectivity Active · {total} Records
            </footer>

            <style>{`
                @keyframes slide {
                    0%   { transform: translateX(-100%); }
                    100% { transform: translateX(100%);  }
                }
                button:hover:not(:disabled) { filter: brightness(0.95); transform: translateY(-1px); }
                tr:hover td { background: rgba(37,99,235,0.02) !important; }
            `}</style>
        </div>
    )
}
