/**
 * Remote mirror — campo resonante (GalaxyGarden only).
 * Data arrives via POST /api/sync from local app_server.
 */

(function () {
    let galaxyGarden = null;
    let gardenLoaded = false;
    let gardenLoadRequestId = 0;
    let lastSyncToken = null;
    let pollTimer = null;
    let nadIntroTimeline = null;
    let nadIntroGalaxy = null;

    const gardenStatus = document.getElementById('garden-status');
    const gardenStatusContent = document.getElementById('garden-status-content');
    const gardenSearchInput = document.getElementById('garden-search-input');
    const remoteBadge = document.getElementById('remote-garden-badge');

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
        const when = meta.synced_at || 'sin sync';
        const count = meta.profile_count ?? 0;
        remoteBadge.textContent = `${count} pulsos · sync ${when}`;
    }

    function stopNadIntroGalaxy() {
        if (nadIntroGalaxy) {
            nadIntroGalaxy.stop();
            nadIntroGalaxy = null;
        }
    }

    function playNadGardenIntro() {
        const overlay = document.getElementById('nad-garden-intro');
        if (!overlay || typeof gsap === 'undefined') return Promise.resolve();
        if (window.matchMedia('(prefers-reduced-motion: reduce)').matches) return Promise.resolve();

        if (nadIntroTimeline) {
            nadIntroTimeline.kill();
            nadIntroTimeline = null;
        }
        stopNadIntroGalaxy();

        const letters = overlay.querySelectorAll('.nad-intro-letter');
        const wordEl = overlay.querySelector('.nad-intro-word');
        const wordBigs = overlay.querySelectorAll('.nad-word-big');
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
                        const dx = (tgt.left + tgt.width * 0.5) - (src.left + src.width * 0.5);
                        const dy = (tgt.top + tgt.height * 0.5) - (src.top + src.height * 0.5);
                        const sc = tgt.height / src.height;
                        gsap.to(letter, {
                            x: dx, y: dy, scale: sc,
                            opacity: 0,
                            duration: 1.1,
                            ease: 'power2.inOut',
                            delay: i * 0.06,
                        });
                    });
                }, null, 4.0)
                .to(wordEl, { opacity: 1, duration: 0.55, ease: 'power2.out' }, 4.15)
                .to(wordSmalls, { opacity: 1, duration: 0.75, ease: 'power2.out', stagger: 0.14 }, 4.25)
                .to({}, { duration: 1.4 })
                .to(overlay, { opacity: 0, duration: 0.9, ease: 'power2.inOut' });
        });
    }

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
        const introPromise = withIntro ? playNadGardenIntro() : Promise.resolve();

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
            updateBadge({
                synced_at: data.synced_at,
                profile_count: data.profiles?.length || 0,
            });

            if (!data.ok || !data.profiles || data.profiles.length === 0) {
                gardenLoaded = false;
                if (galaxyGarden) {
                    galaxyGarden.destroy();
                    galaxyGarden = null;
                }
                showGardenStatus('🌌', 'Esperando datos desde la app local.<br><br>Cuando haya capturas, el campo resonante aparecerá aquí.');
                return;
            }

            if (showedLoading) hideGardenStatus();

            const container = document.getElementById('garden-2d-scene');
            if (!container) return;
            container.innerHTML = '';

            if (galaxyGarden) {
                galaxyGarden.destroy();
                galaxyGarden = null;
            }

            await waitForGardenLayout();
            if (requestId !== gardenLoadRequestId) return;

            galaxyGarden = new GalaxyGarden('garden-2d-scene', () => {
                // Visualización remota: sin modal de detalle.
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
    });

    void loadGarden(null, { withIntro: true });
    pollTimer = window.setInterval(pollForUpdates, 5000);

    window.addEventListener('beforeunload', () => {
        if (pollTimer) window.clearInterval(pollTimer);
        if (nadIntroTimeline) nadIntroTimeline.kill();
        stopNadIntroGalaxy();
        if (galaxyGarden) galaxyGarden.destroy();
    });
})();
