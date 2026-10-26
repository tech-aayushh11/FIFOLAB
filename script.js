/**
 * ============================================================================
 * FIFO LAB — Interactive Page Replacement Simulator
 * script.js — Architecture & Implementation
 *
 * Designed for Operating Systems Laboratory Viva & Interactive Demonstration
 * Features:
 *   1. Pure FIFO Simulation Engine (no DOM / state coupling)
 *   2. Multi-Process Manager & Global Frame Allocator (Equal / Proportional / Custom)
 *   3. Reference String Parser, Validator & LCG Random Generator
 *   4. Historical Memory Frame Matrix & Animated FIFO Queue Visualizer
 *   5. Belady's Anomaly Demonstration Lab (3 vs 4 Frames Side-by-Side)
 *   6. Dynamic Plain-English Step Explanation Generator
 *   7. Real-Time Chart.js Visualizations (Donut & Faults-vs-Frames Curve)
 *   8. AVA — Female AI Voice Assistant (Web Speech Recognition & Synthesis)
 *   9. CSV, PDF (html2canvas + jsPDF), and PNG Export Handlers
 *  10. Theme Management & LocalStorage Persistence
 * ============================================================================
 */

'use strict';

/* ============================================================================
   1. PURE FIFO SIMULATION ENGINE
   ============================================================================ */

/**
 * Pure function to simulate FIFO Page Replacement Algorithm.
 * Does not mutate global state or touch the DOM.
 *
 * FIFO Principle:
 *   - The memory frame holding the page that arrived earliest (front of FIFO queue)
 *     is selected for eviction when a page fault occurs and all frames are full.
 *   - On a page HIT, the page is already in memory: FIFO queue order remains UNTOUCHED.
 *     (Modifying queue order on a hit would erroneously turn FIFO into LRU).
 *
 * @param {number[]} pages - Array of page reference integers
 * @param {number} frameCount - Number of allocated physical frames (>= 1)
 * @returns {Array<Object>} History array where index 0 is initial state and 1..N are processed steps
 */
function simulateFIFO(pages, frameCount) {
  if (!Array.isArray(pages) || frameCount < 1) {
    throw new Error('simulateFIFO requires a valid array of pages and frameCount >= 1');
  }

  const frames = new Array(frameCount).fill(null);
  const queue = []; // Tracks FIFO insertion order: queue[0] is oldest
  const history = [];

  let hitCount = 0;
  let faultCount = 0;

  // Step 0: Initial empty state before any reference is processed
  history.push({
    stepIndex: 0,
    page: null,
    frames: [...frames],
    queue: [...queue],
    hit: false,
    fault: false,
    replacedPage: null,
    loadedPage: null,
    slotIndex: -1,
    explanation: 'Ready to begin. All memory frames are initially empty.',
    hitCount: 0,
    faultCount: 0,
    hitRatio: 0,
    faultRatio: 0
  });

  for (let i = 0; i < pages.length; i++) {
    const page = pages[i];
    const inMemory = frames.includes(page);
    let hit = false;
    let fault = false;
    let replacedPage = null;
    let loadedPage = null;
    let slotIndex = -1;

    if (inMemory) {
      // PAGE HIT
      hit = true;
      hitCount++;
      slotIndex = frames.indexOf(page);
      // FIFO CRUCIAL RULE: Queue order is NOT modified on a hit!
    } else {
      // PAGE FAULT
      fault = true;
      faultCount++;
      loadedPage = page;

      const emptyIdx = frames.indexOf(null);
      if (emptyIdx !== -1) {
        // Free frame slot exists: place incoming page into free slot
        frames[emptyIdx] = page;
        queue.push(page);
        slotIndex = emptyIdx;
      } else {
        // All frames full: evict the oldest page from queue front
        const oldest = queue.shift();
        replacedPage = oldest;
        const replaceIdx = frames.indexOf(oldest);
        frames[replaceIdx] = page;
        queue.push(page);
        slotIndex = replaceIdx;
      }
    }

    const processed = i + 1;
    const hitRatio = parseFloat(((hitCount / processed) * 100).toFixed(1));
    const faultRatio = parseFloat(((faultCount / processed) * 100).toFixed(1));

    let explanation = '';
    if (hit) {
      explanation = `Page ${page} is already resident in Frame ${slotIndex}. This is a Page Hit. FIFO queue order remains unchanged.`;
    } else if (replacedPage === null) {
      explanation = `Page ${page} is not in memory. Page Fault! Free Frame ${slotIndex} allocated and Page ${page} loaded to FIFO rear.`;
    } else {
      explanation = `Page ${page} is not in memory. Page Fault! All frames full. Oldest Page ${replacedPage} at queue front evicted from Frame ${slotIndex}; Page ${page} loaded.`;
    }

    history.push({
      stepIndex: processed,
      page,
      frames: [...frames],
      queue: [...queue],
      hit,
      fault,
      replacedPage,
      loadedPage,
      slotIndex,
      explanation,
      hitCount,
      faultCount,
      hitRatio,
      faultRatio
    });
  }

  return history;
}

/**
 * Runs FIFO simulation for a sequence across frame counts 1 to 10.
 * Used for the Faults vs Frames curve and automated Belady's anomaly detection.
 *
 * @param {number[]} pages
 * @param {number} [minFrames=1]
 * @param {number} [maxFrames=10]
 * @returns {Array<Object>}
 */
function simulateFramesRange(pages, minFrames = 1, maxFrames = 10) {
  const results = [];
  let previousFaults = null;

  for (let f = minFrames; f <= maxFrames; f++) {
    const trace = simulateFIFO(pages, f);
    const lastStep = trace[trace.length - 1];
    const faults = lastStep.faultCount;
    const hits = lastStep.hitCount;
    const hitRatio = lastStep.hitRatio;

    // Detect Belady's anomaly: fault count increased despite more frames
    const isAnomaly = previousFaults !== null && faults > previousFaults;

    results.push({
      frameCount: f,
      faults,
      hits,
      hitRatio,
      isAnomaly,
      diff: previousFaults !== null ? faults - previousFaults : 0
    });

    previousFaults = faults;
  }

  return results;
}

/* ============================================================================
   2. APPLICATION STATE & PROCESS MANAGER
   ============================================================================ */

const AppState = {
  // Available processes
  processes: [
    {
      id: 'P1',
      name: 'Process P1',
      pages: [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1],
      frameCount: 3
    },
    {
      id: 'P2',
      name: 'Process P2',
      pages: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5],
      frameCount: 4
    },
    {
      id: 'P3',
      name: 'Process P3',
      pages: [0, 1, 2, 3, 0, 1, 4, 0, 1, 2, 3, 4],
      frameCount: 3
    }
  ],
  activeProcessId: 'P1',

  // Global physical allocation setting
  totalPhysicalFrames: 10,
  allocationStrategy: 'equal', // 'equal', 'proportional', 'custom'

  // Simulation status & playback
  currentStepIndex: 0,
  isPlaying: false,
  playTimer: null,
  playbackSpeed: 1.0, // Multiplier: 0.25x to 3.0x
  baseStepIntervalMs: 1200,

  // Overview metric scope: 'current' | 'all'
  metricsScope: 'current',

  // Belady's Lab specific sequence
  beladyString: [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5],

  // Theme
  theme: 'light',

  // Cache for computed simulations: processId -> history array
  simulationCache: {}
};

/**
 * Returns the currently selected process object.
 */
function getActiveProcess() {
  const p = AppState.processes.find(item => item.id === AppState.activeProcessId);
  return p || AppState.processes[0];
}

/**
 * Gets simulation history for a process from cache or computes it.
 */
function getProcessSimulation(processObj) {
  const cacheKey = `${processObj.id}_${processObj.frameCount}_${processObj.pages.join(',')}`;
  if (!AppState.simulationCache[cacheKey]) {
    AppState.simulationCache[cacheKey] = simulateFIFO(processObj.pages, processObj.frameCount);
  }
  return AppState.simulationCache[cacheKey];
}

/**
 * Invalidates cache for a specific process or all processes.
 */
function invalidateSimulation(processId = null) {
  if (processId) {
    Object.keys(AppState.simulationCache).forEach(key => {
      if (key.startsWith(processId + '_')) {
        delete AppState.simulationCache[key];
      }
    });
  } else {
    AppState.simulationCache = {};
  }
}

/* ============================================================================
   3. REFERENCE STRING PARSER & VALIDATOR
   ============================================================================ */

/**
 * Parses user input string (comma or whitespace delimited) into an array of page numbers.
 * Validates that every token is a non-negative integer.
 *
 * @param {string} inputStr
 * @returns {{ valid: boolean, pages: number[], error: string|null }}
 */
function parseReferenceString(inputStr) {
  if (!inputStr || typeof inputStr !== 'string' || inputStr.trim() === '') {
    return { valid: false, pages: [], error: 'Reference string cannot be empty. Please enter page numbers.' };
  }

  // Split by commas and/or whitespace
  const tokens = inputStr.trim().split(/[\s,]+/);
  const parsedPages = [];

  for (let i = 0; i < tokens.length; i++) {
    const token = tokens[i].trim();
    if (token === '') continue;

    // Check if token is a valid non-negative integer
    if (!/^\d+$/.test(token)) {
      return {
        valid: false,
        pages: [],
        error: `Invalid page identifier "${token}". Pages must be non-negative integers (e.g. 0, 1, 2).`
      };
    }

    const val = parseInt(token, 10);
    if (isNaN(val) || val < 0 || val > 999) {
      return {
        valid: false,
        pages: [],
        error: `Page number ${token} is out of allowable range (0–999).`
      };
    }

    parsedPages.push(val);
  }

  if (parsedPages.length === 0) {
    return { valid: false, pages: [], error: 'No valid page references found in input.' };
  }

  return { valid: true, pages: parsedPages, error: null };
}

/**
 * Linear Congruential Generator (LCG) for deterministic pseudo-random sequences.
 */
function seededRandom(seed) {
  let s = seed % 2147483647;
  if (s <= 0) s += 2147483646;
  return function() {
    s = (s * 16807) % 2147483647;
    return (s - 1) / 2147483646;
  };
}

/**
 * Generates random page references.
 */
function generateRandomReferences(count, minPage, maxPage, useDeterministic = false) {
  const rng = useDeterministic ? seededRandom(42) : Math.random;
  const pages = [];
  for (let i = 0; i < count; i++) {
    const p = Math.floor(rng() * (maxPage - minPage + 1)) + minPage;
    pages.push(p);
  }
  return pages;
}

/* ============================================================================
   4. SIMULATION CONTROLLER & TIMELINE ENGINE
   ============================================================================ */

/**
 * Sets current simulation step, updates all UI components, and triggers speech if active.
 */
