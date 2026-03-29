import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });

const regressionResults = await page.evaluate(async () => {
  const mod = await import('/src/store/useProjectStore.ts');
  const storage = await import('/src/utils/fileStorage.ts');

  const originalStorage = {
    listProjects: storage.listProjects,
    saveProjectToFile: storage.saveProjectToFile,
    loadProjectFromFile: storage.loadProjectFromFile,
    deleteProjectFile: storage.deleteProjectFile,
  };

  const memoryProjects = new Map();
  storage.listProjects = async () => Array.from(memoryProjects.values()).map((project) => ({
    id: project.id,
    name: project.name,
    fileName: `${project.name}.json`,
    lastModified: project.lastModified,
  }));
  storage.saveProjectToFile = async (state) => {
    const now = new Date().toISOString();
    memoryProjects.set(state.projectId, {
      id: state.projectId,
      name: state.projectName,
      lastModified: now,
      data: structuredClone(state),
    });
    return now;
  };
  storage.loadProjectFromFile = async (id) => memoryProjects.get(id)?.data ?? null;
  storage.deleteProjectFile = async (id) => {
    memoryProjects.delete(id);
  };

  const dependencyTypes = [
    'finish-to-start',
    'start-to-start',
    'finish-to-finish',
    'start-to-finish',
  ];

  const connectionPoints = ['auto', 'side', 'top', 'bottom'];

  const parsePath = (d) => {
    const nums = d.match(/-?\d+(?:\.\d+)?/g)?.map(Number) ?? [];
    const pts = [];
    for (let i = 0; i < nums.length; i += 2) pts.push([nums[i], nums[i + 1]]);
    return pts;
  };

  const countBends = (pts) => {
    let bends = 0;
    for (let i = 1; i < pts.length - 1; i += 1) {
      const [ax, ay] = pts[i - 1];
      const [bx, by] = pts[i];
      const [cx, cy] = pts[i + 1];
      const ab = ax === bx ? 'V' : 'H';
      const bc = bx === cx ? 'V' : 'H';
      if (ab !== bc) bends += 1;
    }
    return bends;
  };

  const runCase = ({ depType, fromPoint, toPoint }) => {
    mod.useProjectStore.getState().newProject();

    const add = (partial) => mod.useProjectStore.getState().addItem(partial);
    const addDep = (fromId, toId) => mod.useProjectStore.getState().addDependency(fromId, toId, {
      type: depType,
      fromPoint,
      toPoint,
      forceSchedule: true,
    });

    const ids = [];
    ids.push(add({ name: 'T1', type: 'task', startDate: '2026-03-29', endDate: '2026-04-05', row: 0 }));
    ids.push(add({ name: 'T2', type: 'task', startDate: '2026-04-06', endDate: '2026-04-13', row: 1 }));
    ids.push(add({ name: 'T3', type: 'task', startDate: '2026-04-14', endDate: '2026-04-21', row: 2 }));
    ids.push(add({ name: 'T4', type: 'task', startDate: '2026-04-22', endDate: '2026-04-29', row: 3 }));

    const swimlaneId = crypto.randomUUID();
    mod.useProjectStore.setState((s) => ({
      ...s,
      swimlanes: [{
        id: swimlaneId,
        name: 'S1',
        order: 0,
        headerBackgroundColor: '#334155',
        bodyBackgroundColor: '#f8fafc',
        headerTransparency: 0,
        bodyTransparency: 0,
        outlineColor: '#cbd5e1',
        outlineThickness: 'thin',
        fontSize: 16,
        fontColor: '#ffffff',
        fontFamily: 'Inter',
        fontWeight: 700,
        fontStyle: 'normal',
        textDecoration: 'none',
        textAlign: 'center',
      }],
    }));

    ids.push(add({ name: 'T5', type: 'task', startDate: '2026-04-30', endDate: '2026-05-07', row: 0, swimlaneId }));
    ids.push(add({ name: 'T6', type: 'task', startDate: '2026-05-08', endDate: '2026-05-15', row: 1, swimlaneId }));
    ids.push(add({ name: 'T7', type: 'task', startDate: '2026-05-16', endDate: '2026-05-23', row: 2, swimlaneId }));

    for (let i = 0; i < ids.length - 1; i += 1) addDep(ids[i], ids[i + 1]);

    mod.useProjectStore.setState((s) => ({
      ...s,
      activeView: 'timeline',
      showDependencies: true,
      zoom: 36,
    }));

    const pathEls = Array.from(document.querySelectorAll('svg path'));
    const depPaths = pathEls
      .map((el) => el.getAttribute('d'))
      .filter((d) => typeof d === 'string' && d.startsWith('M '));

    const metrics = depPaths.slice(1).map((d) => {
      const pts = parsePath(d);
      const ys = pts.map((p) => p[1]);
      const xs = pts.map((p) => p[0]);
      return {
        d,
        bends: countBends(pts),
        minY: Math.min(...ys),
        maxY: Math.max(...ys),
        width: Math.max(...xs) - Math.min(...xs),
        points: pts.length,
      };
    });

    return {
      depType,
      fromPoint,
      toPoint,
      depCount: metrics.length,
      invalid: metrics.some((m) => !Number.isFinite(m.minY) || !Number.isFinite(m.width)),
      negativeY: metrics.some((m) => m.minY < 0),
      oversizedWidth: metrics.some((m) => m.width > 120),
      excessiveBends: metrics.some((m) => m.bends > 4),
      sample: metrics.slice(0, 2),
    };
  };

  const routingResults = [];
  for (const depType of dependencyTypes) {
    for (const fromPoint of connectionPoints) {
      for (const toPoint of connectionPoints) {
        routingResults.push(runCase({ depType, fromPoint, toPoint }));
      }
    }
  }

  mod.useProjectStore.getState().newProject();
  const add = (partial) => mod.useProjectStore.getState().addItem(partial);
  mod.useProjectStore.setState((s) => ({
    ...s,
    dependencySettings: {
      ...s.dependencySettings,
      schedulingMode: 'automatic-strict',
    },
  }));

  const a = add({ name: 'A', type: 'task', startDate: '2026-03-29', endDate: '2026-04-05', row: 0 });
  const b = add({ name: 'B', type: 'task', startDate: '2026-04-06', endDate: '2026-04-13', row: 1 });
  mod.useProjectStore.getState().addDependency(a, b, { type: 'finish-to-start', forceSchedule: true });
  mod.useProjectStore.getState().moveItem(a, 2);
  const schedulingState = mod.useProjectStore.getState();
  const movedB = schedulingState.items.find((item) => item.id === b);

  mod.useProjectStore.getState().updateDependency(a, b, {
    fromPoint: 'top',
    toPoint: 'bottom',
    lineWidth: 3,
    arrowSize: 8,
    arrowType: 'diamond',
  });
  const updatedDep = mod.useProjectStore.getState().dependencies.find((dep) => dep.fromId === a && dep.toId === b);
  mod.useProjectStore.getState().removeDependency(a, b);
  const removedDepCount = mod.useProjectStore.getState().dependencies.length;

  mod.useProjectStore.getState().newProject();
  const saveTask = add({ name: 'Saved Task', type: 'task', startDate: '2026-03-29', endDate: '2026-04-05', row: 0 });
  void saveTask;
  mod.useProjectStore.getState().setProjectName('Regression Save Test');
  await mod.useProjectStore.getState().saveProject();
  const savedId = mod.useProjectStore.getState().projectId;
  const listedAfterSave = await storage.listProjects();
  await mod.useProjectStore.getState().loadProject(savedId);
  const loadedState = mod.useProjectStore.getState();
  await storage.deleteProjectFile(savedId);
  const listedAfterDelete = await storage.listProjects();

  storage.listProjects = originalStorage.listProjects;
  storage.saveProjectToFile = originalStorage.saveProjectToFile;
  storage.loadProjectFromFile = originalStorage.loadProjectFromFile;
  storage.deleteProjectFile = originalStorage.deleteProjectFile;

  return {
    routingResults,
    scheduling: {
      successorMoved: movedB?.startDate === '2026-04-08',
      successorStartDate: movedB?.startDate ?? null,
    },
    dependencyOps: {
      updated: Boolean(updatedDep && updatedDep.fromPoint === 'top' && updatedDep.toPoint === 'bottom' && updatedDep.lineWidth === 3 && updatedDep.arrowSize === 8 && updatedDep.arrowType === 'diamond'),
      removed: removedDepCount === 0,
    },
    persistence: {
      saved: listedAfterSave.some((project) => project.id === savedId),
      loadedName: loadedState.projectName,
      loadedItemCount: loadedState.items.length,
      deleted: !listedAfterDelete.some((project) => project.id === savedId),
    },
  };
});

