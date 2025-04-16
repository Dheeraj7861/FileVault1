const express = require('express');
const router = express.Router();
const { getProjectTimeline, getProjectActivities } = require('../controllers/activity.controller');
const { protect } = require('../middleware/auth');

/**
 * @route GET /api/activities/timeline/:projectId
 * @desc Get timeline for a project
 * @access Private (project viewers, editors, creators)
 */
router.get('/timeline/:projectId', protect, getProjectTimeline);

/**
 * @route GET /api/activities/project/:projectId
 * @desc Get activities for a project
 * @access Private (project viewers, editors, creators)
 */
router.get('/project/:projectId', protect, getProjectActivities);

module.exports = router; 