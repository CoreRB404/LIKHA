// Fixed image references stay separate from the artist's drawing and undo history.
(() => {
    const panel = document.getElementById("referencePanel");
    const canvas = document.getElementById("referenceCanvas");
    const context = canvas.getContext("2d");
    const container = panel.parentElement;
    const select = document.getElementById("maskReferenceSelect");
    const toggle = document.getElementById("referenceToggle");
    const choices = document.getElementById("maskReferenceChoices");
    const controls = document.getElementById("referenceControls");
    const resizeControls = document.getElementById("referenceResizeControls");
    const resize = document.getElementById("referenceResize");
    const errorMessage = document.getElementById("maskReferenceError");
    const designs = [
        { id: "blue-gold", label: "Blue & Gold", column: 0, row: 0 },
        { id: "purple-gold", label: "Purple & Gold", column: 1, row: 0 },
        { id: "turquoise-stars", label: "Turquoise & Stars", column: 0, row: 1 },
        { id: "coral-gold", label: "Coral & Gold", column: 1, row: 1 }
    ];
    let active = false;
    let hidden = false;
    let geometry = null;
    let imagePromise = null;

    designs.forEach(design => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "mask-reference-choice";
        button.dataset.maskDesign = design.id;
        button.title = design.label;
        button.setAttribute("aria-label", design.label);
        button.setAttribute("aria-pressed", "false");
        button.style.backgroundPosition = `${design.column * 100}% ${design.row * 100}%`;
        choices.appendChild(button);
    });

    function fit(next = geometry) {
        if (!active || panel.hidden) return;
        const width = container.clientWidth;
        const height = container.clientHeight;
        const extraHeight = panel.offsetHeight - canvas.getBoundingClientRect().height;
        const extraWidth = panel.offsetWidth - canvas.getBoundingClientRect().width;
        const maxWidth = Math.max(60, Math.min(width - 16, height - extraHeight + extraWidth - 16));
        const minWidth = Math.min(140, maxWidth);
        const requested = next || { width: width * 0.26, left: 12, top: 12 };
        panel.style.width = `${Math.max(minWidth, Math.min(maxWidth, requested.width))}px`;
        const left = Math.max(4, Math.min(width - panel.offsetWidth - 4, 12));
        const top = Math.max(4, Math.min(height - panel.offsetHeight - 4, 12));
        panel.style.left = `${left}px`;
        panel.style.top = `${top}px`;
        geometry = { width: panel.offsetWidth, left, top };
    }

    function setHidden(value) {
        hidden = value;
        if (!active) return;
        panel.hidden = hidden;
        toggle.textContent = hidden ? "Show mask" : "Hide mask";
        toggle.setAttribute("aria-expanded", String(!hidden));
        if (!hidden) fit();
    }

    function loadImage() {
        if (!imagePromise) {
            imagePromise = new Promise((resolve, reject) => {
                const image = new Image();
                image.onload = () => resolve(image);
                image.onerror = () => { imagePromise = null; reject(new Error("Mask sheet could not load")); };
                image.src = "festival_lab/mask.jpg";
            });
        }
        return imagePromise;
    }

    function render() {
        if (!active) return;
        errorMessage.hidden = true;
        canvas.dataset.maskDesign = "loading";
        choices.querySelectorAll("button").forEach(button => {
            button.setAttribute("aria-pressed", String(button.dataset.maskDesign === select.value));
        });
        loadImage().then(image => {
            if (!active) return;
            const design = designs.find(item => item.id === select.value) || designs[0];
            const sw = image.naturalWidth / 2;
            const sh = image.naturalHeight / 2;
            context.clearRect(0, 0, canvas.width, canvas.height);
            context.drawImage(image, design.column * sw, design.row * sh, sw, sh,
                0, 0, canvas.width, canvas.height);
            canvas.dataset.maskDesign = design.id;
            canvas.setAttribute("aria-label", `${design.label} mask reference`);
        }).catch(() => {
            if (active) errorMessage.hidden = false;
        });
    }

    function choose(id) {
        if (!designs.some(design => design.id === id)) return;
        select.value = id;
        render();
    }
    choices.addEventListener("click", event => {
        const button = event.target.closest("[data-mask-design]");
        if (button) choose(button.dataset.maskDesign);
    });
    select.addEventListener("change", render);
    toggle.addEventListener("click", () => setHidden(!hidden));
    document.getElementById("referenceHide").addEventListener("click", () => {
        setHidden(true);
        toggle.focus({ preventScroll: true });
    });
    document.getElementById("referenceLarger").addEventListener("click", () => fit({ ...geometry, width: geometry.width + 40 }));
    document.getElementById("referenceSmaller").addEventListener("click", () => fit({ ...geometry, width: geometry.width - 40 }));
    document.getElementById("referenceReset").addEventListener("click", () => { geometry = null; fit(); });

    function attachResizeControl(handle) {
        let start = null;
        handle.addEventListener("pointerdown", event => {
            if (!active || event.button !== 0) return;
            event.preventDefault();
            fit();
            start = { x: event.clientX, y: event.clientY, ...geometry };
            handle.setPointerCapture(event.pointerId);
        });
        handle.addEventListener("pointermove", event => {
            if (!start) return;
            const dx = event.clientX - start.x;
            const dy = event.clientY - start.y;
            fit({ ...start, width: start.width + (dx + dy) / 2 });
        });
        const stop = () => { start = null; };
        handle.addEventListener("pointerup", stop);
        handle.addEventListener("pointercancel", stop);
        handle.addEventListener("lostpointercapture", stop);
        handle.addEventListener("keydown", event => {
            if (!active || !event.key.startsWith("Arrow")) return;
            event.preventDefault();
            const dx = event.key === "ArrowRight" ? 12 : event.key === "ArrowLeft" ? -12 : 0;
            const dy = event.key === "ArrowDown" ? 12 : event.key === "ArrowUp" ? -12 : 0;
            fit({ ...geometry, width: geometry.width + dx + dy });
        });
    }
    attachResizeControl(resize);
    window.addEventListener("resize", () => fit());

    window.LikhaMaskReference = {
        activate() {
            active = true;
            panel.classList.add("is-interactive");
            canvas.width = 600;
            canvas.height = 600;
            controls.hidden = choices.hidden = resizeControls.hidden = toggle.hidden = false;
            setHidden(hidden);
            render();
            requestAnimationFrame(() => fit());
        },
        deactivate() {
            active = false;
            panel.classList.remove("is-interactive");
            controls.hidden = choices.hidden = resizeControls.hidden = toggle.hidden = true;
            errorMessage.hidden = true;
            panel.style.removeProperty("width");
            panel.style.removeProperty("left");
            panel.style.removeProperty("top");
            canvas.width = 1000;
            canvas.height = 700;
        }
    };
})();
