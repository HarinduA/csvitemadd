import React, { useState, useRef, useCallback } from 'react'

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

    // ── fetch items ──────────────────────────────────────────────────────────────
    const fetchItems = useCallback(async (p = 1, s = search) => {
        setLoadingItems(true)
        setTableErr(null)
        try {
            const params = new URLSearchParams({ page: p, pageSize: PAGE_SIZE })
            if (s) params.set('search', s)
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
    }, [search])

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
        } catch (e) {
            setUploadErr(e.message)
        } finally {
            setUploading(false)
        }
    }

    // ── clear all ────────────────────────────────────────────────────────────────
    const clearAll = async () => {
        if (!window.confirm('Delete ALL items from the database?')) return
        setClearing(true)
        try {
            const res = await fetch(`${API}/clear`, { method: 'DELETE' })
            if (!res.ok) throw new Error(`HTTP ${res.status}`)
            setItems([]); setTotal(0); setResult(null)
        } catch (e) {
            setTableErr(e.message)
        } finally {
            setClearing(false)
        }
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
        btn: (variant = 'primary', disabled = false) => ({
            display: 'inline-flex', alignItems: 'center', gap: 8,
            padding: '10px 20px', borderRadius: 'var(--radius-sm)',
            cursor: disabled ? 'not-allowed' : 'pointer',
            fontFamily: 'Inter, sans-serif', fontWeight: 600, fontSize: 14,
            opacity: disabled ? 0.5 : 1, transition: 'all var(--transition)',
            background: variant === 'primary' ? 'linear-gradient(135deg, var(--accent), #a78bfa)'
                : variant === 'danger' ? 'var(--error-bg)'
                    : 'var(--bg-card-hover)',
            color: variant === 'danger' ? 'var(--error)' : 'var(--text-primary)',
            border: variant === 'danger' ? '1px solid rgba(239,68,68,0.3)' : '1px solid transparent',
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
    }

    return (
        <div style={css.shell}>
            {/* ── Header ── */}
            <header style={css.header}>
                <div style={css.logo}>📦</div>
                <div>
                    <div style={{ fontWeight: 800, fontSize: 18, color: '#ffffff' }}>CSV Item Adder</div>
                    <div style={{ fontSize: 13, color: 'rgba(255,255,255,0.7)' }}>Upload CSV → MSSQL database</div>
                </div>
                {total > 0 && (
                    <div style={{ marginLeft: 'auto' }}>
                        <StatusBadge type="info">🗄 {total.toLocaleString()} rows in DB</StatusBadge>
                    </div>
                )}
            </header>

            <main style={css.main}>
                {/* ── Upload Card ── */}
                <div style={css.card}>
                    <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
                        <div>
                            <h2 style={{ fontSize: 16, fontWeight: 700, color: 'var(--text-primary)' }}>Upload CSV File</h2>
                            <p style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 2 }}>
                                Columns: <code style={{ color: 'var(--accent)' }}>copcode, loca_code, item_code, qty1, qty2</code>
                            </p>
                        </div>
                    </div>

                    {/* Drop zone */}
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
                                <div style={{ fontSize: 36 }}></div>
                                <div style={{ marginTop: 10, fontWeight: 600, color: 'var(--text-primary)' }}>{file.name}</div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                    {(file.size / 1024).toFixed(1)} KB · Click to change
                                </div>
                            </>
                        ) : (
                            <>
                                <div style={{ fontSize: 40 }}>⬆</div>
                                <div style={{ fontWeight: 600, color: 'var(--text-primary)', marginTop: 10 }}>
                                    Drag & drop your CSV here
                                </div>
                                <div style={{ fontSize: 13, color: 'var(--text-muted)', marginTop: 4 }}>
                                    or click to browse — up to 50 MB
                                </div>
                            </>
                        )}
                    </div>

                    {/* Actions */}
                    {file && (
                        <div style={{ display: 'flex', gap: 10, marginTop: 16 }}>
                            <button
                                id="btn-upload"
                                style={css.btn('primary', uploading)}
                                disabled={uploading}
                                onClick={upload}
                            >
                                {uploading ? ' Uploading…' : ' Upload to Database'}
                            </button>
                            <button
                                style={css.btn('secondary')}
                                onClick={() => { setFile(null); setResult(null); setUploadErr(null) }}
                            >
                                ✕ Clear
                            </button>
                        </div>
                    )}

                    {/* Upload progress bar placeholder */}
                    {uploading && (
                        <div style={{ marginTop: 14, height: 4, borderRadius: 2, background: 'var(--border)', overflow: 'hidden' }}>
                            <div style={{
                                height: '100%', width: '100%',
                                background: 'linear-gradient(90deg, var(--accent), #a78bfa)',
                                animation: 'slide 1.5s ease-in-out infinite',
                            }} />
                        </div>
                    )}

                    {/* Result */}
                    {result && (
                        <div style={{ marginTop: 16, padding: '16px 20px', background: 'var(--success-bg)', border: '1px solid rgba(34,197,94,0.25)', borderRadius: 'var(--radius-sm)' }}>
                            <div style={{ fontWeight: 700, color: 'var(--success)', marginBottom: 4 }}>{result.message}</div>
                            <div style={{ fontSize: 13, color: 'var(--text-secondary)' }}>
                                Parsed: {result.totalRows?.toLocaleString()} rows · Saved: {result.savedRows?.toLocaleString()} rows
                                {result.errors?.length > 0 && (
                                    <span style={{ color: 'var(--warning)', marginLeft: 12 }}>⚠ {result.errors.length} bad rows skipped</span>
                                )}
                            </div>
                        </div>
                    )}

                    {/* Upload error */}
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
                            Database Items
                            {total > 0 && <span style={{ marginLeft: 10, fontSize: 13, fontWeight: 400, color: 'var(--text-muted)' }}>({total.toLocaleString()} total)</span>}
                        </h2>
                        <div style={{ display: 'flex', gap: 10, flexWrap: 'wrap' }}>
                            <form onSubmit={handleSearch} style={{ display: 'flex', gap: 8 }}>
                                <input
                                    id="search-input"
                                    style={css.input}
                                    placeholder="Search copcode / loca / item…"
                                    value={searchInput}
                                    onChange={(e) => setSearchInput(e.target.value)}
                                />
                                <button id="btn-search" type="submit" style={css.btn('secondary')}>🔍</button>
                                {search && (
                                    <button type="button" style={css.btn('secondary')} onClick={() => {
                                        setSearchInput(''); setSearch(''); fetchItems(1, '')
                                    }}>✕</button>
                                )}
                            </form>
                            <button id="btn-load" style={css.btn('secondary', loadingItems)} disabled={loadingItems} onClick={() => fetchItems(1, search)}>
                                {loadingItems ? '⏳ Loading…' : ' Load'}
                            </button>
                            {total > 0 && (
                                <button id="btn-clear-all" style={css.btn('danger', clearing)} disabled={clearing} onClick={clearAll}>
                                    {clearing ? 'Clearing…' : ' Clear All'}
                                </button>
                            )}
                        </div>
                    </div>

                    {tableErr && (
                        <div style={{ padding: '12px 16px', background: 'var(--error-bg)', border: '1px solid rgba(239,68,68,0.25)', borderRadius: 'var(--radius-sm)', color: 'var(--error)', marginBottom: 16 }}>
                            {tableErr}
                        </div>
                    )}

                    {items.length === 0 && !loadingItems ? (
                        <div style={{ textAlign: 'center', padding: '48px 24px', color: 'var(--text-muted)' }}>
                            <div style={{ fontSize: 40 }}>🗃</div>
                            <div style={{ marginTop: 10, fontWeight: 500 }}>No items loaded</div>
                            <div style={{ fontSize: 13, marginTop: 4 }}>Upload a CSV or click Load to view records</div>
                        </div>
                    ) : (
                        <>
                            <div style={{ overflowX: 'auto' }}>
                                <table style={css.table}>
                                    <thead>
                                        <tr>
                                            {['#', 'Copcode', 'Loca Code', 'Item Code', 'Qty 1', 'Qty 2'].map(h => (
                                                <th key={h} style={css.th}>{h}</th>
                                            ))}
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {items.map((row, i) => (
                                            <tr key={row.id} style={{ transition: 'background var(--transition)' }}>
                                                <td style={{ ...css.td(i), color: 'var(--text-muted)', fontSize: 12 }}>{(page - 1) * PAGE_SIZE + i + 1}</td>
                                                <td style={css.td(i)}><code style={{ color: 'var(--accent)' }}>{row.copcode}</code></td>
                                                <td style={css.td(i)}>{row.loca_code || row.locaCode}</td>
                                                <td style={css.td(i)}><strong>{row.item_code || row.itemCode}</strong></td>
                                                <td style={css.td(i)}>{fmt(row.qty1)}</td>
                                                <td style={css.td(i)}>{fmt(row.qty2)}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>

                            {/* Pagination */}
                            {totalPages > 1 && (
                                <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8, marginTop: 20 }}>
                                    <button style={css.btn('secondary', page === 1)} disabled={page === 1} onClick={() => fetchItems(page - 1)}>‹ Prev</button>
                                    <span style={{ fontSize: 13, color: 'var(--text-muted)', padding: '0 8px' }}>
                                        Page {page} / {totalPages}
                                    </span>
                                    <button style={css.btn('secondary', page === totalPages)} disabled={page === totalPages} onClick={() => fetchItems(page + 1)}>Next ›</button>
                                </div>
                            )}
                        </>
                    )}
                </div>
            </main>

            {/* ── Footer ── */}
            <footer style={{ textAlign: 'center', padding: '16px 32px', borderTop: '1px solid var(--border)', color: 'var(--text-muted)', fontSize: 12, background: '#fff' }}>
                CSV Item Adder · Backend <code style={{ color: 'var(--accent)' }}>localhost:5000</code> · DB <code style={{ color: 'var(--accent)' }}>CsvItemAdderDB</code>
            </footer>

            <style>{`
        @keyframes slide {
          0%   { transform: translateX(-100%); }
          50%  { transform: translateX(0%);    }
          100% { transform: translateX(100%);  }
        }
        button:hover:not(:disabled) { filter: brightness(0.93); transform: translateY(-1px); }
        tr:hover td { background: rgba(37,99,235,0.04) !important; }
        .upload-card { box-shadow: 0 1px 8px rgba(0,0,0,0.08); }
      `}</style>
        </div>
    )
}
