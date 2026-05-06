import { Analytics } from '../models/index.js';

export async function recordQuery(type, subtype, responseTime, success = true) {
  try {
    await Analytics.create({
      type,
      subtype,
      responseTime,
      success,
      timestamp: new Date()
    });
  } catch (err) {
    console.error('[Analytics] Failed to record:', err.message);
  }
}

export async function getDashboardStats() {
  const now = new Date();
  const dayAgo = new Date(now.getTime() - 24 * 60 * 60 * 1000);

  const totalQueries = await Analytics.countDocuments();
  const recentQueries = await Analytics.find().sort({ timestamp: -1 }).limit(50);
  
  // Aggregate findings
  const distribution = await Analytics.aggregate([
    { $group: { _id: '$type', count: { $sum: 1 } } }
  ]);

  const actions = await Analytics.aggregate([
    { $match: { type: 'action' } },
    { $group: { _id: '$subtype', count: { $sum: 1 } } }
  ]);

  const avgResponseTime = await Analytics.aggregate([
    { $group: { _id: null, avg: { $avg: '$responseTime' } } }
  ]);

  return {
    totalQueries,
    avgResponseTime: Math.round(avgResponseTime[0]?.avg || 0),
    typeDistribution: distribution.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
    actionDistribution: actions.reduce((acc, curr) => ({ ...acc, [curr._id]: curr.count }), {}),
    recentQueries: recentQueries.map(q => ({
      type: q.type,
      subtype: q.subtype,
      responseTime: q.responseTime,
      success: q.success,
      timestamp: q.timestamp
    }))
  };
}