function setSimulationStep(stepIndex, fromAutoPlay = false) {
  const proc = getActiveProcess();
  const history = getProcessSimulation(proc);
  const maxStep = history.length - 1;

  if (stepIndex < 0) stepIndex = 0;
  if (stepIndex > maxStep) stepIndex = maxStep;

  AppState.currentStepIndex = stepIndex;

  // Render all views
  renderTimeline();
  renderMemoryTable();
  renderFIFOQueue();
  renderExplanation();
  renderKPIs();
  updatePlaybackControlStates();

  // If auto-narrate is enabled in AVA, speak step
  if (window.AVA && AVA.autoNarrateEnabled && stepIndex > 0) {
    const currentStepObj = history[stepIndex];
    let speechText = '';
    if (stepIndex === maxStep && fromAutoPlay) {
      speechText = `Simulation complete. Process ${proc.id} finished with ${currentStepObj.faultCount} faults and ${currentStepObj.hitCount} hits. Hit ratio is ${currentStepObj.hitRatio} percent.`;
    } else if (currentStepObj.hit) {
      speechText = `Step ${stepIndex}. Page ${currentStepObj.page} is a page hit. Queue unchanged.`;
    } else if (currentStepObj.replacedPage !== null) {
      speechText = `Step ${stepIndex}. Page ${currentStepObj.page} causes a fault. Oldest page ${currentStepObj.replacedPage} replaced in frame ${currentStepObj.slotIndex}.`;
    } else {
      speechText = `Step ${stepIndex}. Page ${currentStepObj.page} causes a fault. Loaded into empty frame ${currentStepObj.slotIndex}.`;
    }
    AVA.speak(speechText, true);
  }

  // Update Status Badge
  updateStatusBadge();
}

/**
 * Starts or restarts playback.
 */
function startSimulation() {
  pauseSimulation();
  setSimulationStep(0);
  if (window.AVA && AVA.autoNarrateEnabled) {
    const proc = getActiveProcess();
    AVA.speak(`Starting FIFO simulation for process ${proc.id} with ${proc.frameCount} frames and ${proc.pages.length} page references.`);
  }
  playSimulation();
}

/**
 * Plays simulation forward automatically.
 */
function playSimulation() {
  if (AppState.isPlaying) return;
  const proc = getActiveProcess();
  const history = getProcessSimulation(proc);

  // If already at end, restart from step 0
  if (AppState.currentStepIndex >= history.length - 1) {
    AppState.currentStepIndex = 0;
  }

  AppState.isPlaying = true;
  updatePlaybackControlStates();
  updateStatusBadge();

  const stepInterval = Math.max(250, AppState.baseStepIntervalMs / AppState.playbackSpeed);

  AppState.playTimer = setInterval(() => {
    const currentHist = getProcessSimulation(getActiveProcess());
    if (AppState.currentStepIndex < currentHist.length - 1) {
      setSimulationStep(AppState.currentStepIndex + 1, true);
    } else {
      pauseSimulation();
      updateStatusBadge();
    }
  }, stepInterval);
}

/**
 * Pauses auto-play.
 */
function pauseSimulation() {
  if (AppState.playTimer) {
    clearInterval(AppState.playTimer);
    AppState.playTimer = null;
  }
  AppState.isPlaying = false;
  updatePlaybackControlStates();
  updateStatusBadge();
}

/**
 * Steps forward by 1 step.
 */
function stepForward() {
  pauseSimulation();
  const proc = getActiveProcess();
  const history = getProcessSimulation(proc);
  if (AppState.currentStepIndex < history.length - 1) {
    setSimulationStep(AppState.currentStepIndex + 1);
  }
}

/**
 * Steps backward by 1 step.
 */
function stepBackward() {
  pauseSimulation();
  if (AppState.currentStepIndex > 0) {
    setSimulationStep(AppState.currentStepIndex - 1);
  }
}

/**
 * Resets simulation to step 0.
 */
function resetSimulation() {
  pauseSimulation();
  setSimulationStep(0);
}

/**
 * Updates UI playback buttons depending on state.
 */
function updatePlaybackControlStates() {
  const proc = getActiveProcess();
  const history = getProcessSimulation(proc);
  const maxStep = history.length - 1;

  const playBtn = document.getElementById('simPlayBtn');
  const playText = document.getElementById('simPlayBtnText');
  const playIcon = playBtn ? playBtn.querySelector('.play-icon') : null;
  const pauseIcon = playBtn ? playBtn.querySelector('.pause-icon') : null;

  const prevBtn = document.getElementById('simPrevBtn');
  const nextBtn = document.getElementById('simNextBtn');

  if (AppState.isPlaying) {
    if (playText) playText.textContent = 'Pause';
    if (playIcon) playIcon.style.display = 'none';
    if (pauseIcon) pauseIcon.style.display = 'inline-block';
  } else {
    if (playText) playText.textContent = 'Auto-Play';
    if (playIcon) playIcon.style.display = 'inline-block';
    if (pauseIcon) pauseIcon.style.display = 'none';
  }

  if (prevBtn) prevBtn.disabled = AppState.currentStepIndex === 0;
  if (nextBtn) nextBtn.disabled = AppState.currentStepIndex >= maxStep;
}

/**
 * Updates Header Status Badge (Ready / Running / Paused / Completed).
 */
function updateStatusBadge() {
  const badge = document.getElementById('simulationStatusBadge');
  const text = document.getElementById('statusBadgeText');
  if (!badge || !text) return;

  const proc = getActiveProcess();
  const history = getProcessSimulation(proc);
  const maxStep = history.length - 1;

  badge.className = 'status-badge';

  if (AppState.isPlaying) {
    badge.classList.add('status-running');
    text.textContent = 'Running';
  } else if (AppState.currentStepIndex >= maxStep && maxStep > 0) {
    badge.classList.add('status-completed');
    text.textContent = 'Completed';
  } else if (AppState.currentStepIndex > 0) {
    badge.classList.add('status-paused');
    text.textContent = 'Paused';
  } else {
    badge.classList.add('status-ready');
    text.textContent = 'Ready';
  }
}

/* ============================================================================
   5. UI RENDERERS
   ============================================================================ */

/**
 * Renders Top KPI Cards (Total References, Hits, Faults, Hit Ratio).
 */
function renderKPIs() {
  const proc = getActiveProcess();
  const history = getProcessSimulation(proc);
  const currentStep = history[AppState.currentStepIndex];

  let totalRefs = proc.pages.length;
  let hits = currentStep.hitCount;
  let faults = currentStep.faultCount;
  let hitRatio = currentStep.hitRatio;
  let faultRatio = currentStep.faultRatio;

  if (AppState.metricsScope === 'all') {
    // Aggregate over all processes
    let aggRefs = 0;
    let aggHits = 0;
    let aggFaults = 0;

    AppState.processes.forEach(p => {
      const pHist = getProcessSimulation(p);
      const last = pHist[pHist.length - 1];
      aggRefs += p.pages.length;
      aggHits += last.hitCount;
      aggFaults += last.faultCount;
    });

    totalRefs = aggRefs;
    hits = aggHits;
    faults = aggFaults;
    hitRatio = aggRefs > 0 ? parseFloat(((aggHits / aggRefs) * 100).toFixed(1)) : 0;
    faultRatio = aggRefs > 0 ? parseFloat(((aggFaults / aggRefs) * 100).toFixed(1)) : 0;
  }

  // Update DOM elements
  const valRefs = document.getElementById('kpiValueRefs');
  const valHits = document.getElementById('kpiValueHits');
  const valFaults = document.getElementById('kpiValueFaults');
  const valRatio = document.getElementById('kpiValueRatio');

  if (valRefs) valRefs.textContent = totalRefs;
  if (valHits) valHits.textContent = hits;
  if (valFaults) valFaults.textContent = faults;
  if (valRatio) valRatio.textContent = `${hitRatio}%`;

  const progFill = document.getElementById('kpiProgressFill');
  if (progFill) progFill.style.width = `${Math.min(100, hitRatio)}%`;

  const deltaHits = document.getElementById('kpiDeltaHits');
  if (deltaHits) deltaHits.textContent = `Hit Rate: ${hitRatio}%`;

  const deltaFaults = document.getElementById('kpiDeltaFaults');
  if (deltaFaults) deltaFaults.textContent = `Fault Rate: ${faultRatio}%`;

  const processedText = document.getElementById('kpiProcessedText');
  if (processedText) {
    processedText.textContent = AppState.metricsScope === 'current'
      ? `Step ${AppState.currentStepIndex} / ${proc.pages.length}`
      : 'All Processes Total';
  }

  const scopeProcName = document.getElementById('statsScopeProcessName');
  if (scopeProcName) scopeProcName.textContent = proc.name;
}

/**
 * Renders Reference Timeline Chips and Scrubber Slider.
 */
function renderTimeline() {
  const proc = getActiveProcess();
  const history = getProcessSimulation(proc);
  const container = document.getElementById('timelineChipsWrapper');
  const scrubber = document.getElementById('timelineScrubber');
  const scrubberLabel = document.getElementById('scrubberCurrentStepLabel');

  if (!container || !scrubber) return;

  const totalSteps = proc.pages.length;
  scrubber.max = totalSteps;
  scrubber.value = AppState.currentStepIndex;

  if (scrubberLabel) {
    scrubberLabel.textContent = `Step ${AppState.currentStepIndex} / ${totalSteps}`;
  }

  // Populate timeline chips
  let chipsHtml = '';

  for (let i = 0; i < proc.pages.length; i++) {
    const stepIdx = i + 1;
    const pageVal = proc.pages[i];
    const stepObj = history[stepIdx];

    let stateClass = 'state-upcoming';
    if (stepIdx < AppState.currentStepIndex) {
      stateClass = stepObj.hit ? 'state-hit' : 'state-fault';
    } else if (stepIdx === AppState.currentStepIndex) {
      stateClass = 'state-current ' + (stepObj.hit ? 'state-hit' : 'state-fault');
    }

    chipsHtml += `
      <div class="timeline-chip ${stateClass}" data-step="${stepIdx}" role="button" tabindex="0" title="Step ${stepIdx}: Page ${pageVal} (${stepObj.hit ? 'HIT' : 'FAULT'})">
        <span class="chip-step-num">#${stepIdx}</span>
        <span class="chip-page-val">${pageVal}</span>
        <span class="chip-status-dot"></span>
      </div>
    `;
  }

  container.innerHTML = chipsHtml;

  // Auto-scroll timeline to keep current chip centered
  const currentChip = container.querySelector('.state-current');
  if (currentChip) {
    currentChip.scrollIntoView({ behavior: 'smooth', inline: 'center', block: 'nearest' });
  }

  // Spotlight card
  const spotPage = document.getElementById('spotlightPageChip');
  const spotStatus = document.getElementById('spotlightStatusBadge');
  const currentStepObj = history[AppState.currentStepIndex];

  if (spotPage && spotStatus) {
    if (AppState.currentStepIndex === 0) {
      spotPage.textContent = '—';
      spotStatus.textContent = 'Ready';
      spotStatus.className = 'spotlight-status';
    } else {
      spotPage.textContent = currentStepObj.page;
      spotStatus.textContent = currentStepObj.hit ? 'HIT' : 'FAULT';
      spotStatus.className = 'spotlight-status ' + (currentStepObj.hit ? 'status-cell-hit' : 'status-cell-fault');
    }
  }

  // Workspace Header Pill Badges
  const pBadge = document.getElementById('simProcessBadge');
  const fBadge = document.getElementById('simFramesBadge');
  const sBadge = document.getElementById('simStepCounterBadge');
  if (pBadge) pBadge.textContent = proc.name;
  if (fBadge) fBadge.textContent = `${proc.frameCount} Frames`;
  if (sBadge) sBadge.textContent = `Step ${AppState.currentStepIndex} / ${totalSteps}`;
}

