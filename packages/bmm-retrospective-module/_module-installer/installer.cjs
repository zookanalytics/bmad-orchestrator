const fs = require('node:fs');
const path = require('node:path');

/**
 * BMM Retrospective Module Installer
 *
 * Copies workflow files into the target project's _bmad/retro/workflows/ directory.
 *
 * @param {Object} options - Installation options
 * @param {string} options.projectRoot - The root directory of the target project
 * @param {Object} options.config - Module configuration from module.yaml (resolved variables)
 * @param {Array<string>} options.installedIDEs - Array of IDE codes that were installed
 * @param {Object} options.logger - Logger instance for output
 * @returns {Promise<boolean>} - Success status
 */
async function install(options) {
  const { projectRoot, config, logger } = options;

  try {
    logger.log('Installing Retro Followup module...');

    // Create output directory if configured
    if (config['output_folder']) {
      const outputConfig = config['output_folder'].replace('{project-root}/', '');
      const outputPath = path.join(projectRoot, outputConfig);
      if (!fs.existsSync(outputPath)) {
        logger.log(`Creating output directory: ${outputConfig}`);
        fs.mkdirSync(outputPath, { recursive: true });
      }
    }

    // Copy workflows into _bmad/retro/workflows/
    const srcWorkflows = path.join(__dirname, '..', 'src', 'workflows');
    const destWorkflows = path.join(projectRoot, '_bmad', 'retro', 'workflows');

    fs.mkdirSync(destWorkflows, { recursive: true });
    copyDirSync(srcWorkflows, destWorkflows);

    logger.log('✓ Retro Followup module installation complete');
    return true;
  } catch (error) {
    logger.error(`Error installing Retro Followup module: ${error.message}`);
    return false;
  }
}

/**
 * Recursively copy a directory's contents.
 */
function copyDirSync(src, dest) {
  const entries = fs.readdirSync(src, { withFileTypes: true });
  for (const entry of entries) {
    const srcPath = path.join(src, entry.name);
    const destPath = path.join(dest, entry.name);
    if (entry.isDirectory()) {
      fs.mkdirSync(destPath, { recursive: true });
      copyDirSync(srcPath, destPath);
    } else {
      fs.copyFileSync(srcPath, destPath);
    }
  }
}

module.exports = { install };
