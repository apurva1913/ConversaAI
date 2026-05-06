import { useState, useEffect, useCallback } from 'react';
import { useDropzone } from 'react-dropzone';
import toast from 'react-hot-toast';
import { uploadDocument, getDocuments, deleteDocument, ingestText } from '../api/client';

const FILE_ICONS = {
  pdf: '📕', txt: '📄', md: '📝', csv: '📊',
};

function formatSize(bytes) {
  if (!bytes) return '—';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso) {
  if (!iso) return '—';
  return new Date(iso).toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' });
}

// ── Text Paste Modal ──────────────────────────────────────────────────────────
function TextIngestModal({ onClose, onSuccess }) {
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [loading, setLoading] = useState(false);

  const handleSubmit = async (e) => {
    e.preventDefault();
    if (!content.trim() || content.trim().length < 10) {
      toast.error('Content must be at least 10 characters');
      return;
    }
    setLoading(true);
    try {
      const result = await ingestText(content, title || 'Manual Entry');
      toast.success(`Ingested "${title || 'Manual Entry'}" — ${result.chunks} chunks`);
      onSuccess?.();
      onClose();
    } catch (err) {
      toast.error(err.message || 'Failed to ingest text');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--border)', borderRadius: 'var(--radius-xl)',
        padding: 28, width: '100%', maxWidth: 560, animation: 'fadeSlideIn 0.25s ease',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
          <h3 style={{ fontSize: 16, fontWeight: 700 }}>📝 Paste Text Content</h3>
          <button className="btn btn-ghost btn-icon" onClick={onClose}>✕</button>
        </div>
        <form onSubmit={handleSubmit} style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              DOCUMENT TITLE
            </label>
            <input
              type="text"
              placeholder="e.g. Company FAQ, Return Policy..."
              value={title}
              onChange={e => setTitle(e.target.value)}
              style={{
                width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '9px 14px', color: 'var(--text-primary)',
                fontSize: 14, outline: 'none', transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
          </div>
          <div>
            <label style={{ fontSize: 12.5, fontWeight: 600, color: 'var(--text-muted)', display: 'block', marginBottom: 6 }}>
              CONTENT <span style={{ color: 'var(--red)' }}>*</span>
            </label>
            <textarea
              placeholder="Paste your document content here..."
              value={content}
              onChange={e => setContent(e.target.value)}
              rows={10}
              required
              style={{
                width: '100%', background: 'var(--bg-tertiary)', border: '1px solid var(--border)',
                borderRadius: 'var(--radius)', padding: '9px 14px', color: 'var(--text-primary)',
                fontSize: 13.5, outline: 'none', resize: 'vertical', lineHeight: 1.55, transition: 'border-color 0.2s',
              }}
              onFocus={e => e.target.style.borderColor = 'var(--accent)'}
              onBlur={e => e.target.style.borderColor = 'var(--border)'}
            />
            <div style={{ fontSize: 11.5, color: 'var(--text-muted)', marginTop: 4 }}>
              {content.length} chars · ~{Math.max(1, Math.ceil(content.split(/\s+/).length / 320))} chunks
            </div>
          </div>
          <div style={{ display: 'flex', gap: 10, justifyContent: 'flex-end' }}>
            <button type="button" className="btn btn-ghost" onClick={onClose}>Cancel</button>
            <button type="submit" className="btn btn-primary" disabled={loading || !content.trim()}>
              {loading ? <><span className="spinner" /> Ingesting…</> : '⚡ Ingest Text'}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
}

// ── Delete Confirm ────────────────────────────────────────────────────────────
function DeleteConfirm({ doc, onConfirm, onCancel }) {
  return (
    <div style={{
      position: 'fixed', inset: 0, background: 'rgba(0,0,0,0.7)', backdropFilter: 'blur(4px)',
      display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 999, padding: 20,
    }}>
      <div style={{
        background: 'var(--bg-card)', border: '1px solid var(--red)', borderRadius: 'var(--radius-xl)',
        padding: 28, width: '100%', maxWidth: 400, textAlign: 'center', animation: 'fadeSlideIn 0.2s ease',
      }}>
        <div style={{ fontSize: 40, marginBottom: 12 }}>🗑️</div>
        <h3 style={{ fontSize: 16, fontWeight: 700, marginBottom: 10 }}>Delete Document?</h3>
        <p style={{ fontSize: 13.5, color: 'var(--text-muted)', marginBottom: 22 }}>
          "<strong style={{ color: 'var(--text-primary)' }}>{doc.filename}</strong>" and all its{' '}
          <strong>{doc.chunks}</strong> chunks will be permanently removed from the knowledge base.
        </p>
        <div style={{ display: 'flex', gap: 10, justifyContent: 'center' }}>
          <button className="btn btn-ghost" onClick={onCancel}>Cancel</button>
          <button className="btn btn-danger" onClick={onConfirm}>Yes, Delete</button>
        </div>
      </div>
    </div>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
export default function KnowledgeBasePage() {
  const [documents, setDocuments] = useState([]);
  const [stats, setStats] = useState({ totalDocuments: 0, totalChunks: 0 });
  const [uploading, setUploading] = useState(false);
  const [showTextModal, setShowTextModal] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  const [loadingDocs, setLoadingDocs] = useState(true);
  const [uploadProgress, setUploadProgress] = useState(null); // { name, percent }

  const fetchDocs = useCallback(async () => {
    try {
      const data = await getDocuments();
      setDocuments(data.documents || []);
      setStats(data.stats || {});
    } catch (err) {
      toast.error('Failed to load documents');
    } finally {
      setLoadingDocs(false);
    }
  }, []);

  useEffect(() => { fetchDocs(); }, [fetchDocs]);

  const onDrop = useCallback(async (acceptedFiles) => {
    if (!acceptedFiles.length) return;
    setUploading(true);

    for (const file of acceptedFiles) {
      setUploadProgress({ name: file.name, percent: 0 });
      // Simulate progress for UX
      const progressInterval = setInterval(() => {
        setUploadProgress(prev => prev ? { ...prev, percent: Math.min(prev.percent + 12, 90) } : null);
      }, 200);

      try {
        const result = await uploadDocument(file);
        clearInterval(progressInterval);
        setUploadProgress({ name: file.name, percent: 100 });
        toast.success(`✅ "${file.name}" ingested — ${result.chunks} chunks created`);
        await fetchDocs();
      } catch (err) {
        clearInterval(progressInterval);
        toast.error(`❌ "${file.name}": ${err.message}`);
      }
      setUploadProgress(null);
    }
    setUploading(false);
  }, [fetchDocs]);

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      'text/plain': ['.txt'],
      'text/markdown': ['.md'],
      'application/pdf': ['.pdf'],
      'text/csv': ['.csv'],
    },
    disabled: uploading,
    maxSize: 10 * 1024 * 1024,
    onDropRejected: (files) => {
      files.forEach(f => {
        const err = f.errors[0];
        toast.error(err?.code === 'file-too-large' ? `File too large (max 10 MB)` : err?.message || 'File rejected');
      });
    },
  });

  const handleDelete = async () => {
    if (!deleteTarget) return;
    try {
      await deleteDocument(deleteTarget.id);
      toast.success(`Deleted "${deleteTarget.filename}"`);
      setDeleteTarget(null);
      fetchDocs();
    } catch (err) {
      toast.error(err.message || 'Delete failed');
    }
  };

  const getFileIcon = (filename = '') => {
    const ext = filename.split('.').pop()?.toLowerCase();
    return FILE_ICONS[ext] || '📄';
  };

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
      {/* Header */}
      <div className="page-header">
        <div>
          <div className="page-title">📚 Knowledge Base</div>
          <div className="page-subtitle">
            {stats.totalDocuments} document{stats.totalDocuments !== 1 ? 's' : ''} · {stats.totalChunks} chunks indexed in Weaviate
          </div>
        </div>
        <button className="btn btn-ghost btn-sm" onClick={() => setShowTextModal(true)}>
          📝 Paste Text
        </button>
      </div>

      <div className="kb-layout">
        {/* Upload Zone */}
        <div {...getRootProps()} className={`upload-zone${isDragActive ? ' active' : ''}`}>
          <input {...getInputProps()} />
          <div className="upload-icon">{uploading ? '⏳' : '☁️'}</div>
          <div className="upload-title">
            {isDragActive ? 'Drop files here…' : uploading ? `Uploading...` : 'Drag & drop files, or click to browse'}
          </div>
          <div className="upload-sub">
            {uploadProgress
              ? `Processing "${uploadProgress.name}"…`
              : 'Documents are chunked and vectorized in Weaviate for semantic search'}
          </div>
          {uploadProgress && (
            <div className="progress-bar" style={{ maxWidth: 360, margin: '14px auto 0' }}>
              <div
                className="progress-fill"
                style={{
                  animation: 'none',
                  width: `${uploadProgress.percent}%`,
                  transition: 'width 0.2s ease',
                }}
              />
            </div>
          )}
          {!uploading && (
            <div className="upload-accepted">
              {['.pdf', '.txt', '.md', '.csv'].map(t => (
                <span key={t} className="file-type-pill">{t}</span>
              ))}
              <span className="file-type-pill">max 10 MB</span>
            </div>
          )}
        </div>

        {/* Stats Row */}
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 14 }}>
          {[
            { label: 'Documents', value: stats.totalDocuments, icon: '📄', color: 'var(--blue)' },
            { label: 'Total Chunks', value: stats.totalChunks, icon: '🧩', color: 'var(--accent)' },
            { label: 'Vector DB', value: 'Weaviate', icon: '🔮', color: 'var(--green)', isText: true },
          ].map(s => (
            <div key={s.label} className="stat-card" style={{ '--stat-color': s.color }}>
              <div className="stat-icon">{s.icon}</div>
              <div className="stat-value" style={{ fontSize: s.isText ? 18 : 28, color: s.color }}>
                {s.value}
              </div>
              <div className="stat-label">{s.label}</div>
            </div>
          ))}
        </div>

        {/* Document List */}
        <div>
          <div className="section-title">
            <span>📁</span> Indexed Documents
          </div>

          {loadingDocs ? (
            <div className="empty-state">
              <span className="spinner" style={{ width: 28, height: 28 }} />
              <span style={{ marginTop: 10 }}>Loading knowledge base…</span>
            </div>
          ) : documents.length === 0 ? (
            <div className="empty-state">
              <div className="empty-icon">📭</div>
              <strong style={{ color: 'var(--text-secondary)' }}>No documents yet</strong>
              <span>Upload PDFs, text files, or paste content above to start building your knowledge base.</span>
            </div>
          ) : (
            <div className="doc-list">
              {documents.map((doc) => (
                <div key={doc.id} className="doc-item">
                  <div className="doc-icon" style={{ background: 'var(--blue-subtle)', fontSize: 22 }}>
                    {getFileIcon(doc.filename)}
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div className="doc-name" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                      {doc.filename}
                    </div>
                    <div className="doc-meta">
                      Uploaded {formatDate(doc.uploadedAt)}
                      {doc.size > 0 && ` · ${formatSize(doc.size)}`}
                    </div>
                  </div>
                  <span className="doc-chunks">{doc.chunks} chunks</span>
                  <div style={{ display: 'flex', gap: 8 }}>
                    <button
                      className="btn btn-danger btn-sm"
                      onClick={() => setDeleteTarget(doc)}
                      title="Delete document"
                    >
                      🗑
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* Tips */}
        <div className="card" style={{ borderColor: 'var(--accent-glow)', background: 'var(--accent-subtle)' }}>
          <div style={{ fontWeight: 700, fontSize: 14, marginBottom: 10, color: 'var(--accent-light)' }}>
            💡 RAG Tips
          </div>
          <ul style={{ fontSize: 13, color: 'var(--text-secondary)', lineHeight: 1.7, paddingLeft: 18 }}>
            <li>Upload your company FAQ, product docs, or policy documents</li>
            <li>Each document is split into ~400-word chunks with 80-word overlap</li>
            <li>Weaviate uses <strong>text-embedding-3-small</strong> for semantic vector search</li>
            <li>The agent automatically queries the knowledge base for informational questions</li>
            <li>More specific documents = more accurate answers</li>
          </ul>
        </div>
      </div>

      {showTextModal && (
        <TextIngestModal onClose={() => setShowTextModal(false)} onSuccess={fetchDocs} />
      )}
      {deleteTarget && (
        <DeleteConfirm doc={deleteTarget} onConfirm={handleDelete} onCancel={() => setDeleteTarget(null)} />
      )}
    </div>
  );
}