/**
 * Renders Textbook Memory Frame Table with Sticky Column and Snapshot Cells.
 */
function renderMemoryTable() {
  const proc = getActiveProcess();
  const history = getProcessSimulation(proc);
  const table = document.getElementById('memoryFrameTable');
  if (!table) return;

  const totalSteps = proc.pages.length;
  const frameCount = proc.frameCount;

  // Header Row: Sticky Frame column + Initial Step 0 + Columns 1..N
  let html = '<thead><tr>';
  html += '<th class="sticky-col">Memory Frame</th>';
  html += '<th class="' + (AppState.currentStepIndex === 0 ? 'col-current' : '') + '">Init</th>';

  for (let s = 1; s <= totalSteps; s++) {
    const isCurrent = s === AppState.currentStepIndex;
    const page = proc.pages[s - 1];
    html += `<th class="${isCurrent ? 'col-current' : ''}">
      <div>#${s}</div>
      <div style="font-family:var(--font-mono);font-size:0.95rem;color:var(--accent-primary);">${page}</div>
    </th>`;
  }
  html += '</tr></thead><tbody>';

  // Frame Rows: Frame 0, Frame 1, ... Frame F-1
  for (let f = 0; f < frameCount; f++) {
    html += `<tr><td class="sticky-col">Frame ${f}</td>`;

    // Step 0 cell
    const initPage = history[0].frames[f];
    html += `<td class="${AppState.currentStepIndex === 0 ? 'col-current' : ''}">
      <span class="frame-cell-content cell-empty">${initPage !== null ? initPage : '—'}</span>
    </td>`;

    // Processed steps 1..N
    for (let s = 1; s <= totalSteps; s++) {
      const stepObj = history[s];
      const pageInSlot = stepObj.frames[f];
      const isCurrent = s === AppState.currentStepIndex;

      let cellClass = 'cell-empty';
      let cellText = '—';

      if (pageInSlot !== null) {
        cellText = pageInSlot;
        if (s <= AppState.currentStepIndex) {
          // If this slot was modified in this exact step
          if (stepObj.slotIndex === f && stepObj.fault) {
            cellClass = stepObj.replacedPage !== null ? 'cell-replaced' : 'cell-loaded';
          } else if (stepObj.slotIndex === f && stepObj.hit) {
            cellClass = 'cell-hit';
          } else {
            cellClass = '';
          }
        }
      }

      html += `<td class="${isCurrent ? 'col-current' : ''}">
        <span class="frame-cell-content ${cellClass}">${cellText}</span>
      </td>`;
    }
    html += '</tr>';
  }

  // Status Row: HIT / FAULT badges below table
  html += '<tr class="row-status"><td class="sticky-col">Result</td>';
  html += `<td class="${AppState.currentStepIndex === 0 ? 'col-current' : ''}">—</td>`;

  for (let s = 1; s <= totalSteps; s++) {
    const stepObj = history[s];
    const isCurrent = s === AppState.currentStepIndex;
    const isProcessed = s <= AppState.currentStepIndex;

    let statusContent = '—';
    let statusClass = '';

    if (isProcessed) {
      if (stepObj.hit) {
        statusContent = '✓ HIT';
        statusClass = 'status-cell-hit';
      } else {
        statusContent = '✗ FAULT';
        statusClass = 'status-cell-fault';
      }
    }

    html += `<td class="${statusClass} ${isCurrent ? 'col-current' : ''}">${statusContent}</td>`;
  }

  html += '</tr></tbody>';
  table.innerHTML = html;

  // Auto-scroll table to current step column
  const currentTh = table.querySelector('thead th.col-current');
  const scrollContainer = document.getElementById('frameTableScrollContainer');
  if (currentTh && scrollContainer) {
    const thLeft = currentTh.offsetLeft;
    const containerWidth = scrollContainer.clientWidth;
    scrollContainer.scrollTo({
      left: Math.max(0, thLeft - containerWidth / 2),
      behavior: 'smooth'
    });
  }
}

/**
 * Renders FIFO Queue Visualizer Card.
 */
function renderFIFOQueue() {
  const proc = getActiveProcess();
  const history = getProcessSimulation(proc);
  const currentStep = history[AppState.currentStepIndex];
  const track = document.getElementById('queueTrack');
  if (!track) return;

  const queue = currentStep.queue;

  if (queue.length === 0) {
    track.innerHTML = '<div class="queue-empty-state">Queue is empty (no resident pages loaded)</div>';
    return;
  }

  let html = '';
  for (let i = 0; i < queue.length; i++) {
    const p = queue[i];
    const isFront = i === 0;
    const isRear = i === queue.length - 1;

    let nodeClass = '';
    if (isFront) nodeClass += ' queue-node-front';
    if (isRear) nodeClass += ' queue-node-rear';

    html += `
      <div class="queue-node ${nodeClass}" title="${isFront ? 'Front (Oldest Page)' : isRear ? 'Rear (Newest Page)' : 'Resident Page'}">
        <span>${p}</span>
      </div>
    `;
  }

  track.innerHTML = html;
}

/**
 * Renders Step-by-Step Plain-English Explanation Card.
 */
function renderExplanation() {
  const proc = getActiveProcess();
  const history = getProcessSimulation(proc);
  const currentStep = history[AppState.currentStepIndex];

  const textEl = document.getElementById('explanationText');
  const stepBadge = document.getElementById('expStepBadge');
  const statusBadge = document.getElementById('expStatusBadge');
  const replacedBadge = document.getElementById('expReplacedBadge');
  const replacedVal = document.getElementById('expReplacedVal');
  const hitsCount = document.getElementById('expHitsCount');
  const faultsCount = document.getElementById('expFaultsCount');
  const ratioVal = document.getElementById('expRatioVal');

  if (textEl) textEl.textContent = currentStep.explanation;
  if (stepBadge) stepBadge.textContent = `Step ${AppState.currentStepIndex}`;

  if (statusBadge) {
    if (AppState.currentStepIndex === 0) {
      statusBadge.textContent = 'Ready';
      statusBadge.className = 'status-badge status-ready';
    } else if (currentStep.hit) {
      statusBadge.textContent = 'PAGE HIT';
      statusBadge.className = 'status-badge status-cell-hit';
    } else {
      statusBadge.textContent = 'PAGE FAULT';
      statusBadge.className = 'status-badge status-cell-fault';
    }
  }

  if (replacedBadge && replacedVal) {
    if (currentStep.replacedPage !== null) {
      replacedVal.textContent = currentStep.replacedPage;
      replacedBadge.style.display = 'inline-flex';
    } else {
      replacedBadge.style.display = 'none';
    }
  }

  if (hitsCount) hitsCount.textContent = currentStep.hitCount;
  if (faultsCount) faultsCount.textContent = currentStep.faultCount;
  if (ratioVal) ratioVal.textContent = `${currentStep.hitRatio}%`;
}

/**
 * Renders Process Selection Tabs and Active Process Editor.
 */
function renderProcessManagement() {
  const container = document.getElementById('processTabsContainer');
  const counter = document.getElementById('navProcessCount');
  const activeBadge = document.getElementById('navActiveProcessBadge');
  const headerName = document.getElementById('headerProcessName');
  const headerFrames = document.getElementById('headerProcessFrames');

  if (counter) counter.textContent = AppState.processes.length;
  if (activeBadge) activeBadge.textContent = AppState.activeProcessId;

  const activeP = getActiveProcess();
  if (headerName) headerName.textContent = activeP.name;
  if (headerFrames) headerFrames.textContent = `${activeP.frameCount} Frames`;

  if (container) {
    let tabsHtml = '';
    AppState.processes.forEach(p => {
      const isActive = p.id === AppState.activeProcessId;
      const hist = getProcessSimulation(p);
      const last = hist[hist.length - 1];

      tabsHtml += `
        <button class="process-tab-btn ${isActive ? 'active' : ''}" data-proc="${p.id}" role="tab" aria-selected="${isActive}">
          <span>${p.name}</span>
          <span class="tab-badge">${p.frameCount}F • ${last.faultCount} Miss</span>
        </button>
      `;
    });
    container.innerHTML = tabsHtml;
  }

  // Active Process Inputs
  const nameInput = document.getElementById('activeProcessNameInput');
  const frameInput = document.getElementById('activeProcessFrameInput');
  const refInput = document.getElementById('referenceStringInput');

  if (nameInput) nameInput.value = activeP.name;
  if (frameInput) frameInput.value = activeP.frameCount;
  if (refInput) refInput.value = activeP.pages.join(', ');

  // Update Reference String Preview Chips
  renderReferenceChipsPreview(activeP.pages);

  // Update All-Processes Table
  renderAllProcessesTable();
}

/**
 * Renders the preview chip strip in the Reference String Editor.
 */
function renderReferenceChipsPreview(pages) {
  const container = document.getElementById('referenceChipsPreview');
  const countEl = document.getElementById('previewChipCount');
  if (!container) return;

  if (countEl) countEl.textContent = `${pages.length} references`;

  let html = '';
  pages.forEach(p => {
    html += `<span class="preview-chip">${p}</span>`;
  });
  container.innerHTML = html;
}

/**
 * Renders All-Processes Comparison Table in Analytics.
 */
function renderAllProcessesTable() {
  const tbody = document.getElementById('allProcessesTableBody');
  if (!tbody) return;

  let html = '';
  AppState.processes.forEach(p => {
    const hist = getProcessSimulation(p);
    const last = hist[hist.length - 1];
    const isSelected = p.id === AppState.activeProcessId;

    html += `
      <tr style="${isSelected ? 'background:var(--accent-primary-soft);font-weight:600;' : ''}">
        <td><strong>${p.name}</strong> ${isSelected ? '(Active)' : ''}</td>
        <td>${p.pages.length}</td>
        <td>${p.frameCount}</td>
        <td style="color:var(--status-hit);">${last.hitCount}</td>
        <td style="color:var(--status-fault);">${last.faultCount}</td>
        <td><strong>${last.hitRatio}%</strong></td>
        <td>${last.faultRatio}%</td>
        <td>
          <button class="btn btn-outline btn-xs" onclick="switchActiveProcess('${p.id}')">
            ${isSelected ? 'Simulating' : 'Select'}
          </button>
        </td>
      </tr>
    `;
  });

  tbody.innerHTML = html;
}

/* ============================================================================
   6. BELADY'S ANOMALY DEMONSTRATION LAB
   ============================================================================ */

/**
 * Evaluates the Belady's Anomaly Lab side-by-side (3 Frames vs 4 Frames).
 */
