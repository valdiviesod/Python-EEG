/**
 * Remote mirror — campo resonante (GalaxyGarden).
 * Data arrives via POST /api/sync from local app_server.
 *
 * Features: profile detail modal, LavaPulse 2D, MIDI playback, EEG analysis.
 * Excluded: captures, JSON upload, delete, edit, rename.
 */

(function () {
    // ── MIDI / Playback constants (same as local app) ──────────────────────
    const GARDEN_PLAYBACK_MAX_NOTES_PER_TRACK = 300;
    const GARDEN_PLAYBACK_MIN_NOTE_DURATION   = 0.15;
    const GARDEN_PLAYBACK_MAX_NOTE_DURATION   = 2.0;
    const GARDEN_PLAYBACK_MIN_SPACING         = 0.08;
    const GARDEN_PLAYBACK_SPEED               = 1;
    const GARDEN_CHANNEL_PAN                  = [-0.55, -0.18, 0.18, 0.55];
    const GARDEN_PENTATONIC                   = [0, 2, 4, 7, 9];

    const GARDEN_INSTRUMENTS = [
        'tuba',
        'slap_bass_1',
        'overdriven_guitar',
        'french_horn',
    ];
    const GARDEN_INSTRUMENT_FALLBACKS = {
        overdriven_guitar: ['distortion_guitar', 'lead_2_sawtooth', 'electric_guitar_jazz'],
    };
    const GARDEN_DEFAULT_INSTRUMENT_FALLBACKS = ['acoustic_grand_piano'];


    // ── DOM refs ────────────────────────────────────────────────────────────
    const gardenStatus        = document.getElementById('garden-status');
    const gardenStatusContent = document.getElementById('garden-status-content');
    const gardenSearchInput   = document.getElementById('garden-search-input');
    const remoteBadge         = document.getElementById('remote-garden-badge');

    const gardenModal        = document.getElementById('garden-modal');
    const gardenModalClose   = document.getElementById('garden-modal-close');
    const gardenModalTitle   = document.getElementById('garden-modal-title');
    const gardenModalMeta    = document.getElementById('garden-modal-meta');
    const gardenBtnDownloadMidi = document.getElementById('garden-btn-download-midi');
    const gardenModalTabs    = document.querySelectorAll('#garden-modal-tabs .tab');
    const gardenPanels       = document.querySelectorAll('.garden-modal-panel');

    // ── Galaxy state ────────────────────────────────────────────────────────
    let galaxyGarden       = null;
    let gardenLoaded       = false;
    let gardenLoadRequestId = 0;
    let lastSyncToken      = null;
    let pollTimer          = null;
    let nadIntroTimeline   = null;
    let nadIntroGalaxy     = null;

    // ── Modal state ─────────────────────────────────────────────────────────
    let gardenPulse2d             = null;
    let gardenAnalyzer            = null;
    let gardenCurrentFile         = null;
    let gardenCurrentJson         = null;
    let gardenCurrentProfileName  = null;
    let midiLinkedPulse           = null;
    let currentPlaybackCaptureData = null;

    // ── MIDI audio state ────────────────────────────────────────────────────
    let gardenAudioContext   = null;
    let gardenMidiTimeouts   = [];
    let gardenMidiNodes      = [];
    let gardenMidiLoopTimeout = null;
    let gardenMidiLoopId     = 0;
    let gardenInstruments    = {};
    let gardenReverbNode     = null;
    let gardenReverbGain     = null;
    let gardenDryGain        = null;
    let gardenMasterGain     = null;
    let gardenMidiFinished   = false;
    let gardenMidiPlaying    = false;
    let gardenMidiEndTimeout = null;
    const gardenSoundfontFallbackLogged = new Set();

    // ── Thumbnail queue ─────────────────────────────────────────────────────
    let captureThumbObserver = null;
    let captureThumbQueue    = Promise.resolve();

    // ═══════════════════════════════════════════════════════════════════════
    // Garden status overlay
    // ═══════════════════════════════════════════════════════════════════════

    function showGardenStatus(icon, html) {
        if (!gardenStatus || !gardenStatusContent) return;
        gardenStatus.style.display = 'flex';
        gardenStatusContent.innerHTML = `
            <div class="garden-loading-icon">${icon}</div>
            <p>${html}</p>
        `;
    }

    function hideGardenStatus() {
        if (gardenStatus) gardenStatus.style.display = 'none';
    }

    function updateBadge(meta) {
        if (!remoteBadge || !meta) return;
        const when  = meta.synced_at || 'sin sync';
        const count = meta.profile_count ?? 0;
        remoteBadge.textContent = `${count} pulsos · sync ${when}`;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // NAD intro animation
    // ═══════════════════════════════════════════════════════════════════════

    function stopNadIntroGalaxy() {
        if (nadIntroGalaxy) { nadIntroGalaxy.stop(); nadIntroGalaxy = null; }
    }

    function playNadGardenIntro() {
        const overlay = document.getElementById('nad-garden-intro');
        if (!overlay || typeof gsap === 'undefined') return Promise.resolve();
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();

        if (nadIntroTimeline) { nadIntroTimeline.kill(); nadIntroTimeline = null; }
        stopNadIntroGalaxy();

        const letters    = overlay.querySelectorAll('.nad-intro-letter');
        const wordEl     = overlay.querySelector('.nad-intro-word');
        const wordBigs   = overlay.querySelectorAll('.nad-word-big');
        const wordSmalls = overlay.querySelectorAll('.nad-word-small');
        const galaxyCanvas = document.getElementById('nad-intro-galaxy-canvas');

        gsap.set(overlay, { opacity: 0, visibility: 'visible', pointerEvents: 'auto' });
        gsap.set(letters, { opacity: 0, y: 32, scale: 1.08, filter: 'blur(18px)' });
        gsap.set(wordEl, { opacity: 0 });
        gsap.set(wordSmalls, { opacity: 0 });

        overlay.classList.add('active');
        overlay.setAttribute('aria-hidden', 'false');
        document.body.classList.add('nad-intro-active');

        if (galaxyCanvas && typeof NadIntroGalaxy !== 'undefined') {
            nadIntroGalaxy = new NadIntroGalaxy(galaxyCanvas);
            nadIntroGalaxy.start();
        }

        return new Promise(resolve => {
            nadIntroTimeline = gsap.timeline({
                defaults: { ease: 'power2.out' },
                onComplete: () => {
                    stopNadIntroGalaxy();
                    overlay.classList.remove('active');
                    overlay.setAttribute('aria-hidden', 'true');
                    document.body.classList.remove('nad-intro-active');
                    gsap.set(overlay, { clearProps: 'opacity,visibility,pointerEvents' });
                    gsap.set([...letters, wordEl, ...wordBigs, ...wordSmalls], { clearProps: 'all' });
                    nadIntroTimeline = null;
                    resolve();
                },
            });

            nadIntroTimeline
                .to(overlay, { opacity: 1, duration: 0.9, ease: 'power1.inOut' })
                .to(letters[0], { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.5, ease: 'power3.out' }, 0.45)
                .to(letters[1], { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.5, ease: 'power3.out' }, 1.55)
                .to(letters[2], { opacity: 1, y: 0, scale: 1, filter: 'blur(0px)', duration: 1.5, ease: 'power3.out' }, 2.65)
                .call(() => {
                    letters.forEach((letter, i) => {
                        const src = letter.getBoundingClientRect();
                        const tgt = wordBigs[i].getBoundingClientRect();
                        const dx  = (tgt.left + tgt.width * 0.5) - (src.left + src.width * 0.5);
                        const dy  = (tgt.top + tgt.height * 0.5) - (src.top + src.height * 0.5);
                        const sc  = tgt.height / src.height;
                        gsap.to(letter, { x: dx, y: dy, scale: sc, opacity: 0, duration: 1.1, ease: 'power2.inOut', delay: i * 0.06 });
                    });
                }, null, 4.0)
                .to(wordEl, { opacity: 1, duration: 0.55, ease: 'power2.out' }, 4.15)
                .to(wordSmalls, { opacity: 1, duration: 0.75, ease: 'power2.out', stagger: 0.14 }, 4.25)
                .to({}, { duration: 1.4 })
                .to(overlay, { opacity: 0, duration: 0.9, ease: 'power2.inOut' });
        });
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Garden load / poll
    // ═══════════════════════════════════════════════════════════════════════

    function waitForNextFrame() {
        return new Promise(resolve => requestAnimationFrame(resolve));
    }

    async function waitForGardenLayout() {
        const container = document.getElementById('garden-2d-scene');
        if (!container) return;
        for (let i = 0; i < 4; i++) {
            await waitForNextFrame();
            const rect = container.getBoundingClientRect();
            if (rect.width > 0 && rect.height > 0) return;
        }
    }

    async function loadGarden(animateProfileName = null, options = {}) {
        const { withIntro = false } = options;
        const requestId = ++gardenLoadRequestId;

        const profilesPromise = fetch('/api/profiles/list').then(resp => resp.json());
        const introPromise    = withIntro ? playNadGardenIntro() : Promise.resolve();

        let showedLoading = false;
        const loadingTimer = setTimeout(() => {
            if (requestId !== gardenLoadRequestId) return;
            if (document.body.classList.contains('nad-intro-active')) return;
            showedLoading = true;
            showGardenStatus('🌌', 'Cargando campo resonante...');
        }, 180);

        try {
            const [data] = await Promise.all([profilesPromise, introPromise]);
            clearTimeout(loadingTimer);
            if (requestId !== gardenLoadRequestId) return;

            lastSyncToken = data.sync_token || null;
            updateBadge({ synced_at: data.synced_at, profile_count: data.profiles?.length || 0 });

            if (!data.ok || !data.profiles || data.profiles.length === 0) {
                gardenLoaded = false;
                if (galaxyGarden) { galaxyGarden.destroy(); galaxyGarden = null; }
                showGardenStatus('🌌', 'Esperando datos desde la app local.<br><br>Cuando haya capturas, el campo resonante aparecerá aquí.');
                return;
            }

            if (showedLoading) hideGardenStatus();

            const container = document.getElementById('garden-2d-scene');
            if (!container) return;
            container.innerHTML = '';

            if (galaxyGarden) { galaxyGarden.destroy(); galaxyGarden = null; }

            await waitForGardenLayout();
            if (requestId !== gardenLoadRequestId) return;

            galaxyGarden = new GalaxyGarden('garden-2d-scene', (profileData) => {
                openProfileModal(profileData);
            });
            galaxyGarden.init();
            requestAnimationFrame(() => {
                if (galaxyGarden && !galaxyGarden._destroyed) galaxyGarden._onResize();
            });

            gardenLoaded = true;
            await galaxyGarden.loadProfiles(data.profiles, animateProfileName);

            if (gardenSearchInput?.value) {
                galaxyGarden.filterByName(gardenSearchInput.value);
            }
        } catch (err) {
            clearTimeout(loadingTimer);
            console.error('Error loading remote garden:', err);
            if (requestId === gardenLoadRequestId) {
                gardenLoaded = false;
                showGardenStatus('⚠️', 'Error al cargar el campo resonante remoto.');
            }
        }
    }

    async function pollForUpdates() {
        try {
            const resp = await fetch('/api/sync/meta');
            const meta = await resp.json();
            if (!meta.ok) return;

            updateBadge(meta);

            const token = meta.sync_token || '';
            if (token && token !== lastSyncToken) {
                await loadGarden(null, { withIntro: false });
            }
        } catch (err) {
            console.warn('Remote garden poll error:', err);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Profile modal — open / close
    // ═══════════════════════════════════════════════════════════════════════

    async function openProfileModal(profileData) {
        if (!profileData) return;

        const profileName = profileData.profile_name || profileData.metadata?.user_name || 'Anónimo';
        gardenCurrentProfileName = profileName;
        gardenCurrentJson        = null;
        gardenCurrentFile        = null;

        gardenModalTitle.textContent = `Perfil de ${profileName}`;
        gardenModalMeta.textContent  = 'Cargando capturas...';

        const tab2d = document.getElementById('gtab-2d');
        const tabAnalysis = document.getElementById('gtab-analysis');
        if (tab2d) tab2d.disabled = true;
        if (tabAnalysis) tabAnalysis.disabled = true;
        if (gardenBtnDownloadMidi) gardenBtnDownloadMidi.disabled = true;

        // Show captures tab
        gardenModalTabs.forEach(t => t.classList.toggle('active', t.dataset.gtab === 'garden-captures'));
        gardenPanels.forEach(p => p.classList.toggle('active', p.id === 'gpanel-garden-captures'));

        gardenModal.style.display = 'flex';

        if (gardenPulse2d) { gardenPulse2d.stop(); gardenPulse2d = null; }
        stopGardenMidiPlayback();

        try {
            const resp = await fetch(`/api/profiles/captures?name=${encodeURIComponent(profileName)}`);
            const data = await resp.json();
            if (!data.ok) throw new Error(data.error || 'No se pudieron cargar las capturas');

            const count = data.captures.length;
            gardenModalMeta.textContent = count
                ? `${count} · última: ${data.captures[0]?.capture_timestamp || '—'}`
                : 'Sin capturas';

            renderProfileCapturesList(data.captures);
        } catch (err) {
            console.error('Error loading profile captures:', err);
            const listEl = document.getElementById('profile-captures-list');
            if (listEl) listEl.innerHTML = '<p class="captures-loading">Error al cargar capturas.</p>';
        }
    }

    function closeGardenModal() {
        stopGardenMidiPlayback();
        gardenModal.style.display = 'none';
        if (midiLinkedPulse === gardenPulse2d) midiLinkedPulse = null;
        if (gardenPulse2d) { gardenPulse2d.stop(); gardenPulse2d = null; }
        gardenCurrentProfileName = null;
        gardenCurrentFile        = null;
        gardenCurrentJson        = null;

        const tab2d = document.getElementById('gtab-2d');
        const tabAnalysis = document.getElementById('gtab-analysis');
        if (tab2d) tab2d.disabled = true;
        if (tabAnalysis) tabAnalysis.disabled = true;
    }

    if (gardenModalClose) gardenModalClose.addEventListener('click', closeGardenModal);
    gardenModal?.addEventListener('click', (e) => { if (e.target === gardenModal) closeGardenModal(); });

    // ═══════════════════════════════════════════════════════════════════════
    // Modal tabs
    // ═══════════════════════════════════════════════════════════════════════

    gardenModalTabs.forEach(tab => {
        tab.addEventListener('click', () => {
            if (tab.disabled) return;
            const tabName = tab.dataset.gtab;
            gardenModalTabs.forEach(t => t.classList.toggle('active', t.dataset.gtab === tabName));
            gardenPanels.forEach(p => p.classList.toggle('active', p.id === `gpanel-${tabName}`));

            if (tabName === 'garden-2d') {
                if (gardenPulse2d) {
                    fitPulseCanvas(document.getElementById('garden-pulse-2d-canvas'));
                    gardenPulse2d.start();
                }
            } else {
                if (gardenPulse2d) gardenPulse2d.stop();
            }

            if (tabName === 'garden-captures') {
                stopGardenMidiPlayback();
            }
        });
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Capture list (read-only — no delete/edit buttons)
    // ═══════════════════════════════════════════════════════════════════════

    function captureHasEegData(data) {
        const channels = data?.eeg_channels;
        if (!channels || typeof channels !== 'object') return false;
        return Object.values(channels).some(arr => Array.isArray(arr) && arr.length >= 32);
    }

    function fitPulseCanvas(canvas) {
        const wrap = canvas && canvas.parentElement;
        if (!wrap) return;
        const dpr  = Math.min(window.devicePixelRatio || 1, 2);
        const rect  = wrap.getBoundingClientRect();
        const w     = wrap.clientWidth  || rect.width  || 700;
        const h     = wrap.clientHeight || rect.height || w;
        const size  = Math.max(320, Math.min(w, h) || w || 700);
        const bitmapW = Math.round(size * dpr);
        const bitmapH = Math.round(size * dpr);
        if (canvas.width !== bitmapW || canvas.height !== bitmapH) {
            canvas.width  = bitmapW;
            canvas.height = bitmapH;
            const ctx = canvas.getContext('2d');
            ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
    }

    function fitCaptureThumbCanvas(canvas) {
        const wrap = canvas?.parentElement;
        if (!wrap) return;
        const dpr  = Math.min(window.devicePixelRatio || 1, 2);
        const rect  = wrap.getBoundingClientRect();
        const w     = wrap.clientWidth  || rect.width  || 160;
        const h     = wrap.clientHeight || rect.height || w;
        const size  = Math.max(120, Math.round(Math.min(w, h) || w));
        const bitmapW = Math.round(size * dpr);
        const bitmapH = Math.round(size * dpr);
        if (canvas.width !== bitmapW || canvas.height !== bitmapH) {
            canvas.width  = bitmapW;
            canvas.height = bitmapH;
            const ctx = canvas.getContext('2d');
            if (ctx) ctx.setTransform(1, 0, 0, 1, 0, 0);
        }
        canvas.style.width  = '100%';
        canvas.style.height = '100%';
    }

    function drawCaptureThumbFallback(canvas, message = 'Sin señal') {
        fitCaptureThumbCanvas(canvas);
        const ctx = canvas.getContext('2d');
        if (!ctx) return;
        const w = canvas.width, h = canvas.height;
        ctx.setTransform(1, 0, 0, 1, 0, 0);
        ctx.clearRect(0, 0, w, h);
        const grd = ctx.createRadialGradient(w * 0.5, h * 0.45, 0, w * 0.5, h * 0.5, w * 0.55);
        grd.addColorStop(0, 'rgba(139,92,246,0.35)');
        grd.addColorStop(1, 'rgba(5,3,10,0.92)');
        ctx.fillStyle = grd;
        ctx.fillRect(0, 0, w, h);
        ctx.fillStyle = 'rgba(220,210,255,0.72)';
        ctx.font = `600 ${Math.max(11, Math.round(w * 0.08))}px sans-serif`;
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText(message, w / 2, h / 2);
    }

    function queueCaptureThumbnail(canvas, filename, idx) {
        captureThumbQueue = captureThumbQueue
            .then(() => renderCaptureThumbnail(canvas, filename, idx))
            .catch(err => console.error('Thumbnail queue error:', err));
    }

    function observeCaptureThumbnail(canvas, filename, idx) {
        if (!('IntersectionObserver' in window)) {
            requestAnimationFrame(() => queueCaptureThumbnail(canvas, filename, idx));
            return;
        }
        if (!captureThumbObserver) {
            captureThumbObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (!entry.isIntersecting) return;
                    const target = entry.target;
                    const meta   = target._thumbMeta;
                    captureThumbObserver.unobserve(target);
                    if (meta) queueCaptureThumbnail(target, meta.filename, meta.idx);
                });
            }, { root: null, rootMargin: '80px', threshold: 0.05 });
        }
        canvas._thumbMeta = { filename, idx };
        captureThumbObserver.observe(canvas);
    }

    async function renderCaptureThumbnail(canvas, filename, idx) {
        try {
            await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
            fitCaptureThumbCanvas(canvas);

            const resp = await fetch(`/api/garden/file?name=${encodeURIComponent(filename)}`);
            if (!resp.ok) {
                drawCaptureThumbFallback(canvas, resp.status === 404 ? 'No encontrada' : 'Error');
                return;
            }
            const data = await resp.json();
            if (!captureHasEegData(data)) {
                drawCaptureThumbFallback(canvas, 'Sin señal');
                canvas.closest('.capture-thumb-card')?.classList.add('capture-thumb-empty');
                return;
            }

            fitCaptureThumbCanvas(canvas);
            const analyzer = new EEGBandAnalyzer(data);
            const pulse    = new LavaPulse(canvas, analyzer);
            pulse.t  = pulse._startFrame + idx * 137;
            pulse.ft = pulse.t / 60;
            for (let i = 0; i < 8; i++) pulse._drawSafe();
            pulse.stop();
        } catch (err) {
            console.error('Thumbnail render error:', filename, err);
            drawCaptureThumbFallback(canvas, 'Error');
        }
    }

    function formatCaptureThumbState(state) {
        const text = (state || '').trim();
        if (text) return `<span class="capture-thumb-state">${escapeHtml(text)}</span>`;
        return '<span class="capture-thumb-state is-empty">energía</span>';
    }

    function renderProfileCapturesList(captures) {
        const listEl = document.getElementById('profile-captures-list');
        if (!listEl) return;

        if (!captures || !captures.length) {
            listEl.innerHTML = '<p class="captures-loading">No hay capturas en este perfil.</p>';
            return;
        }

        listEl.innerHTML = '';
        const grid = document.createElement('div');
        grid.className = 'capture-thumb-grid';
        listEl.appendChild(grid);

        captures.forEach((cap, idx) => {
            const ts    = cap.capture_timestamp || '—';
            const state = cap.user_state || '';

            const card = document.createElement('div');
            card.className = 'capture-thumb-card';
            card.dataset.filename  = cap.filename;
            card.dataset.userState = state;

            const canvasWrap = document.createElement('div');
            canvasWrap.className = 'capture-thumb-canvas-wrap';
            const canvas = document.createElement('canvas');
            canvas.className = 'capture-thumb-canvas';
            canvasWrap.appendChild(canvas);

            const label = document.createElement('div');
            label.className = 'capture-thumb-label';
            label.innerHTML = `<span class="capture-thumb-date">${escapeHtml(ts)}</span>`
                + formatCaptureThumbState(state);

            card.appendChild(canvasWrap);
            card.appendChild(label);
            grid.appendChild(card);

            card.addEventListener('click', () => loadCaptureIntoModal(cap.filename));

            if (!cap.total_samples || cap.total_samples < 32) {
                requestAnimationFrame(() => drawCaptureThumbFallback(canvas, 'Sin señal'));
                card.classList.add('capture-thumb-empty');
            } else {
                observeCaptureThumbnail(canvas, cap.filename, idx);
            }
        });
    }

    async function loadCaptureIntoModal(filename) {
        try {
            const resp = await fetch(`/api/garden/file?name=${encodeURIComponent(filename)}`);
            if (!resp.ok) throw new Error('No se pudo cargar la captura');
            const data = await resp.json();
            data.filename = filename;
            openGardenModalFromData(data, true);
        } catch (err) {
            console.error(err);
            alert('Error al cargar la captura: ' + err.message);
        }
    }

    function openGardenModalFromData(captureData, fromProfileList = false) {
        if (!captureData) return;

        const filename = captureData.filename || 'capture.json';
        gardenCurrentJson = captureData;
        gardenCurrentFile = filename;

        if (!fromProfileList) {
            const profileName = captureData.profile_name ||
                                captureData.metadata?.profile_name ||
                                captureData.metadata?.user_name || 'Anónimo';
            gardenCurrentProfileName = profileName;
            gardenModalTitle.textContent = `Perfil de ${profileName}`;
        }

        const tab2d = document.getElementById('gtab-2d');
        const tabAnalysis = document.getElementById('gtab-analysis');
        if (tab2d) tab2d.disabled = false;
        if (tabAnalysis) tabAnalysis.disabled = false;
        if (gardenBtnDownloadMidi) gardenBtnDownloadMidi.disabled = false;

        gardenAnalyzer = new EEGBandAnalyzer(captureData);

        const canvas2dGarden = document.getElementById('garden-pulse-2d-canvas');
        if (gardenPulse2d) { gardenPulse2d.stop(); gardenPulse2d = null; }
        gardenPulse2d = new LavaPulse(canvas2dGarden, gardenAnalyzer);

        const report = gardenAnalyzer.getReport();
        const gardenAnalysisContent = document.getElementById('garden-analysis-content');
        if (gardenAnalysisContent) gardenAnalysisContent.innerHTML = renderGardenAnalysisHTML(report);

        // Switch to 2D tab
        gardenModalTabs.forEach(t => t.classList.toggle('active', t.dataset.gtab === 'garden-2d'));
        gardenPanels.forEach(p => p.classList.toggle('active', p.id === 'gpanel-garden-2d'));

        gardenModal.style.display = 'flex';
        fitPulseCanvas(canvas2dGarden);
        gardenPulse2d.start();
        midiLinkedPulse = gardenPulse2d;

        void playGardenMidi(captureData);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MIDI download button
    // ═══════════════════════════════════════════════════════════════════════

    if (gardenBtnDownloadMidi) {
        gardenBtnDownloadMidi.addEventListener('click', async () => {
            if (!gardenCurrentJson) return;
            gardenBtnDownloadMidi.disabled = true;
            gardenBtnDownloadMidi.textContent = 'Generando MIDI...';
            try {
                const resp = await fetch('/api/json-to-midi', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ jsonData: gardenCurrentJson }),
                });
                if (!resp.ok) {
                    const err = await resp.json();
                    alert('Error: ' + (err.error || 'No se pudo generar MIDI'));
                    return;
                }
                const blob = await resp.blob();
                const safeName = (gardenCurrentFile || 'eeg').replace('.json', '');
                downloadBlob(blob, `${safeName}.mid`);
            } catch (err) {
                alert('Error: ' + err.message);
            } finally {
                gardenBtnDownloadMidi.disabled = false;
                gardenBtnDownloadMidi.innerHTML = '<span>🎵</span> Descargar MIDI';
            }
        });
    }

    // ── Replay MIDI ────────────────────────────────────────────────────────
    const gardenBtnReplayMidi = document.getElementById('garden-btn-replay-midi');
    if (gardenBtnReplayMidi) {
        gardenBtnReplayMidi.addEventListener('click', () => {
            if (currentPlaybackCaptureData) {
                startLinkedPulseForMidiReplay();
                playGardenMidi(currentPlaybackCaptureData);
            }
        });
    }

    function startLinkedPulseForMidiReplay() {
        const garden2DActive = document.getElementById('gpanel-garden-2d')?.classList.contains('active');
        const gardenVisible  = gardenModal && gardenModal.style.display !== 'none';
        let activePulse = null;
        if (gardenVisible && garden2DActive && gardenPulse2d) {
            activePulse = gardenPulse2d;
        } else {
            activePulse = midiLinkedPulse || gardenPulse2d;
        }
        if (!activePulse) return;
        midiLinkedPulse = activePulse;
        activePulse.start();
    }

    // ═══════════════════════════════════════════════════════════════════════
    // MIDI playback engine
    // ═══════════════════════════════════════════════════════════════════════

    function showReplayButtons(show) {
        const btn = document.getElementById('garden-btn-replay-midi');
        if (btn) btn.style.display = show ? 'inline-flex' : 'none';
    }

    function stopGardenMidiPlayback() {
        if (gardenMidiLoopTimeout !== null) { clearTimeout(gardenMidiLoopTimeout); gardenMidiLoopTimeout = null; }
        if (gardenMidiEndTimeout !== null)  { clearTimeout(gardenMidiEndTimeout);  gardenMidiEndTimeout  = null; }
        gardenMidiLoopId += 1;

        gardenMidiTimeouts.forEach(id => clearTimeout(id));
        gardenMidiTimeouts = [];

        gardenMidiNodes.forEach(node => {
            try { node.stop(); }       catch (_) {}
            try { node.disconnect(); } catch (_) {}
        });
        gardenMidiNodes = [];

        gardenMidiFinished = false;
        gardenMidiPlaying  = false;
        showReplayButtons(false);
    }

    function reduceTrackNotes(trackNotes, maxNotes) {
        if (trackNotes.length <= maxNotes) return trackNotes;
        if (maxNotes <= 1) return [trackNotes[0]];
        const reduced = [];
        const step = (trackNotes.length - 1) / (maxNotes - 1);
        for (let i = 0; i < maxNotes; i++) {
            reduced.push(trackNotes[Math.round(i * step)]);
        }
        return reduced;
    }

    function quantizeToPentatonic(midiNote) {
        const octave = Math.floor(midiNote / 12);
        const pc     = midiNote % 12;
        let bestPc = 0, bestDist = 99;
        for (const p of GARDEN_PENTATONIC) {
            const dist = Math.min(Math.abs(pc - p), 12 - Math.abs(pc - p));
            if (dist < bestDist) { bestDist = dist; bestPc = p; }
        }
        return octave * 12 + bestPc;
    }

    function buildGardenPlaybackPlan(midi) {
        const tracks = Array.isArray(midi?.tracks) ? midi.tracks : [];
        const playableTracks = tracks
            .map((track, trackIdx) => {
                const channel = Number.isInteger(track?.channel) ? track.channel : (trackIdx % 4);
                const notes   = Array.isArray(track?.notes) ? track.notes : [];
                if (!notes.length) return null;

                const normalizedNotes = notes.map(note => ({
                    time:     Math.max(0, Number(note.time) || 0),
                    duration: Math.max(0.01, Number(note.duration) || 0.25),
                    velocity: Math.max(0.05, Number(note.velocity) || 0.24),
                    midi:     Number(note.midi) || 60,
                    channel,
                }));
                return reduceTrackNotes(normalizedNotes, GARDEN_PLAYBACK_MAX_NOTES_PER_TRACK);
            })
            .filter(Boolean);

        if (!playableTracks.length) return null;

        let notes = playableTracks.flat().sort((a, b) => a.time - b.time);
        if (!notes.length) return null;

        notes = notes.map(n => ({
            ...n,
            midi:     Math.max(48, Math.min(84, quantizeToPentatonic(n.midi))),
            duration: Math.max(GARDEN_PLAYBACK_MIN_NOTE_DURATION,
                      Math.min(GARDEN_PLAYBACK_MAX_NOTE_DURATION, n.duration * 3)),
            velocity: Math.max(0.15, Math.min(0.55, n.velocity * 0.85)),
        }));

        const lastTimeByChannel = {};
        notes = notes.filter(n => {
            const prev = lastTimeByChannel[n.channel] ?? -Infinity;
            if (n.time - prev < GARDEN_PLAYBACK_MIN_SPACING) return false;
            lastTimeByChannel[n.channel] = n.time;
            return true;
        });

        const fallbackDuration = notes.reduce((mx, n) => Math.max(mx, n.time + n.duration), 0);
        const totalDuration    = Math.max(Number(midi?.duration) || 0, fallbackDuration, 0.5);
        const speedFactor      = GARDEN_PLAYBACK_SPEED;
        const speedNotes       = notes.map(n => ({ ...n, time: n.time / speedFactor }));
        return { notes: speedNotes, totalDuration: totalDuration / speedFactor };
    }

    function scheduleGardenMidiLoop(ctx, playbackPlan, playbackId) {
        if (!playbackPlan || !Array.isArray(playbackPlan.notes) || !playbackPlan.notes.length) return;
        if (playbackId !== gardenMidiLoopId) return;

        const notes    = playbackPlan.notes;
        const loopDuration = playbackPlan.totalDuration;
        const baseTime = ctx.currentTime + 0.05;
        gardenMidiTimeouts = [];

        const resolvedInstruments = GARDEN_INSTRUMENTS.map(
            name => gardenInstruments[name] || gardenInstruments[GARDEN_INSTRUMENTS[0]]
        );

        if (!resolvedInstruments[0]) {
            console.warn('Garden MIDI: instrument not loaded, skipping playback');
            return;
        }

        notes.forEach(note => {
            const delayMs = Math.max(0, (baseTime - ctx.currentTime + note.time) * 1000);
            const timeoutId = setTimeout(() => {
                if (playbackId !== gardenMidiLoopId) return;

                const channelIdx = Math.max(0, note.channel % 4);
                const instrument = resolvedInstruments[channelIdx];
                const gain       = note.velocity || 0.12;
                const duration   = note.duration  || 0.5;
                const midiValue  = note.midi || 60;
                const pan        = GARDEN_CHANNEL_PAN[channelIdx];

                try {
                    const player = instrument.play(midiValue, ctx.currentTime, { duration, gain });
                    if (player) {
                        try { player.disconnect(); } catch (_) {}
                        if (typeof ctx.createStereoPanner === 'function' && gardenDryGain) {
                            const panner = ctx.createStereoPanner();
                            panner.pan.setValueAtTime(pan, ctx.currentTime);
                            player.connect(panner);
                            panner.connect(gardenDryGain);
                            if (gardenReverbNode) panner.connect(gardenReverbNode);
                        } else if (gardenDryGain) {
                            player.connect(gardenDryGain);
                        }
                        gardenMidiNodes.push(player);
                        const cleanupId = setTimeout(() => {
                            const idx = gardenMidiNodes.indexOf(player);
                            if (idx >= 0) gardenMidiNodes.splice(idx, 1);
                        }, (duration + 0.5) * 1000);
                        gardenMidiTimeouts.push(cleanupId);
                    }
                } catch (e) {
                    console.warn('Garden MIDI note error:', e);
                }
            }, delayMs);
            gardenMidiTimeouts.push(timeoutId);
        });

        const endTimeMs = (loopDuration + 1.0) * 1000;
        gardenMidiEndTimeout = setTimeout(() => {
            if (playbackId === gardenMidiLoopId) {
                gardenMidiFinished = true;
                gardenMidiPlaying  = false;
                showReplayButtons(true);
                if (midiLinkedPulse) { midiLinkedPulse.stop(); midiLinkedPulse = null; }
            }
        }, endTimeMs);
        gardenMidiTimeouts.push(gardenMidiEndTimeout);
    }

    async function loadGardenSoundfontInstrument(ctx, name) {
        const candidates = [...new Set([
            name,
            ...(GARDEN_INSTRUMENT_FALLBACKS[name] || []),
            ...GARDEN_DEFAULT_INSTRUMENT_FALLBACKS,
        ])];
        let lastError = null;
        for (const candidate of candidates) {
            try {
                const inst = await Soundfont.instrument(ctx, candidate, { soundfont: 'MusyngKite', gain: 1.0 });
                if (candidate !== name && !gardenSoundfontFallbackLogged.has(name)) {
                    gardenSoundfontFallbackLogged.add(name);
                    console.warn(`Garden MIDI: soundfont "${name}" unavailable, using "${candidate}".`);
                }
                return inst;
            } catch (e) {
                lastError = e;
            }
        }
        console.warn(`Garden MIDI: no soundfont available for "${name}".`, lastError);
        return null;
    }

    async function getGardenAudioContext() {
        if (!gardenAudioContext) {
            const Ctx = window.AudioContext || window.webkitAudioContext;
            if (!Ctx) throw new Error('Web Audio API no disponible');
            gardenAudioContext = new Ctx();
        }
        if (gardenAudioContext.state === 'suspended') await gardenAudioContext.resume();

        const ctx = gardenAudioContext;

        if (!gardenMasterGain) {
            gardenMasterGain = ctx.createGain();
            gardenMasterGain.gain.value = 1.3;
            gardenMasterGain.connect(ctx.destination);

            gardenDryGain = ctx.createGain();
            gardenDryGain.gain.value = 0.85;
            gardenDryGain.connect(gardenMasterGain);

            try {
                gardenReverbNode = ctx.createConvolver();
                const irLength = ctx.sampleRate * 2.2;
                const irBuffer = ctx.createBuffer(2, irLength, ctx.sampleRate);
                for (let ch = 0; ch < 2; ch++) {
                    const data = irBuffer.getChannelData(ch);
                    for (let i = 0; i < irLength; i++) {
                        data[i] = (Math.random() * 2 - 1) * Math.pow(1 - i / irLength, 2.8);
                    }
                }
                gardenReverbNode.buffer = irBuffer;
                gardenReverbGain = ctx.createGain();
                gardenReverbGain.gain.value = 0.45;
                gardenReverbNode.connect(gardenReverbGain);
                gardenReverbGain.connect(gardenMasterGain);
            } catch (e) {
                console.warn('Garden reverb creation failed, using dry only:', e);
                gardenReverbNode = null;
                gardenReverbGain = null;
            }
        }

        if (typeof Soundfont !== 'undefined' && Object.keys(gardenInstruments).length === 0) {
            const uniqueNames = [...new Set(GARDEN_INSTRUMENTS)];
            await Promise.all(uniqueNames.map(async (name) => {
                const inst = await loadGardenSoundfontInstrument(ctx, name);
                if (inst) gardenInstruments[name] = inst;
            }));
        }

        return ctx;
    }

    async function playGardenMidi(captureData) {
        if (!captureData || typeof Midi === 'undefined') return;
        if (!captureHasEegData(captureData)) return;

        const startLoopId = gardenMidiLoopId;
        currentPlaybackCaptureData = captureData;
        gardenMidiFinished = false;
        gardenMidiPlaying  = true;
        showReplayButtons(false);

        try {
            const resp = await fetch('/api/json-to-midi', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ jsonData: captureData }),
            });
            if (!resp.ok) {
                const err = await resp.json();
                throw new Error(err.error || 'No se pudo generar MIDI');
            }
            if (startLoopId !== gardenMidiLoopId) return;

            const midi         = new Midi(await resp.arrayBuffer());
            const playbackPlan = buildGardenPlaybackPlan(midi);
            if (!playbackPlan) return;

            const ctx = await getGardenAudioContext();
            if (startLoopId !== gardenMidiLoopId) return;

            if (!gardenInstruments[GARDEN_INSTRUMENTS[0]]) {
                console.warn('Garden MIDI: soundfont instruments not available. Playback skipped.');
                return;
            }

            stopGardenMidiPlayback();
            const playbackId = gardenMidiLoopId;
            gardenMidiPlaying = true;
            scheduleGardenMidiLoop(ctx, playbackPlan, playbackId);
        } catch (err) {
            console.error('Error reproduciendo MIDI del campo resonante:', err);
        }
    }

    // ═══════════════════════════════════════════════════════════════════════
    // EEG Analysis rendering
    // ═══════════════════════════════════════════════════════════════════════

    function renderGardenAnalysisHTML(report) {
        const bands = report.bands;
        return `
        <div class="analysis-card">
            <h3>💫 Anatomía de tu Pulso</h3>
            <p style="font-size:0.85rem;color:var(--text-dim);margin-bottom:1rem;line-height:1.6">
                Cada capa de pétalos representa una banda de frecuencia cerebral calculada con precisión desde tu captura.
            </p>
            <div class="band-detail-grid">
                ${bands.map(band => renderBandCard(band)).join('')}
            </div>
        </div>
        `;
    }

    function getBandDisplayPercentage(band) {
        return Number.isFinite(band.percentage) ? band.percentage : 0;
    }

    function renderBandMeta(band) {
        return `
            <div class="band-meta">
                <div class="band-meta-row">
                    <span class="band-meta-label">Banda</span>
                    <span class="band-meta-value">${band.emoji} ${band.name} (${band.technicalName})</span>
                </div>
                <div class="band-meta-row">
                    <span class="band-meta-label">Color</span>
                    <span class="band-meta-value">
                        <span class="band-color-swatch" style="background:${band.color}"></span>${band.colorName || ''}
                    </span>
                </div>
                <div class="band-meta-row">
                    <span class="band-meta-label">Significado</span>
                    <span class="band-meta-value">${band.meaning || ''}</span>
                </div>
            </div>
        `;
    }

    function renderBandCard(band) {
        const pct = getBandDisplayPercentage(band);
        return `
            <div class="band-detail-card" data-band="${band.key}">
                <div class="band-header">
                    <div class="band-color-circle" style="background:linear-gradient(135deg, ${band.colorLight || band.color}, ${band.color})"></div>
                    <div class="band-header-copy">
                        <div class="band-title">${band.emoji} ${band.name} (${band.technicalName})</div>
                    </div>
                    <div class="band-pct" style="color:${band.color}">${pct.toFixed(1)}%</div>
                </div>
                <div class="band-power-bar">
                    <div class="band-power-fill" style="width:${Math.max(1, Math.min(100, pct))}%;background:linear-gradient(90deg, ${band.color}, ${band.colorLight || band.color})"></div>
                </div>
                ${renderBandMeta(band)}
                <div class="band-meaning">${band.description || ''}</div>
            </div>
        `;
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Utilities
    // ═══════════════════════════════════════════════════════════════════════

    function escapeHtml(str) {
        const div = document.createElement('div');
        div.textContent = str;
        return div.innerHTML;
    }

    function downloadBlob(blob, filename) {
        const url  = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href     = url;
        link.download = filename;
        link.click();
        setTimeout(() => URL.revokeObjectURL(url), 1000);
    }

    // ═══════════════════════════════════════════════════════════════════════
    // Search filter
    // ═══════════════════════════════════════════════════════════════════════

    if (gardenSearchInput) {
        gardenSearchInput.addEventListener('input', () => {
            if (galaxyGarden) galaxyGarden.filterByName(gardenSearchInput.value);
        });
        gardenSearchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                gardenSearchInput.value = '';
                if (galaxyGarden) galaxyGarden.filterByName('');
                gardenSearchInput.blur();
            }
        });
    }

    window.addEventListener('resize', () => {
        if (galaxyGarden && !galaxyGarden._destroyed) galaxyGarden._onResize();
        const gCanvas = document.getElementById('garden-pulse-2d-canvas');
        if (gardenPulse2d && gCanvas) fitPulseCanvas(gCanvas);
    });

    // ═══════════════════════════════════════════════════════════════════════
    // Boot
    // ═══════════════════════════════════════════════════════════════════════

    void loadGarden(null, { withIntro: true });
    pollTimer = window.setInterval(pollForUpdates, 5000);

    window.addEventListener('beforeunload', () => {
        if (pollTimer)          window.clearInterval(pollTimer);
        if (nadIntroTimeline)   nadIntroTimeline.kill();
        stopNadIntroGalaxy();
        stopGardenMidiPlayback();
        if (gardenPulse2d)      gardenPulse2d.stop();
        if (galaxyGarden)       galaxyGarden.destroy();
    });
})();
