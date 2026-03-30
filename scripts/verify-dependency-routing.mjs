import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

await page.goto('http://127.0.0.1:4173', { waitUntil: 'networkidle' });

const uiEscapeResults = await page.evaluate(async () => {
  const store = window.__PROJECT_STORE__;
  if (!store) {
    return { available: false };
  }

  store.getState().newProject();
  const add = (partial) => store.getState().addItem(partial);
  const a = add({ name: 'T1', type: 'task', startDate: '2026-03-29', endDate: '2026-04-05', row: 0 });
  const b = add({ name: 'T2', type: 'task', startDate: '2026-04-06', endDate: '2026-04-13', row: 1 });
  store.getState().addDependency(a, b, { type: 'finish-to-start', forceSchedule: true });
  store.setState((s) => ({
    ...s,
    activeView: 'timeline',
    showDependencies: true,
    items: s.items.map((item) => item.id === a ? { ...item, taskStyle: { ...item.taskStyle, showDate: true } } : item),
  }));

  await new Promise((resolve) => setTimeout(resolve, 200));

  const beforeDates = store.getState().items.map((item) => ({ id: item.id, startDate: item.startDate, endDate: item.endDate }));

  return {
    available: true,
    beforeDates,
    dependencyCount: store.getState().dependencies.length,
  };
});

if (!uiEscapeResults.available) {
  console.log(JSON.stringify({ failures: 1, reason: 'Mounted app store unavailable for UI regression checks' }, null, 2));
  await browser.close();
  process.exit(1);
}

const t1Label = page.locator('text=T1').first();
const t1Box = await t1Label.boundingBox();
if (!t1Box) {
  console.log(JSON.stringify({ failures: 1, reason: 'Could not locate T1 for Escape regression check' }, null, 2));
  await browser.close();
  process.exit(1);
}

await page.mouse.move(t1Box.x - 40, t1Box.y + 10);
await page.mouse.down();
await page.mouse.move(t1Box.x + 32, t1Box.y + 10, { steps: 8 });
await page.keyboard.press('Escape');
await page.mouse.up();
await page.waitForTimeout(200);

const afterDragEscape = await page.evaluate(() => {
  const store = window.__PROJECT_STORE__;
  const state = store.getState();
  return state.items.map((item) => ({ id: item.id, startDate: item.startDate, endDate: item.endDate }));
});

await page.locator('[data-testid^="dependency-hit-"]').first().click();
await page.waitForTimeout(100);
await page.keyboard.press('Escape');
await page.waitForTimeout(100);

const afterDepDeselectEscape = await page.evaluate(() => {
  const store = window.__PROJECT_STORE__;
  return store.getState().selectedDepKey;
});

await page.locator('[data-testid^="dependency-hit-"]').first().click();
await page.waitForTimeout(100);

await t1Label.click();
await page.waitForTimeout(100);

const depHandle = page.locator('[data-testid^="dep-handle-end-"]').first();
const depHandleBox = await depHandle.boundingBox();
if (!depHandleBox) {
  console.log(JSON.stringify({ failures: 1, reason: 'Could not locate dependency handle for Escape regression check' }, null, 2));
  await browser.close();
  process.exit(1);
}

await page.mouse.move(depHandleBox.x + depHandleBox.width / 2, depHandleBox.y + depHandleBox.height / 2);
await page.mouse.down();
await page.mouse.move(depHandleBox.x + 120, depHandleBox.y + 40, { steps: 8 });
await page.keyboard.press('Escape');
await page.mouse.up();
await page.waitForTimeout(200);

const afterDepDragEscape = await page.evaluate(() => {
  const store = window.__PROJECT_STORE__;
  const state = store.getState();
  return {
    dependencyCount: state.dependencies.length,
    selectedDepKey: state.selectedDepKey,
  };
});

const dateLabel = page.locator('[data-testid^="task-date-label-"]').first();
await dateLabel.dblclick();
await page.waitForTimeout(200);
await page.keyboard.press('Escape');
await page.waitForTimeout(100);

const afterDatePickerEscape = await page.evaluate(() => {
  const store = window.__PROJECT_STORE__;
  return store.getState().items.map((item) => ({ id: item.id, startDate: item.startDate, endDate: item.endDate }));
});