function evaluateBeladyLab() {
  const pages = AppState.beladyString;
  const trace3 = simulateFIFO(pages, 3);
  const trace4 = simulateFIFO(pages, 4);

  const last3 = trace3[trace3.length - 1];
  const last4 = trace4[trace4.length - 1];

  const faults3 = last3.faultCount;
  const faults4 = last4.faultCount;
  const hits3 = last3.hitCount;
  const hits4 = last4.hitCount;

  const isAnomaly = faults4 > faults3;
  const diff = faults4 - faults3;

  // Update DOM elements
  const elFaults3 = document.getElementById('beladyFaults3');
  const elHits3 = document.getElementById('beladyHits3');
  const elRatio3 = document.getElementById('beladyRatio3');

  const elFaults4 = document.getElementById('beladyFaults4');
  const elHits4 = document.getElementById('beladyHits4');
  const elRatio4 = document.getElementById('beladyRatio4');

  const diffPill = document.getElementById('beladyDiffPill');
  const resultTag = document.getElementById('beladyResultTag');
  const card4 = document.getElementById('beladyCard4Frames');

  if (elFaults3) elFaults3.textContent = faults3;
  if (elHits3) elHits3.textContent = hits3;
  if (elRatio3) elRatio3.textContent = `${last3.hitRatio}%`;

  if (elFaults4) elFaults4.textContent = faults4;
  if (elHits4) elHits4.textContent = hits4;
  if (elRatio4) elRatio4.textContent = `${last4.hitRatio}%`;

  if (diffPill) {
    diffPill.textContent = diff > 0 ? `+${diff} Faults` : `${diff} Faults`;
    diffPill.style.background = isAnomaly ? 'var(--status-fault)' : 'var(--status-hit)';
  }

  if (resultTag) {
    if (isAnomaly) {
      resultTag.textContent = `Anomaly Detected (+${diff} Fault with +1 Frame!)`;
      resultTag.className = 'badge-anomaly';
    } else {
      resultTag.textContent = 'Normal Behavior (Faults Decreased or Equal)';
      resultTag.className = 'badge-special';
    }
  }

  if (card4) {
    if (isAnomaly) {
      card4.classList.add('anomaly-highlight');
    } else {
      card4.classList.remove('anomaly-highlight');
    }
  }

  // Render Mini Traces
  renderBeladyMiniTrace('beladyTrace3', trace3);
  renderBeladyMiniTrace('beladyTrace4', trace4);
}

function renderBeladyMiniTrace(elementId, trace) {
  const el = document.getElementById(elementId);
  if (!el) return;

  let html = '';
  for (let i = 1; i < trace.length; i++) {
    const step = trace[i];
    const isHit = step.hit;
    html += `<div class="mini-trace-cell ${isHit ? 'mini-trace-hit' : 'mini-trace-fault'}" title="Ref ${step.page}: ${isHit ? 'Hit' : 'Fault'}">${step.page}</div>`;
  }
  el.innerHTML = html;
}

/* ============================================================================
   7. LIVE CHART.JS VISUALIZATIONS
   ============================================================================ */

let ChartInstances = {
  donut: null,
  faultsVsFrames: null
};

/**
 * Re-renders or updates Chart.js charts cleanly without leaking canvas contexts.
 */
function updateCharts() {
  if (typeof Chart === 'undefined') return;

  const isDark = document.documentElement.getAttribute('data-theme') === 'dark';
  const textColor = isDark ? '#949CB4' : '#737B91';
  const gridColor = isDark ? 'rgba(255, 255, 255, 0.08)' : 'rgba(23, 23, 43, 0.06)';

  const proc = getActiveProcess();
  const history = getProcessSimulation(proc);
  const lastStep = history[history.length - 1];

  // 1. Donut Chart (Hits vs Faults)
  const donutCanvas = document.getElementById('hitFaultDonutChart');
  if (donutCanvas) {
    const hitVal = lastStep.hitCount;
    const faultVal = lastStep.faultCount;
    const hitPercent = lastStep.hitRatio;

    const donutHitPercentEl = document.getElementById('donutHitPercent');
    if (donutHitPercentEl) donutHitPercentEl.textContent = `${hitPercent}%`;

    const legendHitsVal = document.getElementById('legendHitsVal');
    const legendFaultsVal = document.getElementById('legendFaultsVal');
    if (legendHitsVal) legendHitsVal.textContent = hitVal;
    if (legendFaultsVal) legendFaultsVal.textContent = faultVal;

    if (ChartInstances.donut) {
      ChartInstances.donut.data.datasets[0].data = [hitVal, faultVal];
      ChartInstances.donut.update();
    } else {
      ChartInstances.donut = new Chart(donutCanvas, {
        type: 'doughnut',
        data: {
          labels: ['Page Hits', 'Page Faults'],
          datasets: [{
            data: [hitVal, faultVal],
            backgroundColor: ['#20A875', '#E65B69'],
            hoverBackgroundColor: ['#1B9266', '#D44755'],
            borderWidth: 0,
            borderRadius: 4
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          cutout: '76%',
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: isDark ? '#1C2033' : '#17172B',
              titleColor: '#FFFFFF',
              bodyColor: '#FFFFFF',
              padding: 10,
              cornerRadius: 8
            }
          }
        }
      });
    }
  }

  // 2. Faults vs Frames Curve (1 to 10 Frames)
  const lineCanvas = document.getElementById('faultsVsFramesChart');
  if (lineCanvas) {
    const rangeData = simulateFramesRange(proc.pages, 1, 10);
    const labels = rangeData.map(d => `${d.frameCount} Frames`);
    const faultsArray = rangeData.map(d => d.faults);

    // Check for Belady's Anomaly
    const anomalyPoints = rangeData.filter(d => d.isAnomaly);
    const alertBanner = document.getElementById('chartBeladyAlert');
    if (alertBanner) {
      alertBanner.style.display = anomalyPoints.length > 0 ? 'inline-block' : 'none';
    }

    // Colors: current frame count highlighted in cyan/indigo, anomaly highlighted in amber/red
    const pointColors = rangeData.map(d => {
      if (d.frameCount === proc.frameCount) return '#28B8D5'; // Current active frame
      if (d.isAnomaly) return '#E65B69'; // Belady Anomaly point
      return '#6655E8';
    });

    const pointRadius = rangeData.map(d => {
      if (d.frameCount === proc.frameCount) return 8;
      if (d.isAnomaly) return 7;
      return 5;
    });

    if (ChartInstances.faultsVsFrames) {
      ChartInstances.faultsVsFrames.data.labels = labels;
      ChartInstances.faultsVsFrames.data.datasets[0].data = faultsArray;
      ChartInstances.faultsVsFrames.data.datasets[0].pointBackgroundColor = pointColors;
      ChartInstances.faultsVsFrames.data.datasets[0].pointRadius = pointRadius;
      ChartInstances.faultsVsFrames.options.scales.x.grid.color = gridColor;
      ChartInstances.faultsVsFrames.options.scales.y.grid.color = gridColor;
      ChartInstances.faultsVsFrames.options.scales.x.ticks.color = textColor;
      ChartInstances.faultsVsFrames.options.scales.y.ticks.color = textColor;
      ChartInstances.faultsVsFrames.update();
    } else {
      ChartInstances.faultsVsFrames = new Chart(lineCanvas, {
        type: 'line',
        data: {
          labels,
          datasets: [{
            label: 'Page Faults',
            data: faultsArray,
            borderColor: '#6655E8',
            backgroundColor: 'rgba(102, 85, 232, 0.08)',
            fill: true,
            tension: 0.35,
            borderWidth: 2.5,
            pointBackgroundColor: pointColors,
            pointBorderColor: '#FFFFFF',
            pointBorderWidth: 2,
            pointRadius: pointRadius,
            pointHoverRadius: 9
          }]
        },
        options: {
          responsive: true,
          maintainAspectRatio: false,
          plugins: {
            legend: { display: false },
            tooltip: {
              backgroundColor: isDark ? '#1C2033' : '#17172B',
              titleColor: '#FFFFFF',
              bodyColor: '#FFFFFF',
              padding: 10,
              cornerRadius: 8,
              callbacks: {
                label: function(context) {
                  const idx = context.dataIndex;
                  const item = rangeData[idx];
                  let text = `Page Faults: ${item.faults} (Hit Ratio: ${item.hitRatio}%)`;
                  if (item.isAnomaly) text += ` ⚠️ Belady's Anomaly (+${item.diff} Faults!)`;
                  if (item.frameCount === proc.frameCount) text += ' (Currently Selected)';
                  return text;
                }
              }
            }
          },
          scales: {
            x: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Inter', size: 11 } }
            },
            y: {
              grid: { color: gridColor },
              ticks: { color: textColor, font: { family: 'Inter', size: 11 }, precision: 0 },
              beginAtZero: true
            }
          }
        }
      });
    }
  }

  // Update Process text indicator
  const pText = document.getElementById('analyticsCurrentProcessText');
  if (pText) pText.textContent = `${proc.name} (${proc.frameCount} Frames)`;
}

/* ============================================================================
   8. FEMALE AI VOICE ASSISTANT — AVA
   ============================================================================ */

