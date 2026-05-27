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

    async function loadGarden(animateProfileName = null) {
        const requestId = ++gardenLoadRequestId;

        try {
            const resp = await fetch('/api/profiles/list');
            const data = await resp.json();
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

            hideGardenStatus();

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
                await loadGarden();
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

    void loadGarden();
    pollTimer = window.setInterval(pollForUpdates, 5000);

    window.addEventListener('beforeunload', () => {
        if (pollTimer) window.clearInterval(pollTimer);
        if (galaxyGarden) galaxyGarden.destroy();
    });
})();