const titleAlignmentResults = await page.evaluate(async () => {
  const store = window.__PROJECT_STORE__;
  if (!store) {
    return { available: false };
  }

  store.getState().newProject();
  const taskId = store.getState().addItem({
    name: 'Aligned Title',
    type: 'task',
    startDate: '2026-03-29',
    endDate: '2026-04-05',
    row: 0,
  });

  store.setState((s) => ({
    ...s,
    activeView: 'timeline',
    items: s.items.map((item) => item.id === taskId
      ? {
          ...item,
          taskStyle: {
            ...item.taskStyle,
            showTitle: true,
            labelPosition: 'above',
            textAlign: 'center',
          },
        }
      : item),
  }));

  await new Promise((resolve) => setTimeout(resolve, 200));
  return { available: true, taskId };
});

if (!titleAlignmentResults.available) {
  console.log(JSON.stringify({ failures: 1, reason: 'Mounted app store unavailable for title alignment regression checks' }, null, 2));
  await browser.close();
  process.exit(1);
}

const titleAlignmentMeasurements = await page.evaluate(async ({ taskId }) => {
  const measure = () => {
    const label = document.querySelector(`[data-testid="task-title-label-${taskId}"]`);
    const text = label?.querySelector('span');
    if (!(label instanceof HTMLElement) || !(text instanceof HTMLElement)) {
      return null;
    }

    const labelRect = label.getBoundingClientRect();
    const textRect = text.getBoundingClientRect();
    const labelCenter = labelRect.left + (labelRect.width / 2);
    const textCenter = textRect.left + (textRect.width / 2);

    return {
      textAlign: window.getComputedStyle(label).textAlign,
      labelWidth: labelRect.width,
      centerOffset: Math.abs(labelCenter - textCenter),
    };
  };

  const store = window.__PROJECT_STORE__;
  const above = measure();

  store.setState((s) => ({
    ...s,
    items: s.items.map((item) => item.id === taskId
      ? {
          ...item,
          taskStyle: {
            ...item.taskStyle,
            labelPosition: 'below',
            textAlign: 'center',
          },
        }
      : item),
  }));

  await new Promise((resolve) => setTimeout(resolve, 100));
  const below = measure();

  return { above, below };
}, { taskId: titleAlignmentResults.taskId });

const exportResults = await page.evaluate(async () => {
  const store = window.__PROJECT_STORE__;
  if (!store || !window.__EXPORT_TEST_API__) {
    return { available: false };
  }

  const waitForRender = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  store.getState().newProject();
  store.getState().setProjectName('Regression Export Test');
  store.getState().addItem({ name: 'Export Task', type: 'task', startDate: '2026-03-29', endDate: '2026-04-05', row: 0 });
  store.getState().setActiveView('data');
  window.__LAST_PPTX_EXPORT__ = undefined;
  await waitForRender();

  const originalCreateElement = document.createElement.bind(document);
  const originalAnchorClick = HTMLAnchorElement.prototype.click;

  let pngDownload = null;

  document.createElement = ((tagName, options) => {
    const element = originalCreateElement(tagName, options);
    if (String(tagName).toLowerCase() === 'a') {
      element.click = () => {
        if (typeof element.href === 'string' && element.href.startsWith('data:image/png')) {
          pngDownload = {
            download: element.download,
            hrefPrefix: element.href.slice(0, 22),
          };
        }
      };
    }
    return element;
  });

  try {
    await window.__EXPORT_TEST_API__.exportPNG();
    const afterPngView = store.getState().activeView;
    await waitForRender();
    await window.__EXPORT_TEST_API__.exportPPTX();
    return {
      available: true,
      pngDownload,
      afterPngView,
      pptxWrite: window.__LAST_PPTX_EXPORT__ ?? null,
    };
  } finally {
    document.createElement = originalCreateElement;
    HTMLAnchorElement.prototype.click = originalAnchorClick;
  }
});