const AVA = {
  name: 'AVA',
  synth: window.speechSynthesis || null,
  recognition: null,
  selectedVoice: null,
  isListening: false,
  isSpeaking: false,
  autoNarrateEnabled: true,
  isMuted: false,
  speechRate: 1.0,
  availableVoices: [],

  init() {
    this.initSpeechSynthesis();
    this.initSpeechRecognition();
    this.bindDOM();
  },

  initSpeechSynthesis() {
    if (!this.synth) {
      console.warn('SpeechSynthesis is not supported in this browser.');
      return;
    }

    const loadVoices = () => {
      this.availableVoices = this.synth.getVoices();
      this.populateVoiceSelect();
      this.selectBestFemaleVoice();
    };

    loadVoices();
    if (this.synth.onvoiceschanged !== undefined) {
      this.synth.onvoiceschanged = loadVoices;
    }
  },

  selectBestFemaleVoice() {
    if (this.availableVoices.length === 0) return;

    // Prioritize English female voices
    const femaleKeywords = ['female', 'samantha', 'victoria', 'zira', 'karen', 'moira', 'tessa', 'natural', 'google us english'];
    let chosen = null;

    // 1. Search for English voice with female keyword
    for (const v of this.availableVoices) {
      const lower = v.name.toLowerCase();
      if (v.lang.startsWith('en') && femaleKeywords.some(kw => lower.includes(kw))) {
        chosen = v;
        break;
      }
    }

    // 2. Fallback to any English voice
    if (!chosen) {
      chosen = this.availableVoices.find(v => v.lang.startsWith('en'));
    }

    // 3. Fallback to default system voice
    if (!chosen) {
      chosen = this.availableVoices[0];
    }

    this.selectedVoice = chosen;

    const selectEl = document.getElementById('avaVoiceSelect');
    if (selectEl && chosen) {
      selectEl.value = chosen.name;
    }
  },

  populateVoiceSelect() {
    const selectEl = document.getElementById('avaVoiceSelect');
    if (!selectEl) return;

    selectEl.innerHTML = '';
    this.availableVoices.forEach(v => {
      const opt = document.createElement('option');
      opt.value = v.name;
      opt.textContent = `${v.name} (${v.lang})`;
      selectEl.appendChild(opt);
    });
  },

  initSpeechRecognition() {
    const SpeechRec = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SpeechRec) {
      console.warn('SpeechRecognition API not available in this browser.');
      const statusText = document.getElementById('avaStateText');
      if (statusText) statusText.textContent = 'Voice Rec Unsupported';
      return;
    }

    try {
      this.recognition = new SpeechRec();
      this.recognition.continuous = false;
      this.recognition.interimResults = false;
      this.recognition.lang = 'en-US';

      this.recognition.onstart = () => {
        this.isListening = true;
        this.updateVisualizerState();
      };

      this.recognition.onresult = (event) => {
        const transcript = event.results[0][0].transcript;
        this.handleUserVoiceInput(transcript);
      };

      this.recognition.onerror = (event) => {
        console.warn('Speech recognition error:', event.error);
        this.isListening = false;
        this.updateVisualizerState();
        if (event.error === 'not-allowed') {
          this.postBotMessage('Microphone access was denied. You can still use buttons or try the "Demo Voice" feature.');
        }
      };

      this.recognition.onend = () => {
        this.isListening = false;
        this.updateVisualizerState();
      };
    } catch (e) {
      console.error('Failed to initialize SpeechRecognition:', e);
    }
  },

  toggleListening() {
    if (!this.recognition) {
      this.postBotMessage('Speech recognition is not supported in this browser. Please use the quick action buttons or UI controls.');
      return;
    }

    if (this.isListening) {
      this.recognition.stop();
    } else {
      try {
        this.stopSpeaking();
        this.recognition.start();
      } catch (e) {
        console.warn('Error starting speech recognition:', e);
      }
    }
  },

  speak(text, cancelPrior = true) {
    if (!this.synth || this.isMuted) return;

    if (cancelPrior) {
      this.synth.cancel();
    }

    const utterance = new SpeechSynthesisUtterance(text);
    if (this.selectedVoice) {
      utterance.voice = this.selectedVoice;
    }
    utterance.rate = this.speechRate;
    utterance.pitch = 1.05; // Slightly elevated pitch for friendly assistant cadence

    utterance.onstart = () => {
      this.isSpeaking = true;
      this.updateVisualizerState();
    };

    utterance.onend = () => {
      this.isSpeaking = false;
      this.updateVisualizerState();
    };

    utterance.onerror = () => {
      this.isSpeaking = false;
      this.updateVisualizerState();
    };

    this.synth.speak(utterance);
  },

  stopSpeaking() {
    if (this.synth) {
      this.synth.cancel();
      this.isSpeaking = false;
      this.updateVisualizerState();
    }
  },

  updateVisualizerState() {
    const strip = document.querySelector('.ava-visualizer-strip');
    const dot = document.getElementById('avaStateDot');
    const text = document.getElementById('avaStateText');
    const micBtn = document.getElementById('avaMicBtn');
    const micHeaderBtn = document.getElementById('headerVoiceBtn');
    const bubble = document.getElementById('avaTriggerBubble');
    const micLabel = document.getElementById('avaMicBtnLabel');

    if (this.isListening) {
      if (strip) strip.classList.add('active');
      if (dot) { dot.className = 'ava-state-dot listening'; }
      if (text) text.textContent = 'Listening...';
      if (micBtn) micBtn.classList.add('listening');
      if (micHeaderBtn) micHeaderBtn.classList.add('listening');
      if (bubble) bubble.classList.add('listening');
      if (micLabel) micLabel.textContent = 'Listening...';
    } else if (this.isSpeaking) {
      if (strip) strip.classList.add('active');
      if (dot) { dot.className = 'ava-state-dot speaking'; }
      if (text) text.textContent = 'Speaking...';
      if (micBtn) micBtn.classList.remove('listening');
      if (micHeaderBtn) micHeaderBtn.classList.remove('listening');
      if (bubble) bubble.classList.remove('listening');
      if (micLabel) micLabel.textContent = 'Tap to Speak';
    } else {
      if (strip) strip.classList.remove('active');
      if (dot) { dot.className = 'ava-state-dot'; }
      if (text) text.textContent = 'Idle';
      if (micBtn) micBtn.classList.remove('listening');
      if (micHeaderBtn) micHeaderBtn.classList.remove('listening');
      if (bubble) bubble.classList.remove('listening');
      if (micLabel) micLabel.textContent = 'Tap to Speak';
    }
  },

  postUserMessage(text) {
    const scroll = document.getElementById('avaChatScroll');
    if (!scroll) return;
    const bubble = document.createElement('div');
    bubble.className = 'ava-bubble ava-user-bubble';
    bubble.textContent = text;
    scroll.appendChild(bubble);
    scroll.scrollTop = scroll.scrollHeight;
  },

  postBotMessage(text) {
    const scroll = document.getElementById('avaChatScroll');
    if (!scroll) return;
    const bubble = document.createElement('div');
    bubble.className = 'ava-bubble ava-bot-bubble';
    bubble.innerHTML = text;
    scroll.appendChild(bubble);
    scroll.scrollTop = scroll.scrollHeight;
  },

  handleUserVoiceInput(rawText) {
    this.postUserMessage(rawText);
    const text = rawText.toLowerCase().trim();

    // Command Parser
    if (text.includes('next step') || text.includes('forward') || text.includes('advance')) {
      stepForward();
      const p = getActiveProcess();
      const s = getProcessSimulation(p)[AppState.currentStepIndex];
      const reply = `Step ${AppState.currentStepIndex}. ${s.hit ? 'Page hit' : 'Page fault'}.`;
      this.postBotMessage(reply);
      this.speak(reply);
    }
    else if (text.includes('previous step') || text.includes('back')) {
      stepBackward();
      const reply = `Stepped back to step ${AppState.currentStepIndex}.`;
      this.postBotMessage(reply);
      this.speak(reply);
    }
    else if (text.includes('start simulation') || text.includes('begin')) {
      startSimulation();
      this.postBotMessage('Starting simulation from step 0.');
    }
    else if (text.includes('play') || text.includes('resume')) {
      playSimulation();
      this.postBotMessage('Auto-play started.');
      this.speak('Auto-play started.');
    }
    else if (text.includes('pause') || text.includes('stop simulation')) {
      pauseSimulation();
      this.postBotMessage('Simulation paused.');
      this.speak('Simulation paused.');
    }
    else if (text.includes('reset')) {
      resetSimulation();
      this.postBotMessage('Simulation reset to initial state.');
      this.speak('Simulation reset.');
    }
    else if (text.includes('explain fifo') || text.includes('what is fifo')) {
      const reply = 'FIFO stands for First-In, First-Out. It replaces the memory page that has resided in memory the longest. On a hit, queue order is untouched.';
      this.postBotMessage(reply);
      this.speak(reply);
    }
    else if (text.includes('explain') || text.includes('what happened')) {
      const p = getActiveProcess();
      const s = getProcessSimulation(p)[AppState.currentStepIndex];
      this.postBotMessage(s.explanation);
      this.speak(s.explanation);
    }
    else if (text.includes('page faults') || text.includes('how many faults')) {
      const p = getActiveProcess();
      const last = getProcessSimulation(p)[AppState.currentStepIndex];
      const reply = `Process ${p.name} currently has ${last.faultCount} page faults out of ${AppState.currentStepIndex} processed references.`;
      this.postBotMessage(reply);
      this.speak(reply);
    }
    else if (text.includes('hit ratio') || text.includes('hits')) {
      const p = getActiveProcess();
      const last = getProcessSimulation(p)[AppState.currentStepIndex];
      const reply = `The hit ratio is ${last.hitRatio} percent with ${last.hitCount} page hits.`;
      this.postBotMessage(reply);
      this.speak(reply);
    }
    else if (text.includes('belady') || text.includes('anomaly')) {
      document.getElementById('belady-section')?.scrollIntoView({ behavior: 'smooth' });
      evaluateBeladyLab();
      const reply = 'Here is Belady\'s Anomaly Lab. Notice that 3 frames cause 9 faults, while 4 frames cause 10 faults!';
      this.postBotMessage(reply);
      this.speak(reply);
    }
    else if (text.includes('set frames to') || text.includes('frames')) {
      const match = text.match(/\d+/);
      if (match) {
        const count = parseInt(match[0], 10);
        if (count >= 1 && count <= 10) {
          const proc = getActiveProcess();
          proc.frameCount = count;
          invalidateSimulation(proc.id);
          resetSimulation();
          renderProcessManagement();
          updateCharts();
          const reply = `Allocated ${count} frames to ${proc.name}. Simulation updated.`;
          this.postBotMessage(reply);
          this.speak(reply);
        } else {
          const reply = 'Frames must be between 1 and 10.';
          this.postBotMessage(reply);
          this.speak(reply);
        }
      }
    }
    else if (text.includes('export csv')) {
      exportCurrentProcessCSV();
      this.postBotMessage('CSV trace exported successfully.');
      this.speak('CSV exported.');
    }
    else if (text.includes('simulator') || text.includes('open simulator')) {
      document.getElementById('simulator-section')?.scrollIntoView({ behavior: 'smooth' });
      this.postBotMessage('Opened memory simulator.');
    }
    else if (text.includes('analytics') || text.includes('show analytics')) {
      document.getElementById('analytics-section')?.scrollIntoView({ behavior: 'smooth' });
      this.postBotMessage('Opened performance analytics.');
    }
    else if (text.includes('process p1') || text.includes('select p1')) {
      switchActiveProcess('P1');
      this.postBotMessage('Switched to Process P1.');
      this.speak('Switched to Process P1.');
    }
    else if (text.includes('process p2') || text.includes('select p2')) {
      switchActiveProcess('P2');
      this.postBotMessage('Switched to Process P2.');
      this.speak('Switched to Process P2.');
    }
    else {
      const fallback = `I heard: "${rawText}". Try saying "Next step", "Play", "Set frames to 4", "Tell me the page faults", or "Explain FIFO".`;
      this.postBotMessage(fallback);
      this.speak('Command not recognized. Try saying Next step or Tell me the page faults.');
    }
  },

  bindDOM() {
    // Floating Trigger Bubble
    const bubble = document.getElementById('avaTriggerBubble');
    const card = document.getElementById('avaCard');
    const minBtn = document.getElementById('avaMinimizeBtn');
    const headerBtn = document.getElementById('headerVoiceBtn');

    const toggleAssistant = () => {
      card.classList.toggle('open');
    };

    if (bubble) bubble.addEventListener('click', toggleAssistant);
    if (minBtn) minBtn.addEventListener('click', () => card.classList.remove('open'));
    if (headerBtn) headerBtn.addEventListener('click', toggleAssistant);

    // Mic Toggle
    const micBtn = document.getElementById('avaMicBtn');
    if (micBtn) micBtn.addEventListener('click', () => this.toggleListening());

    // Demo Voice Button
    const demoBtn = document.getElementById('avaDemoSpeechBtn');
    if (demoBtn) {
      demoBtn.addEventListener('click', () => {
        const proc = getActiveProcess();
        const demoText = `Hello! I am AVA, your Operating Systems lab assistant. I am currently monitoring ${proc.name} with ${proc.frameCount} frames. You can ask me to step forward, analyze page faults, or explain Belady's Anomaly!`;
        this.postBotMessage(demoText);
        this.speak(demoText);
      });
    }

    // Voice Selector
    const voiceSelect = document.getElementById('avaVoiceSelect');
    if (voiceSelect) {
      voiceSelect.addEventListener('change', (e) => {
        const v = this.availableVoices.find(item => item.name === e.target.value);
        if (v) this.selectedVoice = v;
      });
    }

    // Voice Speed
    const speedSlider = document.getElementById('avaSpeedSlider');
    const speedVal = document.getElementById('avaSpeedVal');
    if (speedSlider) {
      speedSlider.addEventListener('input', (e) => {
        this.speechRate = parseFloat(e.target.value);
        if (speedVal) speedVal.textContent = `${this.speechRate.toFixed(2)}x`;
      });
    }

    // Auto-Narrate Checkbox
    const narrateCheck = document.getElementById('avaAutoNarrateCheckbox');
    if (narrateCheck) {
      narrateCheck.addEventListener('change', (e) => {
        this.autoNarrateEnabled = e.target.checked;
      });
    }

    // Mute Checkbox
    const muteCheck = document.getElementById('avaMuteCheckbox');
    if (muteCheck) {
      muteCheck.addEventListener('change', (e) => {
        this.isMuted = e.target.checked;
        if (this.isMuted) this.stopSpeaking();
      });
    }

    // Stop Speaking & Repeat
    const stopBtn = document.getElementById('avaStopSpeakingBtn');
    if (stopBtn) stopBtn.addEventListener('click', () => this.stopSpeaking());

    const repeatBtn = document.getElementById('avaRepeatExplanationBtn');
    if (repeatBtn) {
      repeatBtn.addEventListener('click', () => {
        const p = getActiveProcess();
        const s = getProcessSimulation(p)[AppState.currentStepIndex];
        this.speak(s.explanation);
      });
    }

    // Suggested Voice Chips
    const chipsFlex = document.getElementById('avaChipsFlex');
    if (chipsFlex) {
      chipsFlex.addEventListener('click', (e) => {
        const btn = e.target.closest('.command-chip');
        if (btn) {
          const cmd = btn.getAttribute('data-cmd');
          this.handleUserVoiceInput(cmd);
        }
      });
    }
  }
};

