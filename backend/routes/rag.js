/**
 * RAG Route - Document upload, listing, and deletion
 */

import express from 'express';
import multer from 'multer';
import { createReadStream } from 'fs';
import { unlink, readFile } from 'fs/promises';
import { join, dirname, extname } from 'path';
import { fileURLToPath } from 'url';
import { v4 as uuidv4 } from 'uuid';
import { ingestDocument, listDocuments, deleteDocument, getDocumentStats } from '../rag/documentStore.js';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const router = express.Router();

// Configure multer for file uploads
const storage = multer.diskStorage({
  destination: (req, file, cb) => {
    cb(null, join(__dirname, '../uploads'));
  },
  filename: (req, file, cb) => {
    const ext = extname(file.originalname);
    cb(null, `${uuidv4()}${ext}`);
  }
});

const upload = multer({
  storage,
  limits: { fileSize: 10 * 1024 * 1024 }, // 10MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.txt', '.md', '.pdf', '.csv'];
    const ext = extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) {
      cb(null, true);
    } else {
      cb(new Error(`Unsupported file type: ${ext}. Allowed: ${allowed.join(', ')}`));
    }
  }
});

/**
 * POST /api/rag/upload
 * Upload and ingest a document
 */
router.post('/upload', upload.single('file'), async (req, res) => {
  if (!req.file) {
    return res.status(400).json({ error: 'No file uploaded' });
  }

  try {
    const filePath = req.file.path;
    const ext = extname(req.file.originalname).toLowerCase();
    let content = '';

    // Extract text content based on file type
    if (ext === '.pdf') {
      // Dynamic import for pdf-parse (avoids test file issues)
      try {
        const pdfParse = (await import('pdf-parse/lib/pdf-parse.js')).default;
        const dataBuffer = await readFile(filePath);
        const data = await pdfParse(dataBuffer);
        content = data.text;
      } catch (pdfErr) {
        console.error('[RAG] PDF parse error:', pdfErr.message);
        content = `[PDF content from ${req.file.originalname} - PDF parsing unavailable, please ensure pdf-parse is properly installed]`;
      }
    } else {
      // Plain text, markdown, csv
      content = await readFile(filePath, 'utf-8');
    }

    if (!content || content.trim().length < 10) {
      await unlink(filePath).catch(() => {});
      return res.status(400).json({ error: 'File appears to be empty or unreadable' });
    }

    // Ingest into document store
    const result = await ingestDocument(content, {
      filename: req.file.originalname,
      mimetype: req.file.mimetype,
      size: req.file.size,
      uploadedFile: req.file.filename
    });

    // Clean up uploaded file after ingestion
    await unlink(filePath).catch(() => {});

    res.json({
      success: true,
      message: `Document "${req.file.originalname}" ingested successfully`,
      docId: result.docId,
      chunks: result.chunks,
      filename: req.file.originalname,
      size: req.file.size
    });

  } catch (error) {
    console.error('[RAG UPLOAD ERROR]', error.message);
    // Clean up on error
    if (req.file?.path) {
      await unlink(req.file.path).catch(() => {});
    }
    res.status(500).json({ error: error.message || 'Failed to process document' });
  }
});

/**
 * GET /api/rag/documents
 * List all ingested documents
 */
router.get('/documents', async (req, res) => {
  try {
    const docs = await listDocuments();
    const stats = await getDocumentStats();
    res.json({ documents: docs, stats });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * DELETE /api/rag/documents/:docId
 * Delete a document from the store
 */
router.delete('/documents/:docId', async (req, res) => {
  try {
    const result = await deleteDocument(req.params.docId);
    res.json({
      success: true,
      message: `Removed ${result.removed} chunks`,
      ...result
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

/**
 * POST /api/rag/text
 * Ingest raw text directly (no file upload needed)
 */
router.post('/text', async (req, res) => {
  const { content, title = 'Manual Entry' } = req.body;

  if (!content || content.trim().length < 10) {
    return res.status(400).json({ error: 'Content must be at least 10 characters' });
  }

  try {
    const result = await ingestDocument(content, {
      filename: title,
      mimetype: 'text/plain',
      size: content.length
    });

    res.json({
      success: true,
      message: `Text "${title}" ingested successfully`,
      docId: result.docId,
      chunks: result.chunks
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

export default router;
