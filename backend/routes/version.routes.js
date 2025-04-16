const express = require('express');
const router = express.Router();
const {
  getVersions,
  getUploadUrl,
  createVersion,
  getVersion,
  updateVersionStatus,
  deleteVersion,
  uploadFile,
  revertToVersion
} = require('../controllers/version.controller');
const { protect, checkProjectAccess } = require('../middleware/auth');

// All routes are protected
router.use(protect);

// Version routes under projects
router.route('/:projectId/versions')
  .get(checkProjectAccess('view'), getVersions)
  .post(checkProjectAccess('edit'), createVersion);

router.route('/:projectId/versions/upload-url')
  .get(checkProjectAccess('edit'), getUploadUrl);

router.route('/:projectId/versions/upload-file')
  .post(checkProjectAccess('edit'), uploadFile);

router.route('/:projectId/versions/:versionId')
  .get(checkProjectAccess('view'), getVersion)
  .delete(checkProjectAccess('admin'), deleteVersion);

router.route('/:projectId/versions/:versionId/status')
  .put(checkProjectAccess('admin'), updateVersionStatus);

// New route for reverting to a specific version
router.route('/:projectId/versions/:versionId/revert')
  .post(checkProjectAccess('admin'), revertToVersion);

module.exports = router; 