window.AVA = AVA;

/* ============================================================================
   9. EXPORT MANAGERS (CSV, PDF, PNG)
   ============================================================================ */

/**
 * Exports current process simulation trace as a downloadable CSV.
 */
function exportCurrentProcessCSV() {
  const proc = getActiveProcess();
  const history = getProcessSimulation(proc);

  let csv = 'FIFO LAB — Memory Simulation Trace Report\r\n';
  csv += `Process ID,${proc.id}\r\n`;
  csv += `Process Name,${proc.name}\r\n`;
  csv += `Allocated Frames,${proc.frameCount}\r\n`;
  csv += `Total References,${proc.pages.length}\r\n\r\n`;

  // Table Headers
  csv += 'Step Number,Referenced Page,';
  for (let f = 0; f < proc.frameCount; f++) {
    csv += `Frame ${f},`;
  }
  csv += 'Access Status,Replaced Page,Cumulative Hits,Cumulative Faults,Hit Ratio (%)\r\n';

  // Rows
  for (let s = 1; s < history.length; s++) {
    const step = history[s];
    csv += `${s},${step.page},`;
    for (let f = 0; f < proc.frameCount; f++) {
      const val = step.frames[f] !== null ? step.frames[f] : '';
      csv += `${val},`;
    }
    csv += `${step.hit ? 'HIT' : 'FAULT'},`;
    csv += `${step.replacedPage !== null ? step.replacedPage : 'None'},`;
    csv += `${step.hitCount},${step.faultCount},${step.hitRatio}%\r\n`;
  }

  // Summary Footer
  const final = history[history.length - 1];
  csv += '\r\n--- SUMMARY METRICS ---\r\n';
  csv += `Total References,${proc.pages.length}\r\n`;
  csv += `Total Hits,${final.hitCount}\r\n`;
  csv += `Total Faults,${final.faultCount}\r\n`;
  csv += `Final Hit Ratio,${final.hitRatio}%\r\n`;
  csv += `Final Fault Ratio,${final.faultRatio}%\r\n`;

  downloadBlob(csv, `${proc.id}_FIFO_Trace_Report.csv`, 'text/csv;charset=utf-8;');
  showToast(`Exported CSV for ${proc.name}`);
}

/**
 * Exports summary for all processes combined as CSV.
 */
function exportAllProcessesCSV() {
  let csv = 'FIFO LAB — All Processes Performance Summary\r\n\r\n';
  csv += 'Process ID,Process Name,References Count,Allocated Frames,Hits,Faults,Hit Ratio (%),Fault Ratio (%)\r\n';

  AppState.processes.forEach(p => {
    const hist = getProcessSimulation(p);
    const last = hist[hist.length - 1];
    csv += `${p.id},"${p.name}",${p.pages.length},${p.frameCount},${last.hitCount},${last.faultCount},${last.hitRatio}%,${last.faultRatio}%\r\n`;
  });

  downloadBlob(csv, 'FIFO_LAB_MultiProcess_Summary.csv', 'text/csv;charset=utf-8;');
  showToast('Exported All Processes CSV summary');
}

/**
 * Helper to download a string as a file blob.
 */
function downloadBlob(content, fileName, contentType) {
  const blob = new Blob([content], { type: contentType });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = fileName;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  URL.revokeObjectURL(url);
}

/**
 * Exports complete lab report as a PDF using html2canvas & jsPDF.
 */
async function exportLabReportPDF() {
  showToast('Generating PDF report. Please wait...');

  if (typeof window.jspdf === 'undefined' || typeof window.html2canvas === 'undefined') {
    showToast('PDF libraries unavailable. Opening browser print dialog.');
    window.print();
    return;
  }

  try {
    const { jsPDF } = window.jspdf;
    const doc = new jsPDF('p', 'pt', 'a4');
    const proc = getActiveProcess();
    const history = getProcessSimulation(proc);
    const last = history[history.length - 1];

    // Build academic report header
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(18);
    doc.setTextColor(23, 23, 43);
    doc.text('FIFO LAB — Operating Systems Page Replacement Report', 40, 50);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(115, 123, 145);
    doc.text(`Generated: ${new Date().toLocaleString()} | Educational OS Mini Project`, 40, 68);

    doc.setDrawColor(226, 230, 240);
    doc.line(40, 78, 555, 78);

    // Summary Box
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(12);
    doc.setTextColor(102, 85, 232);
    doc.text(`Workload Overview: ${proc.name} (${proc.id})`, 40, 100);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(10);
    doc.setTextColor(23, 23, 43);
    doc.text(`• Allocated Physical Frames: ${proc.frameCount}`, 40, 120);
    doc.text(`• Reference String Length: ${proc.pages.length}`, 40, 136);
    doc.text(`• Reference Sequence: ${proc.pages.slice(0, 15).join(', ')}${proc.pages.length > 15 ? '...' : ''}`, 40, 152);

    doc.text(`• Total Page Hits: ${last.hitCount}`, 300, 120);
    doc.text(`• Total Page Faults: ${last.faultCount}`, 300, 136);
    doc.text(`• Final Hit Ratio: ${last.hitRatio}% (Fault Ratio: ${last.faultRatio}%)`, 300, 152);

    // Capture Memory Frame Table snapshot using html2canvas
    const tableEl = document.getElementById('memoryFrameTable');
    if (tableEl) {
      const canvas = await html2canvas(tableEl, {
        scale: 2,
        backgroundColor: '#FFFFFF',
        logging: false
      });
      const imgData = canvas.toDataURL('image/png');
      const imgWidth = 515;
      const imgHeight = (canvas.height * imgWidth) / canvas.width;

      doc.setFont('helvetica', 'bold');
      doc.setFontSize(12);
      doc.setTextColor(23, 23, 43);
      doc.text('Memory Frame Matrix Snapshot:', 40, 180);

      doc.addImage(imgData, 'PNG', 40, 195, imgWidth, Math.min(300, imgHeight));
    }

    // Belady's Anomaly Note
    const yPos = 520;
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(230, 91, 105);
    doc.text('Belady\'s Anomaly Theoretical Viva Note:', 40, yPos);

    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(80, 85, 100);
    doc.text('Under FIFO, increasing memory frames does not guarantee reduced page faults because FIFO is not a stack algorithm.', 40, yPos + 18);
    doc.text('Example string 1,2,3,4,1,2,5,1,2,3,4,5 results in 9 faults for 3 frames and 10 faults for 4 frames.', 40, yPos + 32);

    // Save PDF
    doc.save(`${proc.id}_FIFO_Lab_Report.pdf`);
    showToast('PDF Report downloaded successfully!');
  } catch (err) {
    console.error('PDF generation error:', err);
    showToast('Failed to generate PDF. Using browser print as fallback.');
    window.print();
  }
}

/**
 * Exports memory frame table as high-res PNG image.
 */
async function exportMemoryTablePNG() {
  if (typeof window.html2canvas === 'undefined') {
    showToast('html2canvas library is unavailable.');
    return;
  }

  const tableContainer = document.getElementById('frameTableScrollContainer');
  if (!tableContainer) return;

  showToast('Generating PNG snapshot...');
  try {
    const canvas = await html2canvas(tableContainer, {
      scale: 2,
      backgroundColor: document.documentElement.getAttribute('data-theme') === 'dark' ? '#151827' : '#FFFFFF',
      logging: false
    });

    const link = document.createElement('a');
    link.download = `FIFO_Memory_Table_${getActiveProcess().id}.png`;
    link.href = canvas.toDataURL('image/png');
    link.click();
    showToast('Downloaded PNG snapshot!');
  } catch (e) {
    console.error(e);
    showToast('Could not export PNG snapshot.');
  }
}

/* ============================================================================
   10. MODALS, TOASTS & THEME MANAGEMENT
   ============================================================================ */

/**
 * Toast notifications.
 */
function showToast(msg) {
  const container = document.getElementById('toastContainer');
  if (!container) return;

  const toast = document.createElement('div');
  toast.className = 'toast';
  toast.textContent = msg;
  container.appendChild(toast);

  setTimeout(() => {
    toast.style.opacity = '0';
    toast.style.transform = 'translateY(10px)';
    setTimeout(() => {
      if (toast.parentNode) toast.parentNode.removeChild(toast);
    }, 300);
  }, 3200);
}