const regressionResults = await page.evaluate(async () => {
  const storage = await import('/src/utils/fileStorage.ts');
  const store = window.__PROJECT_STORE__;
  if (!store) {
    throw new Error('Mounted app store unavailable for regression checks');
  }

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

  const manualConnectionPoints = ['side', 'top', 'bottom'];

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

  const waitForTimelineRender = () => new Promise((resolve) => {
    requestAnimationFrame(() => requestAnimationFrame(resolve));
  });

  const getDependencyPaths = () => Array.from(document.querySelectorAll('[data-testid^="dependency-hit-"]'))
    .map((el) => el.getAttribute('d'))
    .filter((d) => typeof d === 'string' && d.startsWith('M '));

  const waitForDependencyPaths = async () => {
    for (let attempt = 0; attempt < 10; attempt += 1) {
      await waitForTimelineRender();
      const depPaths = getDependencyPaths();
      if (depPaths.length > 0) return depPaths;
      await new Promise((resolve) => setTimeout(resolve, 25));
    }
    return [];
  };

  const runCase = async ({ depType, fromPoint, toPoint, dependencyStyle = {} }) => {
    store.getState().newProject();

    const add = (partial) => store.getState().addItem(partial);
    const addDep = (fromId, toId) => store.getState().addDependency(fromId, toId, {
      type: depType,
      fromPoint,
      toPoint,
      forceSchedule: true,
      ...dependencyStyle,
    });

    const sourceId = add({ name: 'T1', type: 'task', startDate: '2026-03-29', endDate: '2026-04-05', row: 1 });
    const targetId = add({ name: 'T2', type: 'task', startDate: '2026-04-10', endDate: '2026-04-17', row: 2 });

    addDep(sourceId, targetId);

    store.setState((s) => ({
      ...s,
      activeView: 'timeline',
      showDependencies: true,
    }));

    const depPaths = await waitForDependencyPaths();

    const metrics = depPaths.map((d) => {
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
      pathCount: depPaths.length,
      depCount: metrics.length,
      invalid: metrics.some((m) => !Number.isFinite(m.minY) || !Number.isFinite(m.width)),
      negativeY: metrics.some((m) => m.minY < 0),
      oversizedWidth: metrics.some((m) => m.width > 2000),
      excessiveBends: metrics.some((m) => m.bends > 4),
      sample: metrics.slice(0, 2),
    };
  };

  const routingResults = [];
  for (const depType of dependencyTypes) {
    routingResults.push(await runCase({ depType, fromPoint: 'auto', toPoint: 'auto' }));
    for (const fromPoint of manualConnectionPoints) {
      for (const toPoint of manualConnectionPoints) {
        routingResults.push(await runCase({ depType, fromPoint, toPoint }));
      }
    }
  }

  const styleVariantCases = [
    { lineWidth: 1.5, arrowSize: 4, arrowType: 'standard', fromPoint: 'auto', toPoint: 'auto' },
    { lineWidth: 3, arrowSize: 8, arrowType: 'diamond', fromPoint: 'side', toPoint: 'side' },
    { lineWidth: 4, arrowSize: 10, arrowType: 'standard', fromPoint: 'top', toPoint: 'bottom' },
    { lineWidth: 2, arrowSize: 6, arrowType: 'none', fromPoint: 'bottom', toPoint: 'top' },
  ];

  const styleRoutingResults = [];
  for (const styleCase of styleVariantCases) {
    const result = await runCase({
      depType: 'finish-to-start',
      fromPoint: styleCase.fromPoint,
      toPoint: styleCase.toPoint,
      dependencyStyle: {
        lineWidth: styleCase.lineWidth,
        arrowSize: styleCase.arrowSize,
        arrowType: styleCase.arrowType,
      },
    });
    styleRoutingResults.push({
      ...styleCase,
      hasPath: result.pathCount > 0,
      negativeY: result.negativeY,
      oversizedWidth: result.oversizedWidth,
      bends: result.sample[0] ? result.sample[0].bends : 0,
    });
  }

  store.getState().newProject();
  store.setState((s) => ({ ...s, activeView: 'data' }));
  const beforeView = store.getState().activeView;
  store.getState().setActiveView('timeline');
  const afterView = store.getState().activeView;

  store.getState().newProject();
  const add = (partial) => store.getState().addItem(partial);
  store.setState((s) => ({
    ...s,
    dependencySettings: {
      ...s.dependencySettings,
      schedulingMode: 'automatic-strict',
    },
  }));

  const a = add({ name: 'A', type: 'task', startDate: '2026-03-29', endDate: '2026-04-05', row: 0 });
  const b = add({ name: 'B', type: 'task', startDate: '2026-04-06', endDate: '2026-04-13', row: 1 });
  store.getState().addDependency(a, b, { type: 'finish-to-start', forceSchedule: true });
  store.getState().moveItem(a, 2);
  const schedulingState = store.getState();
  const movedB = schedulingState.items.find((item) => item.id === b);

  store.getState().updateDependency(a, b, {
    fromPoint: 'top',
    toPoint: 'bottom',
    lineWidth: 3,
    arrowSize: 8,
    arrowType: 'diamond',
  });
  const updatedDep = store.getState().dependencies.find((dep) => dep.fromId === a && dep.toId === b);
  store.getState().removeDependency(a, b);
  const removedDepCount = store.getState().dependencies.length;

  store.getState().newProject();
  const saveTask = add({ name: 'Saved Task', type: 'task', startDate: '2026-03-29', endDate: '2026-04-05', row: 0 });
  void saveTask;
  store.getState().setProjectName('Regression Save Test');
  await store.getState().saveProject();
  const savedId = store.getState().projectId;
  const listedAfterSave = await storage.listProjects();
  await store.getState().loadProject(savedId);
  const loadedState = store.getState();
  await storage.deleteProjectFile(savedId);
  const listedAfterDelete = await storage.listProjects();

  store.getState().newProject();
  const tierTaskId = add({ name: 'Tier Click Task', type: 'task', startDate: '2026-03-29', endDate: '2026-04-05', row: 0 });
  store.setState((s) => ({
    ...s,
    activeView: 'timeline',
    selectedItemId: tierTaskId,
    selectedSwimlaneId: null,
    selectedDepKey: null,
  }));
  await waitForTimelineRender();
  const timelineTierBoxes = Array.from(document.querySelectorAll('.sticky.top-0.z-10 [class*="cursor-pointer"]'));
  timelineTierBoxes[0]?.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  await waitForTimelineRender();
  const tierSelectionState = store.getState();

  store.getState().newProject();
  add({ name: 'Auto A', type: 'task', startDate: '2026-03-29', endDate: '2026-04-05', row: 0 });
  add({ name: 'Auto B', type: 'task', startDate: '2026-06-27', endDate: '2026-07-04', row: 1 });
  store.setState((s) => ({
    ...s,
    activeView: 'timeline',
  }));
  await waitForTimelineRender();
  const timescaleDebug = window.__TIMESCALE_FIT_DEBUG__;
  const autoUnitOrder = ['day', 'week', 'month', 'quarter', 'year'];
  const startIdx = timescaleDebug ? autoUnitOrder.indexOf(timescaleDebug.resolvedAutoUnit) : -1;
  const expectedResolvedUnit = timescaleDebug
    ? (timescaleDebug.diagnostics.slice(startIdx >= 0 ? startIdx : 0).find((entry) => entry.fitsPrefixedFirstCell)?.unit ?? 'year')
    : null;

  storage.listProjects = originalStorage.listProjects;
  storage.saveProjectToFile = originalStorage.saveProjectToFile;
  storage.loadProjectFromFile = originalStorage.loadProjectFromFile;
  storage.deleteProjectFile = originalStorage.deleteProjectFile;

  return {
    routingResults,
    styleRoutingResults,
    views: {
      switchedToTimeline: beforeView === 'data' && afterView === 'timeline',
    },
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
    timescale: {
      tierClickSwitches: tierSelectionState.selectedItemId === null && tierSelectionState.selectedTierIndex !== null && tierSelectionState.stylePaneSection === 'scale',
      tierClickState: {
        selectedItemId: tierSelectionState.selectedItemId,
        selectedTierIndex: tierSelectionState.selectedTierIndex,
        stylePaneSection: tierSelectionState.stylePaneSection,
      },
      autoRangeConsistent: Boolean(timescaleDebug && expectedResolvedUnit && timescaleDebug.resolvedAutoUnitByWidth === expectedResolvedUnit),
      autoRangeState: {
        resolvedAutoUnit: timescaleDebug?.resolvedAutoUnit ?? null,
        resolvedAutoUnitByWidth: timescaleDebug?.resolvedAutoUnitByWidth ?? null,
        expectedResolvedUnit,
        origin: timescaleDebug?.origin ?? null,
        totalDays: timescaleDebug?.totalDays ?? null,
      },
    },
  };
});

const routingFailures = regressionResults.routingResults.filter((r) => r.pathCount === 0 || r.invalid || r.negativeY || r.oversizedWidth || r.excessiveBends);
const styleRoutingFailures = regressionResults.styleRoutingResults.filter((r) => !r.hasPath || r.negativeY || r.oversizedWidth || r.bends > 4);
const viewFailures = regressionResults.views.switchedToTimeline ? [] : [regressionResults.views];
const schedulingFailures = regressionResults.scheduling.successorMoved ? [] : [regressionResults.scheduling];
const dependencyFailures = regressionResults.dependencyOps.updated && regressionResults.dependencyOps.removed ? [] : [regressionResults.dependencyOps];
const persistenceFailures = (
  regressionResults.persistence.saved &&
  regressionResults.persistence.loadedName === 'Regression Save Test' &&
  regressionResults.persistence.loadedItemCount === 1 &&
  regressionResults.persistence.deleted
) ? [] : [regressionResults.persistence];
const timescaleFailures = [];
const escapeFailures = [];
const titleAlignmentFailures = [];
const exportFailures = [];
if (!regressionResults.timescale.tierClickSwitches) {
  timescaleFailures.push({ kind: 'tier-click-switch', ...regressionResults.timescale.tierClickState });
}
if (!regressionResults.timescale.autoRangeConsistent) {
  timescaleFailures.push({ kind: 'auto-range-consistency', ...regressionResults.timescale.autoRangeState });
}
if (JSON.stringify(afterDragEscape) !== JSON.stringify(uiEscapeResults.beforeDates)) {
  escapeFailures.push({ kind: 'drag-cancel', before: uiEscapeResults.beforeDates, after: afterDragEscape });
}
if (afterDepDeselectEscape !== null) {
  escapeFailures.push({ kind: 'dependency-deselect', after: afterDepDeselectEscape });
}
if (afterDepDragEscape.dependencyCount !== uiEscapeResults.dependencyCount || afterDepDragEscape.selectedDepKey !== null) {
  escapeFailures.push({ kind: 'dependency-drag-cancel', beforeDependencyCount: uiEscapeResults.dependencyCount, after: afterDepDragEscape });
}
if (JSON.stringify(afterDatePickerEscape) !== JSON.stringify(uiEscapeResults.beforeDates)) {
  escapeFailures.push({ kind: 'date-picker-cancel', before: uiEscapeResults.beforeDates, after: afterDatePickerEscape });
}

for (const [position, measurement] of Object.entries(titleAlignmentMeasurements)) {
  if (!measurement || measurement.textAlign !== 'center' || measurement.labelWidth < 40 || measurement.centerOffset > 3) {
    titleAlignmentFailures.push({ position, ...measurement });
  }
}

if (!exportResults.available) {
  exportFailures.push({ kind: 'unavailable' });
} else {
  if (exportResults.afterPngView !== 'data') {
    exportFailures.push({ kind: 'png-view-restore', afterPngView: exportResults.afterPngView });
  }
  if (!exportResults.pngDownload || exportResults.pngDownload.download !== 'Regression_Export_Test.png' || !String(exportResults.pngDownload.hrefPrefix).startsWith('data:image/png')) {
    exportFailures.push({ kind: 'png-download', details: exportResults.pngDownload });
  }
  if (!exportResults.pptxWrite || exportResults.pptxWrite.fileName !== 'Regression_Export_Test.pptx' || (exportResults.pptxWrite.slideCount ?? 0) < 1) {
    exportFailures.push({ kind: 'pptx-write', details: exportResults.pptxWrite });
  }
}

const totalFailures = routingFailures.length + styleRoutingFailures.length + viewFailures.length + schedulingFailures.length + dependencyFailures.length + persistenceFailures.length + timescaleFailures.length + escapeFailures.length + titleAlignmentFailures.length + exportFailures.length;

console.log(JSON.stringify({
  routing: {
    total: regressionResults.routingResults.length,
    failures: routingFailures.length,
    failingCases: routingFailures,
  },
  styleRouting: {
    total: regressionResults.styleRoutingResults.length,
    failures: styleRoutingFailures.length,
    failingCases: styleRoutingFailures,
  },
  views: {
    failures: viewFailures.length,
    details: viewFailures,
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
  timescale: {
    failures: timescaleFailures.length,
    details: timescaleFailures,
  },
  escape: {
    failures: escapeFailures.length,
    details: escapeFailures,
  },
  titleAlignment: {
    failures: titleAlignmentFailures.length,
    details: titleAlignmentFailures,
  },
  exports: {
    failures: exportFailures.length,
    details: exportFailures,
  },
  failures: totalFailures,
}, null, 2));

await browser.close();

if (totalFailures > 0) {
  process.exitCode = 1;
}