const routingFailures = regressionResults.routingResults.filter((r) => r.invalid || r.negativeY || r.oversizedWidth || r.excessiveBends);
const schedulingFailures = regressionResults.scheduling.successorMoved ? [] : [regressionResults.scheduling];
const dependencyFailures = regressionResults.dependencyOps.updated && regressionResults.dependencyOps.removed ? [] : [regressionResults.dependencyOps];
const persistenceFailures = (
  regressionResults.persistence.saved &&
  regressionResults.persistence.loadedName === 'Regression Save Test' &&
  regressionResults.persistence.loadedItemCount === 1 &&
  regressionResults.persistence.deleted
) ? [] : [regressionResults.persistence];

const totalFailures = routingFailures.length + schedulingFailures.length + dependencyFailures.length + persistenceFailures.length;

console.log(JSON.stringify({
  routing: {
    total: regressionResults.routingResults.length,
    failures: routingFailures.length,
    failingCases: routingFailures,
  },
  scheduling: {
    failures: schedulingFailures.length,
    details: schedulingFailures,
  },
  dependencyOps: {
    failures: dependencyFailures.length,
    details: dependencyFailures,
  },
  persistence: {
    failures: persistenceFailures.length,
    details: persistenceFailures,
  },
  failures: totalFailures,
}, null, 2));

await browser.close();

if (totalFailures > 0) {
  process.exitCode = 1;
}