/**
 * Custom Confirmation Dialog.
 */
function openConfirmDialog(message, onConfirm) {
  const backdrop = document.getElementById('confirmModalBackdrop');
  const msgEl = document.getElementById('confirmModalMessage');
  const acceptBtn = document.getElementById('confirmAcceptBtn');
  const cancelBtn = document.getElementById('confirmCancelBtn');
  const closeBtn = document.getElementById('closeConfirmModalBtn');

  if (!backdrop) return;

  if (msgEl) msgEl.textContent = message;
  backdrop.style.display = 'flex';

  const close = () => {
    backdrop.style.display = 'none';
    acceptBtn.onclick = null;
  };

  acceptBtn.onclick = () => {
    close();
    onConfirm();
  };

  cancelBtn.onclick = close;
  closeBtn.onclick = close;
}

/**
 * Switches the active process.
 */
function switchActiveProcess(procId) {
  if (AppState.activeProcessId === procId) return;

  pauseSimulation();
  AppState.activeProcessId = procId;
  AppState.currentStepIndex = 0;

  renderProcessManagement();
  setSimulationStep(0);
  updateCharts();
}

/**
 * Theme Manager: Light / Dark mode sync with LocalStorage and Chart.js.
 */
function initTheme() {
  const saved = localStorage.getItem('fifo_lab_theme') || 'light';
  setTheme(saved);

  const toggleBtns = [
    document.getElementById('headerThemeBtn'),
    document.getElementById('themeToggleSidebarBtn')
  ];

  toggleBtns.forEach(btn => {
    if (btn) {
      btn.addEventListener('click', () => {
        const current = document.documentElement.getAttribute('data-theme');
        const next = current === 'dark' ? 'light' : 'dark';
        setTheme(next);
      });
    }
  });
}

function setTheme(theme) {
  AppState.theme = theme;
  document.documentElement.setAttribute('data-theme', theme);
  try {
    localStorage.setItem('fifo_lab_theme', theme);
  } catch (e) {}

  // Update Chart colors if initialized
  if (ChartInstances.donut || ChartInstances.faultsVsFrames) {
    if (ChartInstances.donut) {
      ChartInstances.donut.destroy();
      ChartInstances.donut = null;
    }
    if (ChartInstances.faultsVsFrames) {
      ChartInstances.faultsVsFrames.destroy();
      ChartInstances.faultsVsFrames = null;
    }
    updateCharts();
  }
}

/* ============================================================================
   11. INITIALIZATION & EVENT BINDINGS
   ============================================================================ */

