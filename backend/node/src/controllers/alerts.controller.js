const { pool } = require('../db');

exports.getAlerts = async (req, res) => {
  try {
    const userId = req.user.userId;

    const sql = `
      SELECT 
        am.alert_id,
        am.message,
        am.target_type,
        am.target_id,
        ua.is_read,
        am.created_at
      FROM user_alerts ua
      JOIN alerts_master am
        ON ua.alert_id = am.alert_id
      WHERE ua.user_id = $1
      ORDER BY am.created_at DESC
    `;

    const { rows } = await pool.query(sql, [userId]);
    return res.json(rows);

  } catch (err) {
    console.error('[ALERTS] fetch error:', err);
    res.status(500).json({ error: 'FAILED_TO_FETCH_ALERTS' });
  }
};

exports.markAlertRead = async (req, res) => {
  try {
    const userId = req.user.userId;
    const alertId = Number(req.params.alertId);

    if (!Number.isFinite(alertId)) {
      return res.status(400).json({ error: 'BAD_ALERT_ID' });
    }

    const result = await pool.query(
      `UPDATE user_alerts
       SET is_read = true
       WHERE user_id = $1 AND alert_id = $2`,
      [userId, alertId]
    );

    if (result.rowCount === 0) {
      return res.status(404).json({ error: 'ALERT_NOT_FOUND' });
    }

    return res.json({ ok: true });
  } catch (err) {
    console.error('[ALERTS] read error:', err);
    res.status(500).json({ error: 'FAILED_TO_MARK_READ' });
  }
};
