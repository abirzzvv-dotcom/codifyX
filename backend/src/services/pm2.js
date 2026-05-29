const { exec } = require("child_process");
const path = require("path");
const { promisify } = require("util");
const execAsync = promisify(exec);

async function pm2Start(project) {
  const projectDir = path.resolve(
    process.env.PROJECTS_ROOT || "./data/projects",
    String(project.id)
  );
  const name = `project-${project.id}`;

  let script;
  if (project.type === "python") {
    script = `python ${project.main_file || "main.py"}`;
    const cmd = `cd "${projectDir}" && pm2 start ${script} --name "${name}" --no-autorestart`;
    const { stdout, stderr } = await execAsync(cmd);
    return { stdout, stderr };
  } else {
    const mainFile = project.main_file || "index.js";
    const cmd = `cd "${projectDir}" && pm2 start "${mainFile}" --name "${name}" --no-autorestart`;
    const { stdout, stderr } = await execAsync(cmd);
    return { stdout, stderr };
  }
}

async function pm2Stop(projectId) {
  const name = `project-${projectId}`;
  const { stdout, stderr } = await execAsync(`pm2 stop "${name}"`).catch((e) => ({
    stdout: "",
    stderr: e.message,
  }));
  return { stdout, stderr };
}

async function pm2Restart(projectId) {
  const name = `project-${projectId}`;
  const { stdout, stderr } = await execAsync(`pm2 restart "${name}"`).catch((e) => ({
    stdout: "",
    stderr: e.message,
  }));
  return { stdout, stderr };
}

async function pm2Delete(projectId) {
  const name = `project-${projectId}`;
  const { stdout, stderr } = await execAsync(`pm2 delete "${name}"`).catch(() => ({
    stdout: "",
    stderr: "",
  }));
  return { stdout, stderr };
}

async function pm2Status(projectId) {
  const name = `project-${projectId}`;
  try {
    const { stdout } = await execAsync(`pm2 jlist`);
    const list = JSON.parse(stdout);
    const proc = list.find((p) => p.name === name);
    return proc ? proc.pm2_env.status : "stopped";
  } catch {
    return "stopped";
  }
}

async function pm2Logs(projectId, lines = 50) {
  const name = `project-${projectId}`;
  try {
    const { stdout } = await execAsync(`pm2 logs "${name}" --lines ${lines} --nostream`);
    return stdout;
  } catch (e) {
    return e.message;
  }
}

async function installNpmPackages(projectId, packages) {
  const projectDir = path.resolve(
    process.env.PROJECTS_ROOT || "./data/projects",
    String(projectId)
  );
  const pkgList = packages.join(" ");
  const { stdout, stderr } = await execAsync(`cd "${projectDir}" && npm install ${pkgList}`);
  return { stdout, stderr };
}

async function installPipPackages(projectId, packages) {
  const projectDir = path.resolve(
    process.env.PROJECTS_ROOT || "./data/projects",
    String(projectId)
  );
  const pkgList = packages.join(" ");
  const { stdout, stderr } = await execAsync(`cd "${projectDir}" && pip install ${pkgList}`);
  return { stdout, stderr };
}

module.exports = {
  pm2Start,
  pm2Stop,
  pm2Restart,
  pm2Delete,
  pm2Status,
  pm2Logs,
  installNpmPackages,
  installPipPackages,
};