document.addEventListener('DOMContentLoaded', () => {
  // 1. Initialize Theme
  initTheme();

  // 2. Initialize Voice Assistant
  AVA.init();

  // 3. Render initial views
  renderProcessManagement();
  setSimulationStep(0);
  evaluateBeladyLab();
  updateCharts();

  // 4. Bind Simulation Playback Controls
  document.getElementById('simStartBtn')?.addEventListener('click', () => startSimulation());
  document.getElementById('simPlayBtn')?.addEventListener('click', () => {
    if (AppState.isPlaying) {
      pauseSimulation();
    } else {
      playSimulation();
    }
  });
  document.getElementById('simNextBtn')?.addEventListener('click', () => stepForward());
  document.getElementById('simPrevBtn')?.addEventListener('click', () => stepBackward());
  document.getElementById('simResetBtn')?.addEventListener('click', () => resetSimulation());
  document.getElementById('headerResetBtn')?.addEventListener('click', () => resetSimulation());

  // Timeline Scrubber Slider
  const scrubber = document.getElementById('timelineScrubber');
  if (scrubber) {
    scrubber.addEventListener('input', (e) => {
      pauseSimulation();
      setSimulationStep(parseInt(e.target.value, 10));
    });
  }

  // Click on Timeline Chip delegation
  document.getElementById('timelineChipsWrapper')?.addEventListener('click', (e) => {
    const chip = e.target.closest('.timeline-chip');
    if (chip) {
      const step = parseInt(chip.getAttribute('data-step'), 10);
      pauseSimulation();
      setSimulationStep(step);
    }
  });

  // Playback Speed Slider
  const speedSlider = document.getElementById('speedSlider');
  const speedText = document.getElementById('speedValueText');
  if (speedSlider) {
    speedSlider.addEventListener('input', (e) => {
      AppState.playbackSpeed = parseFloat(e.target.value);
      if (speedText) speedText.textContent = `${AppState.playbackSpeed.toFixed(2)}x`;
      if (AppState.isPlaying) {
        pauseSimulation();
        playSimulation();
      }
    });
  }

  // Process Selection Tabs delegation
  document.getElementById('processTabsContainer')?.addEventListener('click', (e) => {
    const tab = e.target.closest('.process-tab-btn');
    if (tab) {
      const procId = tab.getAttribute('data-proc');
      switchActiveProcess(procId);
    }
  });

  // Active Process Frame Steppers
  const frameInput = document.getElementById('activeProcessFrameInput');
  document.getElementById('frameIncBtn')?.addEventListener('click', () => {
    if (!frameInput) return;
    let v = parseInt(frameInput.value, 10) || 3;
    if (v < 10) {
      v++;
      frameInput.value = v;
      applyFrameCountChange(v);
    }
  });
  document.getElementById('frameDecBtn')?.addEventListener('click', () => {
    if (!frameInput) return;
    let v = parseInt(frameInput.value, 10) || 3;
    if (v > 1) {
      v--;
      frameInput.value = v;
      applyFrameCountChange(v);
    }
  });
  frameInput?.addEventListener('change', (e) => {
    let v = parseInt(e.target.value, 10);
    if (isNaN(v) || v < 1) v = 1;
    if (v > 10) v = 10;
    e.target.value = v;
    applyFrameCountChange(v);
  });

  function applyFrameCountChange(newCount) {
    const proc = getActiveProcess();
    proc.frameCount = newCount;
    invalidateSimulation(proc.id);
    resetSimulation();
    renderProcessManagement();
    updateCharts();
    showToast(`Updated ${proc.name} allocation to ${newCount} frames`);
  }

  // Active Process Name edit
  document.getElementById('activeProcessNameInput')?.addEventListener('change', (e) => {
    const val = e.target.value.trim();
    if (val) {
      const proc = getActiveProcess();
      proc.name = val;
      renderProcessManagement();
    }
  });

  // Duplicate Process
  document.getElementById('duplicateProcessBtn')?.addEventListener('click', () => {
    const current = getActiveProcess();
    const newId = `P${AppState.processes.length + 1}`;
    const newProc = {
      id: newId,
      name: `${current.name} (Copy)`,
      pages: [...current.pages],
      frameCount: current.frameCount
    };
    AppState.processes.push(newProc);
    showToast(`Duplicated process as ${newProc.name}`);
    switchActiveProcess(newId);
  });

  // Delete Process
  document.getElementById('deleteProcessBtn')?.addEventListener('click', () => {
    if (AppState.processes.length <= 1) {
      showToast('Cannot delete the last remaining process!');
      return;
    }
    const current = getActiveProcess();
    openConfirmDialog(`Are you sure you want to delete ${current.name}?`, () => {
      AppState.processes = AppState.processes.filter(p => p.id !== current.id);
      invalidateSimulation(current.id);
      AppState.activeProcessId = AppState.processes[0].id;
      showToast(`Deleted ${current.name}`);
      renderProcessManagement();
      setSimulationStep(0);
      updateCharts();
    });
  });

  // Add Process Button
  document.getElementById('addNewProcessBtn')?.addEventListener('click', () => {
    const newId = `P${AppState.processes.length + 1}`;
    const newProc = {
      id: newId,
      name: `Process ${newId}`,
      pages: [7, 0, 1, 2, 0, 3, 0, 4, 2, 3],
      frameCount: 3
    };
    AppState.processes.push(newProc);
    showToast(`Created new Process ${newId}`);
    switchActiveProcess(newId);
  });

  // Reference String Apply & Clear
  const refInput = document.getElementById('referenceStringInput');
  const refValidation = document.getElementById('refValidationMsg');

  document.getElementById('applyReferenceBtn')?.addEventListener('click', () => {
    if (!refInput) return;
    const parsed = parseReferenceString(refInput.value);

    if (!parsed.valid) {
      if (refValidation) {
        refValidation.textContent = parsed.error;
        refValidation.className = 'inline-validation-msg error';
      }
      return;
    }

    if (refValidation) {
      refValidation.textContent = `Applied ${parsed.pages.length} page references successfully.`;
      refValidation.className = 'inline-validation-msg success';
      setTimeout(() => { refValidation.className = 'inline-validation-msg'; }, 3000);
    }

    const proc = getActiveProcess();
    proc.pages = parsed.pages;
    invalidateSimulation(proc.id);
    resetSimulation();
    renderProcessManagement();
    updateCharts();
  });

  document.getElementById('clearReferenceBtn')?.addEventListener('click', () => {
    if (refInput) {
      refInput.value = '';
      refInput.focus();
    }
  });

  // Preset Select
  const presetSelect = document.getElementById('presetSelect');
  if (presetSelect) {
    presetSelect.addEventListener('change', (e) => {
      const val = e.target.value;
      let pages = [];
      if (val === 'classic') {
        pages = [7, 0, 1, 2, 0, 3, 0, 4, 2, 3, 0, 3, 2, 1, 2, 0, 1, 7, 0, 1];
      } else if (val === 'belady') {
        pages = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
      } else if (val === 'locality') {
        pages = [1, 2, 3, 2, 1, 2, 3, 4, 5, 4, 5, 6, 7, 6, 7, 8, 9, 8, 9, 1];
      } else if (val === 'sequential') {
        pages = [0, 1, 2, 3, 4, 5, 6, 7, 8, 9];
      }

      if (pages.length > 0) {
        if (refInput) refInput.value = pages.join(', ');
        const proc = getActiveProcess();
        proc.pages = pages;
        invalidateSimulation(proc.id);
        resetSimulation();
        renderProcessManagement();
        updateCharts();
        showToast(`Loaded ${val.toUpperCase()} preset scenario into ${proc.name}`);
      }
      presetSelect.value = '';
    });
  }

  // Random Generator Modal
  const randomModal = document.getElementById('randomModalBackdrop');
  document.getElementById('openRandomModalBtn')?.addEventListener('click', () => {
    if (randomModal) randomModal.style.display = 'flex';
  });
  document.getElementById('closeRandomModalBtn')?.addEventListener('click', () => {
    if (randomModal) randomModal.style.display = 'none';
  });
  document.getElementById('cancelRandomModalBtn')?.addEventListener('click', () => {
    if (randomModal) randomModal.style.display = 'none';
  });

  document.getElementById('generateRandomConfirmBtn')?.addEventListener('click', () => {
    const count = parseInt(document.getElementById('randomCountInput')?.value, 10) || 20;
    const minP = parseInt(document.getElementById('randomMinInput')?.value, 10) || 0;
    const maxP = parseInt(document.getElementById('randomMaxInput')?.value, 10) || 7;
    const useSeed = document.getElementById('randomSeedCheckbox')?.checked || false;

    if (minP >= maxP || count < 3 || count > 50) {
      const msg = document.getElementById('randomValidationMsg');
      if (msg) msg.textContent = 'Invalid parameters. Ensure Min < Max and count between 3 and 50.';
      return;
    }

    const generated = generateRandomReferences(count, minP, maxP, useSeed);
    if (refInput) refInput.value = generated.join(', ');

    const proc = getActiveProcess();
    proc.pages = generated;
    invalidateSimulation(proc.id);
    resetSimulation();
    renderProcessManagement();
    updateCharts();

    if (randomModal) randomModal.style.display = 'none';
    showToast(`Generated ${count} random references.`);
  });

  // Belady's Anomaly Lab Actions
  document.getElementById('loadBeladyToSimulatorBtn')?.addEventListener('click', () => {
    const proc = getActiveProcess();
    proc.pages = [...AppState.beladyString];
    proc.frameCount = 3;
    invalidateSimulation(proc.id);
    resetSimulation();
    renderProcessManagement();
    updateCharts();
    document.getElementById('simulator-section')?.scrollIntoView({ behavior: 'smooth' });
    showToast(`Loaded Belady Anomaly sequence into ${proc.name} (3 frames)`);
  });

  document.getElementById('testBeladyBtn')?.addEventListener('click', () => {
    const input = document.getElementById('beladyStringInput');
    if (!input) return;
    const parsed = parseReferenceString(input.value);
    if (parsed.valid) {
      AppState.beladyString = parsed.pages;
      evaluateBeladyLab();
      showToast('Re-evaluated Belady anomaly sequence.');
    } else {
      showToast(parsed.error);
    }
  });

  document.getElementById('resetBeladyDefaultBtn')?.addEventListener('click', () => {
    AppState.beladyString = [1, 2, 3, 4, 1, 2, 5, 1, 2, 3, 4, 5];
    const input = document.getElementById('beladyStringInput');
    if (input) input.value = AppState.beladyString.join(', ');
    evaluateBeladyLab();
    showToast('Reset Belady sequence to classic textbook example.');
  });

  // Guide Accordion Toggle
  const toggleGuideBtn = document.getElementById('toggleGuideAccordionBtn');
  const guideBody = document.getElementById('guideContentBody');
  if (toggleGuideBtn && guideBody) {
    toggleGuideBtn.addEventListener('click', () => {
      const isHidden = guideBody.style.display === 'none';
      guideBody.style.display = isHidden ? 'block' : 'none';
      toggleGuideBtn.textContent = isHidden ? 'Collapse Guide' : 'Expand Guide';
    });
  }

  // Export Handlers
  document.getElementById('exportCurrentCsvBtn')?.addEventListener('click', exportCurrentProcessCSV);
  document.getElementById('exportAllCsvBtn')?.addEventListener('click', exportAllProcessesCSV);
  document.getElementById('exportPdfBtn')?.addEventListener('click', exportLabReportPDF);
  document.getElementById('browserPrintBtn')?.addEventListener('click', () => window.print());
  document.getElementById('exportPngBtn')?.addEventListener('click', exportMemoryTablePNG);

  // Stats Scope Switcher (Current vs All)
  document.getElementById('statsScopeCurrentBtn')?.addEventListener('click', () => {
    AppState.metricsScope = 'current';
    document.getElementById('statsScopeCurrentBtn').classList.add('active');
    document.getElementById('statsScopeAllBtn').classList.remove('active');
    renderKPIs();
  });
  document.getElementById('statsScopeAllBtn')?.addEventListener('click', () => {
    AppState.metricsScope = 'all';
    document.getElementById('statsScopeAllBtn').classList.add('active');
    document.getElementById('statsScopeCurrentBtn').classList.remove('active');
    renderKPIs();
  });

  // Global Frame Allocation Modal
  const allocModal = document.getElementById('allocationModalBackdrop');
  document.getElementById('manageAllocationBtn')?.addEventListener('click', () => {
    if (!allocModal) return;
    renderAllocationModalPreview();
    allocModal.style.display = 'flex';
  });
  document.getElementById('closeAllocModalBtn')?.addEventListener('click', () => {
    if (allocModal) allocModal.style.display = 'none';
  });
  document.getElementById('cancelAllocModalBtn')?.addEventListener('click', () => {
    if (allocModal) allocModal.style.display = 'none';
  });

  document.getElementById('globalFrameIncBtn')?.addEventListener('click', () => {
    const input = document.getElementById('globalTotalFramesInput');
    if (input) {
      let v = parseInt(input.value, 10) || 6;
      if (v < 30) { input.value = v + 1; renderAllocationModalPreview(); }
    }
  });
  document.getElementById('globalFrameDecBtn')?.addEventListener('click', () => {
    const input = document.getElementById('globalTotalFramesInput');
    if (input) {
      let v = parseInt(input.value, 10) || 6;
      if (v > AppState.processes.length) { input.value = v - 1; renderAllocationModalPreview(); }
    }
  });

  // Strategy radios change
  document.querySelectorAll('input[name="allocStrategy"]').forEach(radio => {
    radio.addEventListener('change', (e) => {
      AppState.allocationStrategy = e.target.value;
      renderAllocationModalPreview();
    });
  });

  document.getElementById('saveAllocModalBtn')?.addEventListener('click', () => {
    applyAllocationModal();
    if (allocModal) allocModal.style.display = 'none';
  });

  function renderAllocationModalPreview() {
    const totalFrames = parseInt(document.getElementById('globalTotalFramesInput')?.value, 10) || 6;
    const strategy = document.querySelector('input[name="allocStrategy"]:checked')?.value || 'equal';
    const tbody = document.getElementById('allocationPreviewBody');
    const msg = document.getElementById('allocValidationMsg');
    if (!tbody) return;

    if (totalFrames < AppState.processes.length) {
      if (msg) {
        msg.textContent = `Total frames (${totalFrames}) cannot be less than number of processes (${AppState.processes.length}).`;
        msg.className = 'inline-validation-msg error';
      }
      return;
    } else if (msg) {
      msg.className = 'inline-validation-msg';
    }

    const allocations = calculateAllocations(totalFrames, strategy);
    let html = '';
    AppState.processes.forEach((p, idx) => {
      const assigned = allocations[idx];
      html += `
        <tr>
          <td><strong>${p.name}</strong></td>
          <td>${p.pages.length}</td>
          <td>
            ${strategy === 'custom'
              ? `<input type="number" class="form-input form-input-sm custom-alloc-input" data-proc-idx="${idx}" min="1" max="15" value="${assigned}" style="width:70px;">`
              : `<strong>${assigned} Frames</strong>`}
          </td>
        </tr>
      `;
    });
    tbody.innerHTML = html;
  }

  function calculateAllocations(budget, strategy) {
    const n = AppState.processes.length;
    if (strategy === 'equal') {
      const base = Math.floor(budget / n);
      const rem = budget % n;
      return AppState.processes.map((_, i) => base + (i < rem ? 1 : 0));
    } else if (strategy === 'proportional') {
      const totalLen = AppState.processes.reduce((sum, p) => sum + p.pages.length, 0);
      let allocated = [];
      let remainders = [];
      let assignedSum = 0;

      AppState.processes.forEach((p, i) => {
        const raw = (p.pages.length / totalLen) * budget;
        const base = Math.max(1, Math.floor(raw));
        allocated[i] = base;
        assignedSum += base;
        remainders.push({ idx: i, rem: raw - base });
      });

      // Distribute any leftover
      remainders.sort((a, b) => b.rem - a.rem);
      let diff = budget - assignedSum;
      let ptr = 0;
      while (diff > 0 && ptr < remainders.length) {
        allocated[remainders[ptr].idx]++;
        diff--;
        ptr++;
      }
      return allocated;
    } else {
      // Custom: return current
      return AppState.processes.map(p => p.frameCount);
    }
  }

  function applyAllocationModal() {
    const totalFrames = parseInt(document.getElementById('globalTotalFramesInput')?.value, 10) || 6;
    const strategy = document.querySelector('input[name="allocStrategy"]:checked')?.value || 'equal';

    if (strategy === 'custom') {
      const inputs = document.querySelectorAll('.custom-alloc-input');
      let customSum = 0;
      const customVals = [];
      inputs.forEach(inp => {
        const v = parseInt(inp.value, 10) || 1;
        customVals.push(v);
        customSum += v;
      });

      AppState.processes.forEach((p, i) => {
        p.frameCount = customVals[i];
      });
      showToast(`Applied custom frame allocation across ${AppState.processes.length} processes`);
    } else {
      const allocs = calculateAllocations(totalFrames, strategy);
      AppState.processes.forEach((p, i) => {
        p.frameCount = allocs[i];
      });
      showToast(`Applied ${strategy} allocation (${totalFrames} total physical frames)`);
    }

    invalidateSimulation();
    resetSimulation();
    renderProcessManagement();
    updateCharts();
  }

  // Keyboard Shortcuts: Space (Play/Pause), ArrowRight (Next), ArrowLeft (Prev), Escape (Pause/Close)
  window.addEventListener('keydown', (e) => {
    // Suppress shortcuts while user is typing in form inputs
    const tag = e.target.tagName.toLowerCase();
    if (tag === 'input' || tag === 'textarea' || tag === 'select' || e.target.isContentEditable) {
      return;
    }

    if (e.code === 'Space') {
      e.preventDefault();
      if (AppState.isPlaying) {
        pauseSimulation();
      } else {
        playSimulation();
      }
    } else if (e.code === 'ArrowRight') {
      e.preventDefault();
      stepForward();
    } else if (e.code === 'ArrowLeft') {
      e.preventDefault();
      stepBackward();
    } else if (e.code === 'Escape') {
      pauseSimulation();
      document.querySelectorAll('.modal-backdrop').forEach(m => { m.style.display = 'none'; });
      document.getElementById('avaCard')?.classList.remove('open');
    }
  });

  // Mobile Navigation Drawer Toggle
  const mobileMenuBtn = document.getElementById('mobileMenuBtn');
  const mobileCloseBtn = document.getElementById('mobileCloseSidebarBtn');
  const sidebar = document.getElementById('appSidebar');
  const overlay = document.getElementById('sidebarOverlay');

  const openSidebar = () => {
    sidebar.classList.add('mobile-open');
    overlay.classList.add('active');
  };

  const closeSidebar = () => {
    sidebar.classList.remove('mobile-open');
    overlay.classList.remove('active');
  };

  if (mobileMenuBtn) mobileMenuBtn.addEventListener('click', openSidebar);
  if (mobileCloseBtn) mobileCloseBtn.addEventListener('click', closeSidebar);
  if (overlay) overlay.addEventListener('click', closeSidebar);

  // Sidebar navigation smooth scroll and active link highlighting
  document.querySelectorAll('.sidebar-nav .nav-link').forEach(link => {
    link.addEventListener('click', (e) => {
      document.querySelectorAll('.sidebar-nav .nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
      closeSidebar();
    });
  });
});
