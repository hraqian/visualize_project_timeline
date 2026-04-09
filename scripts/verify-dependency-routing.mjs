import { chromium } from 'playwright';

const browser = await chromium.launch({ headless: true });
const page = await browser.newPage({ viewport: { width: 1600, height: 900 } });

await page.goto('http://127.0.0.1:4173/?__regression__=1', { waitUntil: 'networkidle' });
await page.waitForFunction(() => Boolean(window.__PROJECT_STORE__), { timeout: 10000 });

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

const wrappedTitleLayoutResults = await page.evaluate(async () => {
  const store = window.__PROJECT_STORE__;
  if (!store) {
    return { available: false };
  }

  store.getState().newProject();
  const milestoneId = store.getState().addItem({
    name: 'Wrapped milestone title should use measured height',
    type: 'milestone',
    startDate: '2026-03-25',
    endDate: '2026-03-25',
    row: 0,
  });
  const taskId = store.getState().addItem({
    name: 'Task below',
    type: 'task',
    startDate: '2026-03-25',
    endDate: '2026-03-29',
    row: 1,
  });

  store.setState((s) => ({
    ...s,
    activeView: 'timeline',
    items: s.items.map((item) => {
      if (item.id === milestoneId) {
        return {
          ...item,
          milestoneStyle: {
            ...item.milestoneStyle,
            showTitle: true,
            showDate: true,
            labelPosition: 'below',
            dateLabelPosition: 'below',
            titleOverflowMode: 'wrap',
            titleMaxLines: 3,
            fontSize: 14,
          },
        };
      }
      if (item.id === taskId) {
        return {
          ...item,
          taskStyle: {
            ...item.taskStyle,
            showTitle: true,
            labelPosition: 'center',
          },
        };
      }
      return item;
    }),
  }));

  await new Promise((resolve) => setTimeout(resolve, 250));

  const titleEl = document.querySelector(`[data-testid="milestone-title-label-${milestoneId}"]`);
  const taskEl = document.querySelector(`[data-testid="task-title-label-${taskId}"]`);
  if (!(titleEl instanceof HTMLElement) || !(taskEl instanceof HTMLElement)) {
    return { available: false, reason: 'Missing wrapped title or task label elements' };
  }

  const titleRect = titleEl.getBoundingClientRect();
  const taskRect = taskEl.getBoundingClientRect();
  const debug = window.__TIMELINE_GEOMETRY_DEBUG__;
  const measuredTitle = debug?.measured?.find((node) => node.id === `milestone-title-label-${milestoneId}`) ?? null;

  return {
    available: true,
    titleHeight: titleRect.height,
    taskTop: taskRect.top,
    titleBottom: titleRect.bottom,
    verticalGap: taskRect.top - titleRect.bottom,
    measuredTitleHeight: measuredTitle ? measuredTitle.bottomY - measuredTitle.topY : null,
  };
});

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

