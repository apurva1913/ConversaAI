/**
 * Analytics Route - Aggregated dashboard metrics from MongoDB and Vector DB
 */

import express from 'express';
import { getDashboardStats } from '../analytics/analyticsStore.js';
import { listSessions } from '../memory/sessionMemory.js';
import { getDocumentStats } from '../rag/documentStore.js';
import { getActionStats } from '../actions/actionHandlers.js';

const router = express.Router();

/**
 * GET /api/analytics
 * Full analytics dashboard data
 */
router.get('/', async (req, res) => {
  try {
    // Fetch all stats concurrently for better performance
    const [dbStats, sessions, docStats] = await Promise.all([
      getDashboardStats(),
      listSessions(),
      getDocumentStats()
    ]);
    
    // Action stats are still in-memory mocks
    const actionStats = getActionStats();

    res.json({
      queries: {
        total: dbStats.totalQueries,
        distribution: dbStats.typeDistribution,
        avgResponseTime: dbStats.avgResponseTime
      },
      actions: {
        distribution: dbStats.actionDistribution,
        totalBookings: actionStats.totalBookings,
        totalLeads: actionStats.totalLeads,
        recentBookings: actionStats.recentBookings,
        recentLeads: actionStats.recentLeads,
      },
      sessions: {
        total: sessions.length,
        live: sessions.filter(s => s.status === 'live_agent').length,
        recent: sessions.slice(0, 10)
      },
      documents: docStats,
      recentQueries: dbStats.recentQueries,
      systemStatus: {
        mongodb: 'Connected',
        weaviate: 'Connected',
        timestamp: new Date().toISOString()
      }
    });

  } catch (err) {
    console.error('[AnalyticsRoute] Error building dashboard:', err.message);
    res.status(500).json({ error: 'Failed to aggregate dashboard data' });
  }
});

export default router;
