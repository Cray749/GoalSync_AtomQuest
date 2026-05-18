// server/src/controllers/reports.controller.js

'use strict';

const ExcelJS = require('exceljs');
const { parse: csvParse } = require('json2csv');
const { query } = require('../config/db');
const cycleService = require('../services/cycle.service');
const scoreService = require('../services/score.service');
const {
  sendSuccess, sendError, sendBadRequest,
} = require('../utils/response');

// ──────────────────────────────────────────────────────────────
// GET /api/reports/achievement
// Planned vs actual for all employees.
// ?format=csv|excel|json  &cycle_id=
// ──────────────────────────────────────────────────────────────
async function achievementReport(req, res) {
  try {
    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;
    if (!cycleId) return sendBadRequest(res, 'No active cycle — pass ?cycle_id=');

    const { format = 'json', department } = req.query;

    const conditions = ['g.cycle_id = $1'];
    const params = [cycleId];
    let idx = 2;

    if (department) {
      conditions.push(`u.department = $${idx++}`);
      params.push(department);
    }

    const { rows } = await query(`
      SELECT
        u.name         AS employee_name,
        u.email        AS employee_email,
        u.department,
        m.name         AS manager_name,
        ta.name        AS thrust_area,
        g.title        AS goal_title,
        g.uom_type,
        g.target_value AS planned_value,
        g.target_date,
        g.weightage,
        g.status       AS goal_status,
        ga.quarter,
        ga.actual_value,
        ga.completion_date,
        ga.goal_status AS quarter_status,
        ga.submitted_at
      FROM goals g
      JOIN users u             ON u.id  = g.employee_id
      LEFT JOIN users m        ON m.id  = u.manager_id
      LEFT JOIN thrust_areas ta ON ta.id = g.thrust_area_id
      LEFT JOIN goal_achievements ga ON ga.goal_id = g.id
      WHERE ${conditions.join(' AND ')}
      ORDER BY u.department, u.name, g.created_at, ga.quarter
    `, params);

    // Enrich with score
    const enriched = rows.map(r => {
      const ratio = scoreService.calculateScore(
        r.uom_type, r.planned_value, r.actual_value,
        r.target_date, r.completion_date
      );
      return {
        ...r,
        score_pct: scoreService.scoreToDisplay(ratio),
      };
    });

    if (format === 'json') {
      return sendSuccess(res, enriched, 'Achievement report');
    }

    if (format === 'csv') {
      return _sendCsv(res, enriched, 'achievement_report');
    }

    if (format === 'excel') {
      return _sendExcel(res, enriched, 'Achievement Report', 'achievement_report');
    }

    return sendBadRequest(res, 'format must be json, csv, or excel');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/reports/completion-rate
// Check-in completion % per manager.
// ──────────────────────────────────────────────────────────────
async function completionRate(req, res) {
  try {
    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;
    if (!cycleId) return sendBadRequest(res, 'No active cycle');

    const { rows } = await query(`
      SELECT
        m.id           AS manager_id,
        m.name         AS manager_name,
        m.department,
        COUNT(DISTINCT u.id)                        AS team_size,
        COUNT(DISTINCT ga.goal_id)                  AS actuals_submitted,
        COUNT(DISTINCT CASE WHEN g.status = 'approved' THEN g.id END) AS approved_goals,
        COUNT(DISTINCT mc.id)                       AS checkins_done,
        ROUND(
          CASE WHEN COUNT(DISTINCT CASE WHEN g.status = 'approved' THEN g.id END) > 0
            THEN COUNT(DISTINCT mc.id)::numeric /
                 NULLIF(COUNT(DISTINCT CASE WHEN g.status = 'approved' THEN g.id END) * 4, 0) * 100
            ELSE 0
          END, 1
        ) AS checkin_completion_pct
      FROM users m
      JOIN users u           ON u.manager_id = m.id AND u.is_active = TRUE
      LEFT JOIN goals g      ON g.employee_id = u.id AND g.cycle_id = $1
      LEFT JOIN goal_achievements ga ON ga.goal_id = g.id
      LEFT JOIN manager_checkins  mc ON mc.goal_id = g.id AND mc.manager_id = m.id
      WHERE m.role IN ('manager','admin') AND m.is_active = TRUE
      GROUP BY m.id, m.name, m.department
      ORDER BY checkin_completion_pct DESC
    `, [cycleId]);

    return sendSuccess(res, rows, 'Completion rate report');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/reports/goal-distribution
// Goals by thrust area, UoM type, and status.
// ──────────────────────────────────────────────────────────────
async function goalDistribution(req, res) {
  try {
    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;
    if (!cycleId) return sendBadRequest(res, 'No active cycle');

    const [thrustRows, uomRows, statusRows, qtrRows] = await Promise.all([
      // By thrust area
      query(`
        SELECT ta.name AS label, COUNT(g.id) AS count
        FROM goals g
        LEFT JOIN thrust_areas ta ON ta.id = g.thrust_area_id
        WHERE g.cycle_id = $1
        GROUP BY ta.name ORDER BY count DESC
      `, [cycleId]),

      // By UoM type
      query(`
        SELECT uom_type AS label, COUNT(*) AS count
        FROM goals WHERE cycle_id = $1
        GROUP BY uom_type ORDER BY count DESC
      `, [cycleId]),

      // By status
      query(`
        SELECT status AS label, COUNT(*) AS count
        FROM goals WHERE cycle_id = $1
        GROUP BY status ORDER BY count DESC
      `, [cycleId]),

      // QoQ average score trend
      query(`
        SELECT
          ga.quarter,
          ROUND(AVG(
            CASE
              WHEN g.uom_type = 'min' AND g.target_value > 0
                THEN LEAST(ga.actual_value / g.target_value * 100, 150)
              WHEN g.uom_type = 'max' AND ga.actual_value > 0
                THEN LEAST(g.target_value / ga.actual_value * 100, 150)
              WHEN g.uom_type = 'zero'
                THEN CASE WHEN ga.actual_value = 0 THEN 100 ELSE 0 END
              ELSE 0
            END
          ), 1) AS avg_score_pct,
          COUNT(DISTINCT g.employee_id) AS employees_reported
        FROM goal_achievements ga
        JOIN goals g ON g.id = ga.goal_id AND g.cycle_id = $1
        WHERE ga.actual_value IS NOT NULL
        GROUP BY ga.quarter ORDER BY ga.quarter
      `, [cycleId]),
    ]);

    return sendSuccess(res, {
      by_thrust_area: thrustRows.rows,
      by_uom_type: uomRows.rows,
      by_status: statusRows.rows,
      qoq_trend: qtrRows.rows,
    }, 'Goal distribution report');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/reports/team-scores
// Per-employee overall weighted score for a manager's team.
// Used by TeamProgressChart.
// ──────────────────────────────────────────────────────────────
async function teamScores(req, res) {
  try {
    const managerId = req.query.manager_id || req.user.id;
    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;
    const quarter = req.query.quarter;

    if (!cycleId) return sendBadRequest(res, 'No active cycle');

    const { rows } = await query(`
      SELECT
        u.id AS employee_id,
        u.name AS employee_name,
        g.id, g.uom_type, g.target_value, g.target_date, g.weightage,
        ga.actual_value, ga.completion_date, ga.quarter
      FROM users u
      JOIN goals g ON g.employee_id = u.id AND g.cycle_id = $1 AND g.status = 'approved'
      LEFT JOIN goal_achievements ga
        ON ga.goal_id = g.id AND ($3::varchar IS NULL OR ga.quarter = $3)
      WHERE u.manager_id = $2 AND u.is_active = TRUE
    `, [cycleId, managerId, quarter || null]);

    // Group by employee and compute weighted score
    const empMap = {};
    for (const r of rows) {
      if (!empMap[r.employee_id]) {
        empMap[r.employee_id] = { employee_id: r.employee_id, name: r.employee_name, goals: [] };
      }
      empMap[r.employee_id].goals.push(r);
    }

    const result = Object.values(empMap).map(emp => {
      const score = scoreService.calculateOverallScore(emp.goals);
      return {
        employee_id: emp.employee_id,
        name: emp.name,
        overall_score: scoreService.scoreToDisplay(score),
        score_pct: Math.min(score * 100, 150),
      };
    });

    return sendSuccess(res, result, 'Team scores fetched');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
}

// ──────────────────────────────────────────────────────────────
// GET /api/reports/manager-effectiveness
// Per-manager approval & check-in effectiveness metrics.
// ──────────────────────────────────────────────────────────────
async function managerEffectiveness(req, res) {
  try {
    const cycleId = req.query.cycle_id || (await cycleService.getActiveCycle())?.id;
    if (!cycleId) return sendBadRequest(res, 'No active cycle');

    const { rows } = await query(`
      SELECT
        m.id           AS manager_id,
        m.name         AS manager_name,
        m.department,
        COUNT(DISTINCT u.id)                                           AS team_size,
        COUNT(DISTINCT CASE WHEN g.status IN ('approved','submitted','rework') THEN g.id END) AS total_submitted,
        COUNT(DISTINCT CASE WHEN g.status = 'approved' THEN g.id END) AS total_approved,
        ROUND(
          CASE WHEN COUNT(DISTINCT CASE WHEN g.status IN ('approved','submitted','rework') THEN g.id END) > 0
            THEN COUNT(DISTINCT CASE WHEN g.status = 'approved' THEN g.id END)::numeric /
                 NULLIF(COUNT(DISTINCT CASE WHEN g.status IN ('approved','submitted','rework') THEN g.id END), 0) * 100
            ELSE 0
          END, 1
        ) AS approval_rate_pct,
        ROUND(
          AVG(
            CASE WHEN g.status = 'approved'
              THEN EXTRACT(EPOCH FROM (g.updated_at - g.created_at)) / 86400.0
              ELSE NULL
            END
          ), 1
        ) AS avg_days_to_approve,
        COUNT(DISTINCT mc.id)                                          AS total_checkins,
        COUNT(DISTINCT CASE WHEN g.status = 'approved' THEN g.id END) AS approved_goals_cnt,
        ROUND(
          CASE WHEN COUNT(DISTINCT CASE WHEN g.status = 'approved' THEN g.id END) > 0
            THEN COUNT(DISTINCT mc.id)::numeric /
                 NULLIF(COUNT(DISTINCT CASE WHEN g.status = 'approved' THEN g.id END) * 4, 0) * 100
            ELSE 0
          END, 1
        ) AS checkin_coverage_pct
      FROM users m
      JOIN users u           ON u.manager_id = m.id AND u.is_active = TRUE
      LEFT JOIN goals g      ON g.employee_id = u.id AND g.cycle_id = $1
      LEFT JOIN manager_checkins mc ON mc.goal_id = g.id AND mc.manager_id = m.id
      WHERE m.role IN ('manager','admin') AND m.is_active = TRUE
      GROUP BY m.id, m.name, m.department
      ORDER BY approval_rate_pct DESC, m.name
    `, [cycleId]);

    return sendSuccess(res, rows, 'Manager effectiveness report');
  } catch (err) {
    return sendError(res, err.message, 500);
  }
}

// ──────────────────────────────────────────────────────────────
// Private — CSV export
// ──────────────────────────────────────────────────────────────
function _sendCsv(res, data, filename) {
  try {
    const csv = csvParse(data);
    res.setHeader('Content-Type', 'text/csv');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}_${_datestamp()}.csv"`);
    return res.send(csv);
  } catch (err) {
    return sendError(res, 'CSV generation failed: ' + err.message, 500);
  }
}

// ──────────────────────────────────────────────────────────────
// Private — Excel export
// ──────────────────────────────────────────────────────────────
async function _sendExcel(res, data, sheetTitle, filename) {
  try {
    const workbook = new ExcelJS.Workbook();
    workbook.creator = 'Nucleas';
    workbook.created = new Date();

    const sheet = workbook.addWorksheet(sheetTitle);

    if (data.length === 0) {
      sheet.addRow(['No data available']);
    } else {
      // Header row
      const headers = Object.keys(data[0]);
      const headerRow = sheet.addRow(
        headers.map(h => h.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase()))
      );
      headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
      headerRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF1E40AF' } };
      headerRow.alignment = { horizontal: 'center' };

      // Freeze header row
      sheet.views = [{ state: 'frozen', ySplit: 1 }];

      // Auto-width columns
      headers.forEach((h, i) => {
        sheet.getColumn(i + 1).width = Math.max(h.length + 4, 14);
      });

      // Data rows with alternating fill
      data.forEach((row, rowIdx) => {
        const dataRow = sheet.addRow(Object.values(row));
        if (rowIdx % 2 === 1) {
          dataRow.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFF0F4FF' } };
        }
        // Highlight score_pct cells
        const scorePctIdx = headers.indexOf('score_pct');
        if (scorePctIdx >= 0) {
          const cell = dataRow.getCell(scorePctIdx + 1);
          const val = Number(cell.value);
          if (val >= 100) cell.font = { color: { argb: 'FF16A34A' }, bold: true };
          else if (val >= 70) cell.font = { color: { argb: 'FFD97706' } };
          else cell.font = { color: { argb: 'FFDC2626' } };
        }
      });

      // Border all cells
      sheet.eachRow((row) => {
        row.eachCell((cell) => {
          cell.border = {
            top: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            left: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            bottom: { style: 'thin', color: { argb: 'FFE2E8F0' } },
            right: { style: 'thin', color: { argb: 'FFE2E8F0' } },
          };
        });
      });
    }

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}_${_datestamp()}.xlsx"`);
    await workbook.xlsx.write(res);
    res.end();
  } catch (err) {
    return sendError(res, 'Excel generation failed: ' + err.message, 500);
  }
}

function _datestamp() {
  return new Date().toISOString().slice(0, 10);
}

module.exports = {
  achievementReport,
  completionRate,
  goalDistribution,
  teamScores,
  managerEffectiveness,
};