const compactRangeResults = await page.evaluate(async () => {
  const store = window.__PROJECT_STORE__;
  if (!store) {
    return { available: false };
  }
  const { resolveTimescaleRange } = await import('/src/utils/index.ts');

  store.getState().newProject();
  const startId = store.getState().addItem({
    name: 'Start marker',
    type: 'milestone',
    startDate: '2023-07-03',
    endDate: '2023-07-03',
    row: 0,
  });
  const endId = store.getState().addItem({
    name: 'End task',
    type: 'task',
    startDate: '2026-03-21',
    endDate: '2026-03-27',
    row: 1,
  });

  store.setState((s) => ({
    ...s,
    activeView: 'timeline',
    timescale: {
      ...s.timescale,
      tiers: [
        { ...s.timescale.tiers[0], unit: 'year', format: 'yyyy', visible: true },
        { ...(s.timescale.tiers[1] ?? s.timescale.tiers[0]), unit: 'month', format: 'MMM', visible: true, fontSize: 12, fontSizeAuto: true, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal' },
        ...s.timescale.tiers.slice(2).map((tier) => ({ ...tier, visible: false })),
      ],
    },
  }));

  await new Promise((resolve) => setTimeout(resolve, 200));
  const state = store.getState();
  const items = state.items.filter((item) => item.id === startId || item.id === endId);
  const resolved = resolveTimescaleRange(items, state.timescale, 744);
  return {
    available: true,
    origin: resolved.origin,
    rangeEndDate: resolved.rangeEndDate.toISOString().split('T')[0],
    totalDays: resolved.totalDays,
    visibleUnits: resolved.resolvedUnits,
  };
});

const previewParityResults = await page.evaluate(async () => {
  const store = window.__PROJECT_STORE__;
  if (!store) {
    return { available: false };
  }

  const waitForPaint = () => new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  const getTierLabels = (surface) => {
    const root = document.querySelector(`[data-timescale-surface="${surface}"]`);
    if (!(root instanceof HTMLElement)) return null;
    return Array.from(root.querySelectorAll('[data-timescale-tier-row]')).map((row) => (
      Array.from(row.querySelectorAll('[data-timescale-tier-label]')).map((label) => label.textContent?.trim() ?? '')
    ));
  };
  const hasTodayMarker = (surface) => Boolean(document.querySelector(`[data-timescale-today-marker="${surface}"]`));

  store.getState().newProject();
  store.getState().addItem({
    name: 'Preview parity start',
    type: 'milestone',
    startDate: '2013-07-03',
    endDate: '2013-07-03',
    row: 0,
  });
  store.getState().addItem({
    name: 'Preview parity end',
    type: 'task',
    startDate: '2016-03-21',
    endDate: '2016-03-27',
    row: 1,
  });

  store.setState((s) => ({
    ...s,
    activeView: 'timeline',
    stylePaneSection: 'scale',
    timescale: {
      ...s.timescale,
      showToday: true,
      tiers: [
        { ...s.timescale.tiers[0], unit: 'year', format: 'yyyy', visible: true },
        { ...(s.timescale.tiers[1] ?? s.timescale.tiers[0]), unit: 'month', format: 'MMM', visible: true, fontSize: 12, fontSizeAuto: true, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal' },
        ...s.timescale.tiers.slice(2).map((tier) => ({ ...tier, visible: false })),
      ],
    },
  }));

  await waitForPaint();

  const tierSettingsButton = Array.from(document.querySelectorAll('button')).find((button) => button.textContent?.trim() === 'Tier settings');
  if (!(tierSettingsButton instanceof HTMLButtonElement)) {
    return { available: false, reason: 'Missing Tier settings button' };
  }

  tierSettingsButton.click();
  await waitForPaint();

  const timelineLabels = getTierLabels('timeline');
  const previewLabels = getTierLabels('preview');
  if (!timelineLabels || !previewLabels) {
    return {
      available: false,
      reason: 'Missing rendered timescale surfaces',
      timelinePresent: Boolean(timelineLabels),
      previewPresent: Boolean(previewLabels),
    };
  }

  const timelineTodayVisible = hasTodayMarker('timeline');
  const previewTodayVisible = hasTodayMarker('preview');
  const closeButton = document.querySelector('[aria-label="Close modal"]');
  if (closeButton instanceof HTMLElement) {
    closeButton.click();
    await waitForPaint();
  }

  return {
    available: true,
    timelineLabels,
    previewLabels,
    timelineTodayVisible,
    previewTodayVisible,
  };
});

const timescaleEdgeCaseResults = await page.evaluate(async () => {
  const store = window.__PROJECT_STORE__;
  if (!store) {
    return { available: false };
  }

  const { buildResolvedTimescaleModel, resolveTimescaleRange } = await import('/src/utils/index.ts');

  const configureVisibleTiers = (state, tiers) => ({
    ...state.timescale,
    tiers: [
      ...tiers,
      ...state.timescale.tiers.slice(tiers.length).map((tier) => ({ ...tier, visible: false })),
    ],
  });

  store.getState().newProject();
  store.getState().addItem({
    name: 'Single tier task',
    type: 'task',
    startDate: '2026-03-29',
    endDate: '2026-04-05',
    row: 0,
  });
  store.setState((s) => ({
    ...s,
    timescale: configureVisibleTiers(s, [
      { ...s.timescale.tiers[0], unit: 'month', format: 'MMM', visible: true },
    ]),
  }));
  const singleTierState = store.getState();
  const singleTierModel = buildResolvedTimescaleModel(singleTierState.items, singleTierState.timescale, 744);

  store.getState().newProject();
  store.getState().addItem({
    name: 'Mixed auto start',
    type: 'task',
    startDate: '2024-01-15',
    endDate: '2024-01-20',
    row: 0,
  });
  store.getState().addItem({
    name: 'Mixed auto end',
    type: 'task',
    startDate: '2024-06-10',
    endDate: '2024-06-18',
    row: 1,
  });
  store.setState((s) => ({
    ...s,
    timescale: configureVisibleTiers(s, [
      { ...s.timescale.tiers[0], unit: 'auto', format: 'MMM', visible: true },
      { ...(s.timescale.tiers[1] ?? s.timescale.tiers[0]), unit: 'month', format: 'MMM', visible: true, fontSize: 12, fontSizeAuto: true, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal' },
    ]),
  }));
  const mixedAutoState = store.getState();
  const mixedAutoRange = resolveTimescaleRange(mixedAutoState.items, mixedAutoState.timescale, 744);
  const explicitMonthRange = resolveTimescaleRange(mixedAutoState.items, {
    ...mixedAutoState.timescale,
    tiers: [{ ...(mixedAutoState.timescale.tiers[1] ?? mixedAutoState.timescale.tiers[0]), unit: 'month', format: 'MMM', visible: true }],
  }, 744);

  store.getState().newProject();
  store.getState().addItem({
    name: 'Single day milestone',
    type: 'milestone',
    startDate: '2026-03-29',
    endDate: '2026-03-29',
    row: 0,
  });
  store.setState((s) => ({
    ...s,
    timescale: configureVisibleTiers(s, [
      { ...s.timescale.tiers[0], unit: 'year', format: 'yyyy', visible: true },
      { ...(s.timescale.tiers[1] ?? s.timescale.tiers[0]), unit: 'day', format: 'd_num', visible: true, fontSize: 11, fontSizeAuto: true, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal' },
    ]),
  }));
  const shortRangeState = store.getState();
  const shortRangeModel = buildResolvedTimescaleModel(shortRangeState.items, shortRangeState.timescale, 744);

  store.getState().newProject();
  store.getState().addItem({
    name: 'Boundary start',
    type: 'milestone',
    startDate: '2023-07-03',
    endDate: '2023-07-03',
    row: 0,
  });
  store.getState().addItem({
    name: 'Boundary end',
    type: 'task',
    startDate: '2026-03-21',
    endDate: '2026-03-27',
    row: 1,
  });
  store.setState((s) => ({
    ...s,
    timescale: configureVisibleTiers(s, [
      { ...s.timescale.tiers[0], unit: 'year', format: 'yyyy', visible: true },
      { ...(s.timescale.tiers[1] ?? s.timescale.tiers[0]), unit: 'month', format: 'MMM', visible: true, fontSize: 12, fontSizeAuto: true, fontFamily: 'Arial', fontWeight: 400, fontStyle: 'normal' },
    ]),
  }));
  const upperBoundaryState = store.getState();
  const upperBoundaryModel = buildResolvedTimescaleModel(upperBoundaryState.items, upperBoundaryState.timescale, 744);

  store.getState().newProject();
  store.getState().addItem({
    name: 'Fiscal task',
    type: 'task',
    startDate: '2025-03-15',
    endDate: '2025-03-20',
    row: 0,
  });
  store.setState((s) => ({
    ...s,
    timescale: {
      ...configureVisibleTiers(s, [
        { ...s.timescale.tiers[0], unit: 'year', format: 'yyyy', visible: true },
      ]),
      fiscalYearStartMonth: 7,
    },
  }));
  const fiscalState = store.getState();
  const fiscalRange = resolveTimescaleRange(fiscalState.items, fiscalState.timescale, 744);
  const fiscalModel = buildResolvedTimescaleModel(fiscalState.items, fiscalState.timescale, 744);

  return {
    available: true,
    singleTier: {
      visibleUnits: singleTierModel.resolvedUnits,
      tierRowCount: singleTierModel.tierRows.length,
      firstRowLabels: singleTierModel.tierRows[0]?.cells.map((cell) => cell.label) ?? [],
    },
    mixedAutoExplicit: {
      autoOrigin: mixedAutoRange.origin,
      autoEnd: mixedAutoRange.rangeEndDate.toISOString().split('T')[0],
      explicitOrigin: explicitMonthRange.origin,
      explicitEnd: explicitMonthRange.rangeEndDate.toISOString().split('T')[0],
      resolvedUnits: mixedAutoRange.resolvedUnits,
    },
    shortRange: {
      totalDays: shortRangeModel.totalDays,
      bottomLabels: shortRangeModel.tierRows.at(-1)?.cells.map((cell) => cell.label) ?? [],
      topLabels: shortRangeModel.tierRows[0]?.cells.map((cell) => cell.label) ?? [],
    },
    upperBoundary: {
      topLabels: upperBoundaryModel.tierRows[0]?.cells.map((cell) => cell.label) ?? [],
      bottomLabels: upperBoundaryModel.tierRows.at(-1)?.cells.map((cell) => cell.label) ?? [],
    },
    fiscalYear: {
      origin: fiscalRange.origin,
      rangeEndDate: fiscalRange.rangeEndDate.toISOString().split('T')[0],
      labels: fiscalModel.tierRows[0]?.cells.map((cell) => cell.label) ?? [],
    },
  };
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
  const addSameDay = (partial) => store.getState().addItem(partial);
  const sameDayMilestoneId = addSameDay({ name: 'M Same Day', type: 'milestone', startDate: '2026-03-25', endDate: '2026-03-25', row: 0 });
  const sameDayTaskId = addSameDay({ name: 'T Same Day', type: 'task', startDate: '2026-03-25', endDate: '2026-03-25', row: 1 });
  store.getState().addDependency(sameDayMilestoneId, sameDayTaskId, {
    type: 'finish-to-start',
    fromPoint: 'auto',
    toPoint: 'auto',
    forceSchedule: false,
  });
  store.setState((s) => ({
    ...s,
    activeView: 'timeline',
    showDependencies: true,
  }));
  const sameDayMilestoneTaskPaths = await waitForDependencyPaths();
  const sameDayMilestoneTaskMetrics = sameDayMilestoneTaskPaths.map((d) => {
    const pts = parsePath(d);
    const xs = pts.map((p) => p[0]);
    return {
      d,
      firstX: xs[0],
      lastX: xs[xs.length - 1],
      minX: Math.min(...xs),
      bends: countBends(pts),
    };
  });
  const sameDayMilestoneTaskRouting = {
    hasPath: sameDayMilestoneTaskMetrics.length > 0,
    routesBackward: sameDayMilestoneTaskMetrics.some((m) => m.minX < Math.min(m.firstX, m.lastX) - 1),
    excessiveBends: sameDayMilestoneTaskMetrics.some((m) => m.bends > 4),
    sample: sameDayMilestoneTaskMetrics[0] ?? null,
  };

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
    sameDayMilestoneTaskRouting,
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
const sameDayMilestoneTaskFailures = regressionResults.sameDayMilestoneTaskRouting.hasPath && !regressionResults.sameDayMilestoneTaskRouting.routesBackward && !regressionResults.sameDayMilestoneTaskRouting.excessiveBends
  ? []
  : [regressionResults.sameDayMilestoneTaskRouting];
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
const wrappedTitleLayoutFailures = [];
const compactRangeFailures = [];
const previewParityFailures = [];
const timescaleEdgeCaseFailures = [];
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

if (!wrappedTitleLayoutResults.available) {
  wrappedTitleLayoutFailures.push(wrappedTitleLayoutResults);
} else {
  if (!(wrappedTitleLayoutResults.titleHeight > 20)) {
    wrappedTitleLayoutFailures.push({ reason: 'Wrapped title did not grow taller', ...wrappedTitleLayoutResults });
  }
  if (!(wrappedTitleLayoutResults.verticalGap >= 0)) {
    wrappedTitleLayoutFailures.push({ reason: 'Wrapped title overlapped next row content', ...wrappedTitleLayoutResults });
  }
  if (wrappedTitleLayoutResults.measuredTitleHeight !== null && Math.abs(wrappedTitleLayoutResults.measuredTitleHeight - wrappedTitleLayoutResults.titleHeight) > 2) {
    wrappedTitleLayoutFailures.push({ reason: 'Measured title height diverged from DOM height', ...wrappedTitleLayoutResults });
  }
}

if (!compactRangeResults.available) {
  compactRangeFailures.push(compactRangeResults);
} else {
  if (compactRangeResults.origin !== '2023-07-01') {
    compactRangeFailures.push({ reason: 'Unexpected compact range start', ...compactRangeResults });
  }
  if (compactRangeResults.rangeEndDate !== '2026-04-30') {
    compactRangeFailures.push({ reason: 'Unexpected compact range end', ...compactRangeResults });
  }
}

if (!previewParityResults.available) {
  previewParityFailures.push(previewParityResults);
} else {
  if (JSON.stringify(previewParityResults.timelineLabels) !== JSON.stringify(previewParityResults.previewLabels)) {
    previewParityFailures.push({
      reason: 'Preview labels diverged from timeline labels',
      timelineLabels: previewParityResults.timelineLabels,
      previewLabels: previewParityResults.previewLabels,
    });
  }
  if (previewParityResults.timelineTodayVisible) {
    previewParityFailures.push({ reason: 'Timeline today marker rendered outside range' });
  }
  if (previewParityResults.previewTodayVisible) {
    previewParityFailures.push({ reason: 'Preview today marker rendered outside range' });
  }
}

if (!timescaleEdgeCaseResults.available) {
  timescaleEdgeCaseFailures.push(timescaleEdgeCaseResults);
} else {
  if (timescaleEdgeCaseResults.singleTier.visibleUnits.length !== 1 || timescaleEdgeCaseResults.singleTier.tierRowCount !== 1) {
    timescaleEdgeCaseFailures.push({ reason: 'Single visible tier model shape changed', ...timescaleEdgeCaseResults.singleTier });
  }
  if (timescaleEdgeCaseResults.mixedAutoExplicit.autoOrigin !== timescaleEdgeCaseResults.mixedAutoExplicit.explicitOrigin || timescaleEdgeCaseResults.mixedAutoExplicit.autoEnd !== timescaleEdgeCaseResults.mixedAutoExplicit.explicitEnd) {
    timescaleEdgeCaseFailures.push({ reason: 'Upper auto tier changed bottom-tier-owned range', ...timescaleEdgeCaseResults.mixedAutoExplicit });
  }
  if (timescaleEdgeCaseResults.shortRange.bottomLabels.length !== 1 || timescaleEdgeCaseResults.shortRange.bottomLabels[0] !== 'Day 29' || timescaleEdgeCaseResults.shortRange.topLabels.length < 1) {
    timescaleEdgeCaseFailures.push({ reason: 'Very short range model did not preserve single-day coverage', ...timescaleEdgeCaseResults.shortRange });
  }
  if (!timescaleEdgeCaseResults.upperBoundary.topLabels.includes('2026')) {
    timescaleEdgeCaseFailures.push({ reason: 'Upper tier dropped trailing partial boundary cell', ...timescaleEdgeCaseResults.upperBoundary });
  }
  if (timescaleEdgeCaseResults.fiscalYear.origin !== '2024-07-01' || timescaleEdgeCaseResults.fiscalYear.rangeEndDate !== '2025-06-30' || !timescaleEdgeCaseResults.fiscalYear.labels.includes('FY2024')) {
    timescaleEdgeCaseFailures.push({ reason: 'Fiscal year offset did not align year range correctly', ...timescaleEdgeCaseResults.fiscalYear });
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

const totalFailures = routingFailures.length + styleRoutingFailures.length + sameDayMilestoneTaskFailures.length + viewFailures.length + schedulingFailures.length + dependencyFailures.length + persistenceFailures.length + timescaleFailures.length + escapeFailures.length + titleAlignmentFailures.length + wrappedTitleLayoutFailures.length + compactRangeFailures.length + previewParityFailures.length + timescaleEdgeCaseFailures.length + exportFailures.length;

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
  sameDayMilestoneTaskRouting: {
    failures: sameDayMilestoneTaskFailures.length,
    details: sameDayMilestoneTaskFailures,
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
  wrappedTitleLayout: {
    failures: wrappedTitleLayoutFailures.length,
    details: wrappedTitleLayoutFailures,
  },
  compactRange: {
    failures: compactRangeFailures.length,
    details: compactRangeFailures,
  },
  previewParity: {
    failures: previewParityFailures.length,
    details: previewParityFailures,
  },
  timescaleEdgeCases: {
    failures: timescaleEdgeCaseFailures.length,
    details: timescaleEdgeCaseFailures,
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
