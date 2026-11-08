(() => {
    const canvas = document.getElementById("artCanvas");
    const ctx = canvas.getContext("2d");
    const referenceCanvas = document.getElementById("referenceCanvas");
    const referenceContext = referenceCanvas.getContext("2d");
    const referencePanel = document.getElementById("referencePanel");
    const referenceTutorial = document.getElementById("referenceTutorial");
    const referenceVideo = document.getElementById("referenceVideo");
    const referenceNext = document.getElementById("referenceNext");
    const referenceVideoError = document.getElementById("referenceVideoError");
    const referenceVideoLink = document.getElementById("referenceVideoLink");
    const craftWorkspace = document.getElementById("craftWorkspace");
    const tutorialBack = document.getElementById("tutorialBack");
    const tutorialTitle = document.getElementById("craftTutorialTitle");
    const materialsList = document.getElementById("craftMaterialsList");
    const studioLayout = document.querySelector(".studio-layout");
    const tutorialVideos = {
      craft: {
        basket: "craftlab/Basket.mp4",
        banig: "craftlab/Banig_v3.mp4",
        fan: "craftlab/Fan.mp4",
        pot: "craftlab/claypot.mp4"
      },
      festival: { parol: "festival_lab/paper%20parol.mov" }
    };
    const tutorialMaterials = {
        basket: ["Colored paper strips", "Paper or cardstock for a circular base and handle", "Glue", "Scissors", "Ruler and pencil"],
        banig: ["White paper for the mat base", "Colored paper for weaving strips", "Scissors", "Pencil", "Ruler or straightedge", "Glue for securing the edges"],
        fan: ["Colored paper", "Craft sticks", "Thread and a small needle", "Glue", "Scissors and pencil"],
        pot: ["Clay (about 450 g)", "A small bowl of water", "A damp cloth", "A flat work surface"],
        parol: ["Colored paper (square sheet)", "Scissors", "Ruler or straightedge (optional)", "String or ribbon for hanging (optional)"]
    };
    let currentTutorial = null;
    let currentReferenceType = null;

    function resetReferenceTutorial(type) {
        referenceVideo.pause();
        if (referenceVideo.hasAttribute("src")) {
            referenceVideo.removeAttribute("src");
            referenceVideo.load();
        }
        currentTutorial = tutorialVideos[selectedLab]?.[type] || null;
        currentReferenceType = type;
        studioLayout.classList.remove("is-tutorial");
        referenceCanvas.hidden = false;
        craftWorkspace.hidden = false;
        referenceTutorial.hidden = true;
        referenceVideoError.hidden = true;
        referenceNext.hidden = !currentTutorial;
        referenceNext.textContent = "Tutorial →";
        referenceNext.setAttribute("aria-expanded", "false");
    }

    referenceNext.addEventListener("click", () => {
        if (!currentTutorial) return;
        if (!referenceVideo.hasAttribute("src")) {
            referenceVideo.preload = "metadata";
            referenceVideo.src = currentTutorial;
            referenceVideoLink.href = currentTutorial;
            referenceVideo.setAttribute("aria-label", `${labels[currentReferenceType]} tutorial`);
        }
        tutorialTitle.textContent = `${labels[currentReferenceType]} tutorial`;
        materialsList.replaceChildren(...(tutorialMaterials[currentReferenceType] || []).map(material => {
            const item = document.createElement("li");
            item.textContent = material;
            return item;
        }));
        craftWorkspace.hidden = true;
        referenceTutorial.hidden = false;
        studioLayout.classList.add("is-tutorial");
        referenceNext.setAttribute("aria-expanded", "true");
        tutorialBack.focus({ preventScroll: true });
    });
    tutorialBack.addEventListener("click", () => {
        referenceVideo.pause();
        referenceTutorial.hidden = true;
        craftWorkspace.hidden = false;
        studioLayout.classList.remove("is-tutorial");
        referenceNext.setAttribute("aria-expanded", "false");
        referenceNext.focus({ preventScroll: true });
    });
    referenceVideo.addEventListener("error", () => {
        if (referenceVideo.hasAttribute("src")) referenceVideoError.hidden = false;
    });
    window.addEventListener("pagehide", () => referenceVideo.pause());

    const colorPicker = document.getElementById("colorPicker");
    const brushSize = document.getElementById("brushSize");
    const brushSizeValue = document.getElementById("brushSizeValue");
    const statusMessage = document.getElementById("statusMessage");
    const templateSelect = document.getElementById("templateSelect");
    const maskReferenceOptions = document.getElementById("maskReferenceOptions");
    const maskReferenceSelect = document.getElementById("maskReferenceSelect");
    const templateGallery = document.getElementById("templateGallery");
    const patternGallery = document.getElementById("patternGallery");

    const labs = {
        fashion: {
            title: "👗 Fashion Lab",
            description: "Design original clothing inspired by Filipino textiles, colors, patterns, and traditions.",
            templates: ["shirt", "dress", "barong", "malong"],
            patterns: [
                { key: "inabel", label: "Inabel", style: "diamonds" },
                { key: "tnalak", label: "T'nalak", style: "waves" },
                { key: "yakan", label: "Yakan", style: "florals" },
                { key: "cordillera", label: "Cordillera", style: "sunbursts" }
            ]
        },
        festival: {
            title: "🎉 Festival Lab",
            description: "Create decorations inspired by Filipino festivals and celebrations.",
            templates: ["parol", "mask"],
            patterns: [
                { key: "fiesta", label: "Fiesta", style: "sunbursts" },
                { key: "sunburst", label: "Sunburst", style: "sunbursts" },
                { key: "floral", label: "Floral", style: "florals" },
                { key: "geometric", label: "Geometric", style: "diamonds" }
            ]
        },
        craft: {
            title: "🧺 Craft Lab",
            description: "Explore handmade objects and woven patterns.",
            templates: ["basket", "banig", "fan", "pot"],
            patterns: [
                { key: "bamboo", label: "Bamboo", style: "waves" },
                { key: "crossweave", label: "Crossweave", style: "crossweave" },
                { key: "diamond", label: "Diamond", style: "diamonds" },
                { key: "checker", label: "Checker", style: "checker" }
            ]
        },
        art: {
            title: "🎨 Art Lab",
            description: "Express Filipino identity, culture, and creativity through art.",
            templates: ["blank", "flower", "house", "mountain"],
            patterns: [
                { key: "dots", label: "Dots", style: "dots" },
                { key: "stripes", label: "Stripes", style: "stripes" },
                { key: "hearts", label: "Hearts", style: "hearts" },
                { key: "stars", label: "Stars", style: "stars" }
            ]
        }
    };

    const requestedLab = new URLSearchParams(window.location.search).get("lab");
    let storedLab = "art";
    try {
        storedLab = localStorage.getItem("selectedLab") || "art";
    } catch (error) {
        console.warn("Using the lab from the URL:", error);
    }
    if (labs[requestedLab]) storedLab = requestedLab;
    const selectedLab = labs[storedLab] ? storedLab : "art";
    const lab = labs[selectedLab];

    // Apply the correct visual theme for the selected lab
    const activeLab = labs[selectedLab] ? selectedLab : "art";

    document.body.classList.remove(
        "lab-fashion",
        "lab-festival",
        "lab-craft",
        "lab-art"
    );

    document.body.classList.add(`lab-${activeLab}`);
    document.getElementById("labTitle").textContent = lab.title;
    document.getElementById("labDescription").textContent = lab.description;

    const labels = {
        blank: "Blank Canvas",
        shirt: "T-Shirt",
        dress: "Dress",
        barong: "Barong",
        malong: "Malong",
        parol: "Parol",
        mask: "Festival Mask",
        flower: "Flower",
        craft: "Craft Pattern",
        basket: "Basket",
        banig: "Banig",
        fan: "Fan",
        pot: "Pot",
        house: "House",
        mountain: "Mountain"
    };

    const templateIcons = {
        blank: "▢",
        shirt: "👕",
        dress: "👗",
        barong: "🥼",
        malong: "🧣",
        parol: "🏮",
        mask: "🎭",
        flower: "🌺",
        craft: "🧶",
        basket: "🧺",
        banig: "▦",
        fan: "🪭",
        pot: "🏺",
        house: "🏠",
        mountain: "🏞️"
    };

    const patterns = lab.patterns;
    let selectedPattern = patterns[0].key;
    const patternTiles = new Map();
    document.getElementById("applyPatternBtn").hidden = true;
    document.getElementById("patternInstructions").textContent = "Draw a closed outline, choose a pattern below, then click inside your drawing. The outline and background stay unchanged. Draw resumes automatically.";
    document.getElementById("applyPatternBtn").setAttribute("aria-pressed", "false");

    templateSelect.innerHTML = "";

    lab.templates.forEach(key => {
        const option = document.createElement("option");
        option.value = key;
        option.textContent = labels[key];
        templateSelect.appendChild(option);
    });

    function createTemplatePreview(type) {
        const preview = document.createElement("span");
        preview.className = "template-card-icon";
        preview.setAttribute("aria-hidden", "true");
        preview.textContent = templateIcons[type];
        return preview;
    }

    function getPatternTile(pattern) {
        if (patternTiles.has(pattern.key)) return patternTiles.get(pattern.key);
        const tile = document.createElement("canvas");
        tile.width = tile.height = 64;
        const ink = tile.getContext("2d");
        const palette = [
            ["#243d70", "#ef8354", "#ffd166"],
            ["#1c2440", "#d32f2f", "#fca311"],
            ["#202a44", "#e4572e", "#f3a712"],
            ["#182b52", "#b83b5e", "#ffdf8c"]
        ][patterns.findIndex(item => item.key === pattern.key) % 4];
        ink.fillStyle = palette[0];
        ink.fillRect(0, 0, 64, 64);
        ink.strokeStyle = palette[1];
        ink.fillStyle = palette[2];
        ink.lineWidth = 4;
        ink.lineJoin = "round";
        const line = (x,y,ex,ey) => {ink.beginPath();ink.moveTo(x,y);ink.lineTo(ex,ey);ink.stroke();};
        const star = (points, outer, inner) => {
            ink.beginPath();
            for(let i=0;i<points*2;i++){
                const angle=i*Math.PI/points-Math.PI/2;
                const radius=i%2 ? inner : outer;
                const x=32+Math.cos(angle)*radius,y=32+Math.sin(angle)*radius;
                if(i===0)ink.moveTo(x,y);else ink.lineTo(x,y);
            }
            ink.closePath();ink.fill();ink.stroke();
        };
        if(pattern.style === "diamonds") {
            for(let offset=-64;offset<=64;offset+=32){
                ink.strokeStyle=palette[1];line(offset,0,offset+64,64);
                ink.strokeStyle=palette[2];line(offset,64,offset+64,0);
            }
        } else if(pattern.style === "waves") {
            for(let y=0;y<=64;y+=16){
                ink.strokeStyle=y%32===0?palette[1]:palette[2];ink.beginPath();
                for(let x=0;x<=64;x++){
                    const py=y+Math.sin(x*Math.PI/32)*5;
                    if(x===0)ink.moveTo(x,py);else ink.lineTo(x,py);
                }
                ink.stroke();
            }
        } else if(pattern.style === "stripes") {
            for(let x=-64;x<=64;x+=16){ink.strokeStyle=x%32===0?palette[1]:palette[2];line(x,0,x+64,64);}
        } else if(pattern.style === "checker") {
            for(let y=0;y<4;y++)for(let x=0;x<4;x++){
                ink.fillStyle=(x+y)%2?palette[1]:palette[2];ink.fillRect(x*16,y*16,16,16);
            }
        } else if(pattern.style === "crossweave") {
            for(let n=0;n<=64;n+=16){ink.strokeStyle=palette[1];line(n,0,n,64);ink.strokeStyle=palette[2];line(0,n,64,n);}
            ink.lineWidth=2;
            for(let y=0;y<64;y+=32)for(let x=0;x<64;x+=32){line(x,y,x+32,y+32);line(x+32,y,x,y+32);}
        } else if(pattern.style === "dots") {
            for(const y of [16,48])for(const x of [16,48]){ink.beginPath();ink.arc(x,y,6,0,Math.PI*2);ink.fill();}
        } else if(pattern.style === "hearts") {
            ink.beginPath();ink.moveTo(32,51);ink.bezierCurveTo(0,30,10,9,32,23);ink.bezierCurveTo(54,9,64,30,32,51);ink.fill();ink.stroke();
        } else if(pattern.style === "florals") {
            for(let n=0;n<6;n++){
                const angle=n*Math.PI/3;ink.beginPath();
                ink.ellipse(32+Math.cos(angle)*13,32+Math.sin(angle)*13,7,12,angle+Math.PI/2,0,Math.PI*2);
                ink.fillStyle=palette[1];ink.fill();
            }
            ink.fillStyle=palette[2];ink.beginPath();ink.arc(32,32,7,0,Math.PI*2);ink.fill();
        } else if(pattern.style === "stars") {
            star(5,23,10);
        } else {
            // Sunburst motif used by the festival and Cordillera-inspired cards.
            ink.beginPath();ink.arc(32,32,10,0,Math.PI*2);ink.fill();
            for(let n=0;n<12;n++){const a=n*Math.PI/6;line(32+Math.cos(a)*16,32+Math.sin(a)*16,32+Math.cos(a)*25,32+Math.sin(a)*25);}
        }
        patternTiles.set(pattern.key,tile);
        return tile;
    }

    function createPatternPreview(pattern) {
        const preview = document.createElement("span");
        preview.className = "pattern-preview";
        preview.setAttribute("aria-hidden", "true");
        preview.style.backgroundImage = `url("${getPatternTile(pattern).toDataURL()}")`;
        preview.style.backgroundSize = "32px 32px";
        return preview;
    }

    lab.templates.forEach(key => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "template-card";
        button.dataset.template = key;
        button.setAttribute("aria-pressed", "false");

        const label = document.createElement("span");
        label.textContent = labels[key];

        button.append(createTemplatePreview(key), label);
        templateGallery.appendChild(button);
    });

    patterns.forEach((pattern, index) => {
        const button = document.createElement("button");
        button.type = "button";
        button.className = "pattern-card";
        button.dataset.pattern = pattern.key;
        button.setAttribute("aria-pressed", "false");

        const label = document.createElement("span");
        label.textContent = pattern.label;

        button.append(createPatternPreview(pattern, index), label);
        patternGallery.appendChild(button);
    });

    templateSelect.value = {
        fashion: "shirt",
        festival: "parol",
        craft: "basket",
        art: "blank"
    }[selectedLab] || "blank";

    templateGallery.querySelectorAll("[data-template]").forEach(card => {
        const isSelected = card.dataset.template === templateSelect.value;
        card.classList.toggle("selected", isSelected);
        card.setAttribute("aria-pressed", String(isSelected));
    });

    patternGallery.querySelectorAll("[data-pattern]").forEach(card => {
        const isSelected = card.dataset.pattern === selectedPattern;
        card.classList.toggle("selected", isSelected);
        card.setAttribute("aria-pressed", String(isSelected));
    });

    let color = colorPicker.value;
    let mode = "draw";
    let drawing = false;
    let lastPoint = null;
    let history = [];

    function selectMode(nextMode) {
        mode = nextMode;
        const filling = mode === "pattern-fill";
        document.getElementById("drawMode").classList.toggle("active", mode === "draw");
        document.getElementById("drawMode").setAttribute("aria-pressed", String(mode === "draw"));
        document.getElementById("applyPatternBtn").setAttribute("aria-pressed", String(filling));
        canvas.style.cursor = filling ? "copy" : "crosshair";
        const badge = document.getElementById("canvasToolStatus");
        badge.textContent = filling ? "Pattern: click inside your drawing" : mode === "draw" ? "Draw: drag on the canvas" : "Click to add " + mode;
    }

    function say(message) {
        statusMessage.textContent = message;
    }

    function saveHistory() {
        try {
            history.push(ctx.getImageData(0, 0, canvas.width, canvas.height));

            if (history.length > 30) {
                history.shift();
            }
        } catch (error) {
            // Continue working if browser memory is limited.
        }
    }

    function resetCanvas() {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        ctx.fillStyle = "#ffffff";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
    }

    function pointFromEvent(event) {
        const rect = canvas.getBoundingClientRect();

        return {
            x: (event.clientX - rect.left) * (canvas.width / rect.width),
            y: (event.clientY - rect.top) * (canvas.height / rect.height)
        };
    }

    function drawLine(start, end) {
        ctx.strokeStyle = color;
        ctx.lineWidth = Number(brushSize.value);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        ctx.beginPath();
        ctx.moveTo(start.x, start.y);
        ctx.lineTo(end.x, end.y);
        ctx.stroke();
    }

    function drawStar(x, y, outer = 55, inner = 24, points = 5, ctx = canvas.getContext("2d")) {
        ctx.beginPath();

        for (let i = 0; i < points * 2; i++) {
            const radius = i % 2 === 0 ? outer : inner;
            const angle = Math.PI * i / points - Math.PI / 2;
            const px = x + Math.cos(angle) * radius;
            const py = y + Math.sin(angle) * radius;

            if (i === 0) {
                ctx.moveTo(px, py);
            } else {
                ctx.lineTo(px, py);
            }
        }

        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    function drawHeart(x, y, size = 48, ctx = canvas.getContext("2d")) {
        ctx.save();
        ctx.translate(x, y);
        ctx.scale(size / 100, size / 100);

        ctx.beginPath();
        ctx.moveTo(0, 30);
        ctx.bezierCurveTo(-55, -5, -35, -45, 0, -20);
        ctx.bezierCurveTo(35, -45, 55, -5, 0, 30);
        ctx.fillStyle = color;
        ctx.fill();

        ctx.restore();
    }

    function drawFlower(x, y, size = 42) {
        ctx.save();
        ctx.fillStyle = color;

        for (let petal = 0; petal < 6; petal++) {
            const angle = (Math.PI * 2 * petal) / 6;

            ctx.beginPath();
            ctx.ellipse(
                x + Math.cos(angle) * size * 0.48,
                y + Math.sin(angle) * size * 0.48,
                size * 0.28,
                size * 0.44,
                angle,
                0,
                Math.PI * 2
            );
            ctx.fill();
        }

        ctx.beginPath();
        ctx.arc(x, y, size * 0.2, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    }

    function drawReferenceFlower(x, y) {
        ctx.save();
        ctx.translate(x, y - 55);
        ctx.lineCap = "round";
        ctx.lineJoin = "round";

        // Simple outlines and flat colors make the reference easy to copy by hand.
        ctx.strokeStyle = "#397653";
        ctx.lineWidth = 14;
        ctx.beginPath();
        ctx.moveTo(0, 35);
        ctx.lineTo(0, 325);
        ctx.stroke();

        for (const side of [-1, 1]) {
            ctx.save();
            ctx.translate(0, side === -1 ? 230 : 275);
            ctx.scale(side, 1);
            ctx.fillStyle = "#80b879";
            ctx.strokeStyle = "#397653";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(0, 0);
            ctx.bezierCurveTo(35, -80, 100, -100, 145, -100);
            ctx.bezierCurveTo(135, -25, 65, 20, 0, 0);
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(7, -4);
            ctx.quadraticCurveTo(65, -40, 130, -90);
            ctx.stroke();
            ctx.restore();
        }

        for (let petal = 0; petal < 5; petal++) {
            ctx.save();
            ctx.rotate((petal * Math.PI * 2) / 5);
            ctx.fillStyle = "#f8bed3";
            ctx.strokeStyle = "#35415f";
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(-30, -25);
            ctx.bezierCurveTo(-160, -95, -115, -235, 0, -235);
            ctx.bezierCurveTo(115, -235, 160, -95, 30, -25);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.restore();
        }

        ctx.fillStyle = "#ffdc73";
        ctx.strokeStyle = "#35415f";
        ctx.lineWidth = 6;
        ctx.beginPath();
        ctx.arc(0, 0, 63, 0, Math.PI * 2);
        ctx.fill();
        ctx.stroke();
        ctx.restore();
    }

    function drawDiamond(x, y, size = 48) {
        ctx.beginPath();
        ctx.moveTo(x, y - size);
        ctx.lineTo(x + size * 0.72, y);
        ctx.lineTo(x, y + size);
        ctx.lineTo(x - size * 0.72, y);
        ctx.closePath();
        ctx.fillStyle = color;
        ctx.fill();
    }

    function drawShape(shape, x, y) {
        ctx.fillStyle = color;

        if (shape === "circle") {
            ctx.beginPath();
            ctx.arc(x, y, 42, 0, Math.PI * 2);
            ctx.fill();
        }

        if (shape === "star") {
            drawStar(x, y);
        }

        if (shape === "heart") {
            drawHeart(x, y);
        }

        if (shape === "flower") {
            drawFlower(x, y);
        }

        if (shape === "diamond") {
            drawDiamond(x, y);
        }
    }

    function traceGarmentPath(type, cx, cy) {
        ctx.beginPath();

        if (type === "dress") {
            ctx.moveTo(cx - 54, cy - 208);
            ctx.quadraticCurveTo(cx - 96, cy - 211, cx - 122, cy - 179);
            ctx.quadraticCurveTo(cx - 157, cy - 142, cx - 143, cy - 88);
            ctx.quadraticCurveTo(cx - 115, cy - 65, cx - 91, cy - 87);
            ctx.lineTo(cx - 77, cy - 119);
            ctx.lineTo(cx - 69, cy - 44);
            ctx.bezierCurveTo(cx - 93, cy + 25, cx - 161, cy + 143, cx - 215, cy + 229);
            ctx.quadraticCurveTo(cx, cy + 262, cx + 215, cy + 229);
            ctx.bezierCurveTo(cx + 161, cy + 143, cx + 93, cy + 25, cx + 69, cy - 44);
            ctx.lineTo(cx + 77, cy - 119);
            ctx.lineTo(cx + 91, cy - 87);
            ctx.quadraticCurveTo(cx + 115, cy - 65, cx + 143, cy - 88);
            ctx.quadraticCurveTo(cx + 157, cy - 142, cx + 122, cy - 179);
            ctx.quadraticCurveTo(cx + 96, cy - 211, cx + 54, cy - 208);
            ctx.quadraticCurveTo(cx, cy - 147, cx - 54, cy - 208);
        } else if (type === "malong") {
            ctx.moveTo(cx - 122, cy - 218);
            ctx.quadraticCurveTo(cx, cy - 245, cx + 122, cy - 218);
            ctx.bezierCurveTo(cx + 148, cy - 112, cx + 145, cy + 92, cx + 176, cy + 223);
            ctx.quadraticCurveTo(cx + 93, cy + 244, cx + 22, cy + 225);
            ctx.quadraticCurveTo(cx - 44, cy + 246, cx - 166, cy + 220);
            ctx.bezierCurveTo(cx - 145, cy + 90, cx - 154, cy - 110, cx - 122, cy - 218);
        } else {
            const sleeve = type === "barong" ? 205 : 180;
            ctx.moveTo(cx - 110, cy - 210);
            ctx.lineTo(cx - 165, cy - 185);
            ctx.lineTo(cx - sleeve, cy - 80);
            ctx.lineTo(cx - 120, cy - 25);
            ctx.lineTo(cx - 105, cy - 50);
            ctx.lineTo(cx - 105, cy + 230);
            ctx.lineTo(cx + 105, cy + 230);
            ctx.lineTo(cx + 105, cy - 50);
            ctx.lineTo(cx + 120, cy - 25);
            ctx.lineTo(cx + sleeve, cy - 80);
            ctx.lineTo(cx + 165, cy - 185);
            ctx.lineTo(cx + 110, cy - 210);
            ctx.quadraticCurveTo(cx, cy - 155, cx - 110, cy - 210);
        }

        ctx.closePath();
    }

    function garmentDetails(type, cx, cy) {
        const outline = "#35415f";

        ctx.save();
        ctx.strokeStyle = outline;
        ctx.lineJoin = "round";
        ctx.lineCap = "round";

        if (type === "dress") {
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(cx - 54, cy - 208);
            ctx.quadraticCurveTo(cx, cy - 147, cx + 54, cy - 208);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx - 75, cy - 58);
            ctx.quadraticCurveTo(cx, cy - 39, cx + 75, cy - 58);
            ctx.stroke();

            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx - 113, cy - 171);
            ctx.quadraticCurveTo(cx - 105, cy - 126, cx - 88, cy - 96);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx + 113, cy - 171);
            ctx.quadraticCurveTo(cx + 105, cy - 126, cx + 88, cy - 96);
            ctx.stroke();

            [-125, -65, 65, 125].forEach(offset => {
                ctx.beginPath();
                ctx.moveTo(cx + offset * 0.35, cy - 42);
                ctx.quadraticCurveTo(
                    cx + offset * 0.7,
                    cy + 110,
                    cx + offset,
                    cy + 226
                );
                ctx.stroke();
            });

            ctx.strokeStyle = "#d78caa";
            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(cx - 185, cy + 207);
            ctx.quadraticCurveTo(cx, cy + 232, cx + 185, cy + 207);
            ctx.stroke();
        } else if (type === "malong") {
            ctx.lineWidth = 6;
            ctx.beginPath();
            ctx.moveTo(cx - 119, cy - 195);
            ctx.quadraticCurveTo(cx - 5, cy - 169, cx + 121, cy - 194);
            ctx.stroke();

            ctx.beginPath();
            ctx.moveTo(cx + 56, cy - 199);
            ctx.bezierCurveTo(
                cx + 12, cy - 91,
                cx + 28, cy + 83,
                cx - 29, cy + 225
            );
            ctx.stroke();

            ctx.lineWidth = 3;
            ctx.beginPath();
            ctx.moveTo(cx + 73, cy - 171);
            ctx.bezierCurveTo(
                cx + 59, cy - 33,
                cx + 99, cy + 105,
                cx + 91, cy + 222
            );
            ctx.moveTo(cx - 100, cy - 165);
            ctx.bezierCurveTo(
                cx - 119, cy - 28,
                cx - 94, cy + 103,
                cx - 111, cy + 212
            );
            ctx.stroke();

            ctx.lineWidth = 5;
            ctx.beginPath();
            ctx.moveTo(cx - 157, cy + 185);
            ctx.quadraticCurveTo(cx, cy + 211, cx + 164, cy + 187);
            ctx.stroke();

            ctx.save();
            traceGarmentPath("malong", cx, cy);
            ctx.clip();
            ctx.strokeStyle = "#bc684d";
            ctx.lineWidth = 4;

            for (let x = cx - 160; x < cx + 170; x += 24) {
                ctx.beginPath();
                ctx.moveTo(x, cy + 192);
                ctx.lineTo(x + 11, cy + 204);
                ctx.lineTo(x + 22, cy + 192);
                ctx.stroke();
            }

            ctx.restore();
        }

        ctx.restore();
    }

    function paintPattern(name, inside = false, garmentType = templateSelect.value, ctx = canvas.getContext("2d")) {
        const patternIndex = patterns.findIndex(pattern => pattern.key === name);
        if (patternIndex < 0) return;

        const palettes = [
            ["#243d70", "#ef8354", "#ffd166", "#e63946"],
            ["#1c2440", "#d32f2f", "#fca311", "#fff1bd"],
            ["#202a44", "#e4572e", "#f3a712", "#f7e1aa"],
            ["#182b52", "#b83b5e", "#f4a261", "#ffdf8c"]
        ];
        const palette = palettes[patternIndex % palettes.length];
        const cx = canvas.width / 2;
        const cy = canvas.height / 2;

        ctx.save();

        if (inside) {
            traceGarmentPath(garmentType, cx, cy);
            ctx.clip();
        }

        ctx.fillStyle = palette[0];
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        for (let x = 0; x < canvas.width; x += 65) {
            ctx.fillStyle = palette[1];
            ctx.fillRect(x, 0, 12, canvas.height);
            ctx.fillStyle = palette[2];
            ctx.fillRect(x + 17, 0, 5, canvas.height);
        }

        for (let y = 30; y < canvas.height; y += 76) {
            for (let x = 35; x < canvas.width; x += 95) {
                const size = 25;
                ctx.fillStyle = palette[1];
                ctx.beginPath();
                ctx.moveTo(x, y - size);
                ctx.lineTo(x + size, y);
                ctx.lineTo(x, y + size);
                ctx.lineTo(x - size, y);
                ctx.closePath();
                ctx.fill();

                ctx.fillStyle = palette[2];
                ctx.beginPath();
                ctx.moveTo(x, y - size * 0.55);
                ctx.lineTo(x + size * 0.55, y);
                ctx.lineTo(x, y + size * 0.55);
                ctx.lineTo(x - size * 0.55, y);
                ctx.closePath();
                ctx.fill();
            }
        }

        ctx.restore();
    }

    function drawTemplate(type, pattern = null) {
        LikhaMaskReference.deactivate();
        resetReferenceTutorial(type);
        const onMainCanvas = selectedLab === "craft" || (selectedLab === "festival" && type === "parol");
        maskReferenceOptions.hidden = selectedLab !== "festival" || type !== "mask";
        resetCanvas();
        selectMode("draw");

        if (selectedLab === "festival" && type === "mask") {
            LikhaMaskReference.activate();
            saveHistory();
            say("Choose a mask design. Resize its reference, or hide it while drawing.");
            return;
        }

        // Render at full resolution, then copy into the separate reference canvas.
        ctx.save();

        const cx = canvas.width / 2;
        const templateOffset = selectedLab === "craft" ? ({ basket: 18, fan: -58, pot: -15 }[type] || 0)
            : selectedLab === "festival" && type === "parol" ? -12 : 0;
        const cy = canvas.height / 2 + templateOffset;
        const outline = "#35415f";

        ctx.lineWidth = 9;
        ctx.lineJoin = "round";
        ctx.strokeStyle = outline;
        ctx.fillStyle = "#fff3dc";

        if (["shirt", "barong", "malong"].includes(type)) {
            traceGarmentPath(type, cx, cy);
            ctx.fill();
            if (pattern) paintPattern(pattern, true, type);
            traceGarmentPath(type, cx, cy);
            ctx.stroke();

            if (type === "malong") {
                garmentDetails("malong", cx, cy);
            } else {
                ctx.beginPath();
                ctx.ellipse(cx, cy - 196, 48, 18, 0, 0, Math.PI);
                ctx.stroke();
                if (type === "barong") {
                    ctx.lineWidth = 3;
                    ctx.strokeRect(cx - 24, cy - 125, 48, 325);
                    for (let y = cy - 105; y < cy + 185; y += 42) {
                        drawFlower(cx, y, 12);
                    }
                }
            }
        } else if (type === "dress") {
            traceGarmentPath(type, cx, cy);
            ctx.fillStyle = "#ffe4ed";
            ctx.fill();

            if (pattern) {
                paintPattern(pattern, true, type);
            }

            ctx.strokeStyle = "#35415f";
            ctx.lineWidth = 9;

            traceGarmentPath(type, cx, cy);
            ctx.stroke();

            garmentDetails("dress", cx, cy);
        } else if (type === "parol") {
            ctx.strokeStyle = outline;
            ctx.lineWidth = 6;
            // Two broad ribbon tails are easier to copy than detached lines.
            for (const side of [-1, 1]) {
                ctx.fillStyle = "#f6b580";
                ctx.beginPath();
                ctx.moveTo(cx + side * 90, cy + 115);
                ctx.lineTo(cx + side * 145, cy + 100);
                ctx.lineTo(cx + side * 195, cy + 280);
                ctx.lineTo(cx + side * 150, cy + 250);
                ctx.lineTo(cx + side * 125, cy + 290);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            ctx.fillStyle = "#e8f2fb";
            ctx.beginPath();
            ctx.arc(cx, cy - 40, 225, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            drawStar(cx, cy - 40, 210, 95, 5);
            ctx.fillStyle = "#ffdc73";
            ctx.fill();
            ctx.stroke();
        } else if (type === "mask") {
            const maskDesign = selectedLab === "festival" ? maskReferenceSelect.value : "plain";
            ctx.lineWidth = 6;
            ctx.fillStyle = {
                tuna: "#ddecf8", sinulog: "#fff0ba", tnalak: "#fff3dc"
            }[maskDesign] || "#f8bed3";
            ctx.beginPath();
            ctx.ellipse(cx, cy, 205, 245, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            // Simple decorative motifs distinguish the three drawing references.
            if (maskDesign === "tuna") {
                ctx.fillStyle = "#80b9d6";
                ctx.beginPath();
                ctx.moveTo(cx - 70, cy - 155);
                ctx.quadraticCurveTo(cx - 10, cy - 220, cx + 55, cy - 155);
                ctx.quadraticCurveTo(cx - 10, cy - 90, cx - 70, cy - 155);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.beginPath();
                ctx.moveTo(cx + 55, cy - 155);
                ctx.lineTo(cx + 100, cy - 185);
                ctx.lineTo(cx + 100, cy - 125);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
                ctx.fillStyle = outline;
                ctx.beginPath();
                ctx.arc(cx - 35, cy - 158, 6, 0, Math.PI * 2);
                ctx.fill();
                ctx.strokeStyle = "#4083a5";
                for (const side of [-1, 1]) {
                    ctx.beginPath();
                    ctx.moveTo(cx + side * 75, cy + 40);
                    ctx.quadraticCurveTo(cx + side * 105, cy + 15, cx + side * 145, cy + 40);
                    ctx.stroke();
                }
            } else if (maskDesign === "sinulog") {
                ctx.strokeStyle = "#c46a35";
                for (let ray = 0; ray < 8; ray++) {
                    const angle = ray * Math.PI / 4;
                    ctx.beginPath();
                    ctx.moveTo(cx + Math.cos(angle) * 47, cy - 155 + Math.sin(angle) * 47);
                    ctx.lineTo(cx + Math.cos(angle) * 65, cy - 155 + Math.sin(angle) * 65);
                    ctx.stroke();
                }
                ctx.fillStyle = "#f6b580";
                ctx.beginPath();
                ctx.arc(cx, cy - 155, 32, 0, Math.PI * 2);
                ctx.fill();
                ctx.stroke();
                for (const side of [-1, 1]) {
                    ctx.beginPath();
                    ctx.arc(cx + side * 120, cy + 45, 18, 0, Math.PI * 2);
                    ctx.fill();
                    ctx.stroke();
                }
            } else if (maskDesign === "tnalak") {
                ctx.strokeStyle = "#a53d3d";
                ctx.lineWidth = 10;
                ctx.beginPath();
                ctx.moveTo(cx - 135, cy - 145);
                for (let point = 1; point <= 6; point++) {
                    ctx.lineTo(cx - 135 + point * 45, cy - (point % 2 ? 185 : 145));
                }
                ctx.stroke();
                ctx.strokeStyle = outline;
                ctx.lineWidth = 5;
                for (const side of [-1, 1]) {
                    const diamondX = cx + side * 120;
                    ctx.fillStyle = "#a53d3d";
                    ctx.beginPath();
                    ctx.moveTo(diamondX, cy + 15);
                    ctx.lineTo(diamondX + 20, cy + 45);
                    ctx.lineTo(diamondX, cy + 75);
                    ctx.lineTo(diamondX - 20, cy + 45);
                    ctx.closePath();
                    ctx.fill();
                    ctx.stroke();
                }
            }
            ctx.strokeStyle = outline;
            ctx.lineWidth = 6;
            // Matching almond eyes, a small nose, and one smile keep the face clear.
            ctx.fillStyle = "#ffffff";
            for (const side of [-1, 1]) {
                const eyeX = cx + side * 90;
                ctx.beginPath();
                ctx.moveTo(eyeX - 48, cy - 40);
                ctx.quadraticCurveTo(eyeX, cy - 92, eyeX + 48, cy - 40);
                ctx.quadraticCurveTo(eyeX, cy + 2, eyeX - 48, cy - 40);
                ctx.closePath();
                ctx.fill();
                ctx.stroke();
            }
            ctx.beginPath();
            ctx.moveTo(cx, cy - 15);
            ctx.lineTo(cx - 22, cy + 45);
            ctx.lineTo(cx + 14, cy + 45);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 78, cy + 100);
            ctx.quadraticCurveTo(cx, cy + 175, cx + 78, cy + 100);
            ctx.stroke();
        } else if (type === "flower") {
            if (["festival", "art"].includes(selectedLab)) {
                drawReferenceFlower(cx, cy);
            } else {
                drawFlower(cx, cy, 210);
                ctx.strokeStyle = outline;
                ctx.lineWidth = 4;
                ctx.beginPath();
                ctx.arc(cx, cy, 210, 0, Math.PI * 2);
                ctx.stroke();
            }
        } else if (type === "basket") {
            ctx.lineWidth = 6;
            ctx.fillStyle = "#e8bf85";
            ctx.beginPath();
            ctx.arc(cx, cy - 85, 150, Math.PI, Math.PI * 2);
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(cx - 200, cy - 70);
            ctx.lineTo(cx + 200, cy - 70);
            ctx.lineTo(cx + 155, cy + 200);
            ctx.lineTo(cx - 155, cy + 200);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            // A few straight weave lines stay inside the tapered basket body.
            ctx.lineWidth = 4;
            for (let offset = -10; offset <= 130; offset += 70) {
                const halfWidth = 200 - (offset + 70) / 6;
                ctx.beginPath();
                ctx.moveTo(cx - halfWidth, cy + offset);
                ctx.lineTo(cx + halfWidth, cy + offset);
                ctx.stroke();
            }
            for (const offset of [-100, 0, 100]) {
                ctx.beginPath();
                ctx.moveTo(cx + offset, cy - 70);
                ctx.lineTo(cx + offset * 155 / 200, cy + 200);
                ctx.stroke();
            }
            ctx.lineWidth = 6;
            ctx.fillStyle = "#f6d9aa";
            ctx.fillRect(cx - 210, cy - 95, 420, 25);
            ctx.strokeRect(cx - 210, cy - 95, 420, 25);
        } else if (type === "banig" || type === "craft") {
            const left = cx - 300;
            const top = cy - 200;
            // One continuous mat replaces the separate tiles and tiny crosses.
            ctx.lineWidth = 6;
            ctx.fillStyle = "#e8bf85";
            ctx.fillRect(left - 15, top - 15, 630, 430);
            ctx.strokeRect(left - 15, top - 15, 630, 430);
            for (let row = 0; row < 4; row++) {
                for (let col = 0; col < 6; col++) {
                    ctx.fillStyle = (row + col) % 2 ? "#ffe4a8" : "#dff5e5";
                    ctx.fillRect(left + col * 100, top + row * 100, 100, 100);
                }
            }
            ctx.lineWidth = 4;
            ctx.beginPath();
            for (let col = 1; col < 6; col++) {
                ctx.moveTo(left + col * 100, top);
                ctx.lineTo(left + col * 100, top + 400);
            }
            for (let row = 1; row < 4; row++) {
                ctx.moveTo(left, top + row * 100);
                ctx.lineTo(left + 600, top + row * 100);
            }
            ctx.stroke();
            ctx.strokeRect(left, top, 600, 400);
        } else if (type === "fan") {
            ctx.lineWidth = 6;
            ctx.fillStyle = "#e8bf85";
            ctx.fillRect(cx - 18, cy + 120, 36, 145);
            ctx.strokeRect(cx - 18, cy + 120, 36, 145);
            ctx.fillStyle = "#f9d7c2";
            ctx.beginPath();
            ctx.moveTo(cx, cy + 120);
            ctx.arc(cx, cy + 120, 270, Math.PI, Math.PI * 2);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            for (let ray = 1; ray < 6; ray++) {
                const angle = Math.PI + (Math.PI * ray) / 6;
                ctx.beginPath();
                ctx.moveTo(cx, cy + 120);
                ctx.lineTo(cx + Math.cos(angle) * 270, cy + 120 + Math.sin(angle) * 270);
                ctx.stroke();
            }
            ctx.fillStyle = "#e8bf85";
            ctx.beginPath();
            ctx.arc(cx, cy + 120, 12, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else if (type === "pot") {
            ctx.lineWidth = 6;
            ctx.fillStyle = "#e6a77e";
            ctx.beginPath();
            ctx.moveTo(cx - 115, cy - 160);
            ctx.lineTo(cx + 115, cy - 160);
            ctx.lineTo(cx + 95, cy - 100);
            ctx.bezierCurveTo(cx + 225, cy - 20, cx + 215, cy + 145, cx + 110, cy + 220);
            ctx.lineTo(cx - 110, cy + 220);
            ctx.bezierCurveTo(cx - 215, cy + 145, cx - 225, cy - 20, cx - 95, cy - 100);
            ctx.closePath();
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#f6d9aa";
            ctx.beginPath();
            ctx.ellipse(cx, cy - 160, 125, 30, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
            ctx.fillStyle = "#ad7458";
            ctx.lineWidth = 4;
            ctx.beginPath();
            ctx.ellipse(cx, cy - 160, 94, 14, 0, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();
        } else if (type === "house") {
            ctx.lineWidth = 6;
            ctx.fillStyle = "#fff3dc";
            ctx.fillRect(cx - 190, cy - 20, 380, 270);
            ctx.strokeRect(cx - 190, cy - 20, 380, 270);
            ctx.beginPath();
            ctx.moveTo(cx - 235, cy - 20);
            ctx.lineTo(cx, cy - 230);
            ctx.lineTo(cx + 235, cy - 20);
            ctx.closePath();
            ctx.fillStyle = "#f6b580";
            ctx.fill();
            ctx.stroke();
            // A triangle roof, square windows, and a rectangle door are easy to follow.
            ctx.fillStyle = "#ddecf8";
            for (const side of [-1, 1]) {
                const windowX = cx + side * 115 - 35;
                ctx.fillRect(windowX, cy + 35, 70, 70);
                ctx.strokeRect(windowX, cy + 35, 70, 70);
            }
            ctx.fillStyle = "#c99b79";
            ctx.fillRect(cx - 45, cy + 100, 90, 150);
            ctx.strokeRect(cx - 45, cy + 100, 90, 150);
            ctx.fillStyle = outline;
            ctx.beginPath();
            ctx.arc(cx + 24, cy + 182, 6, 0, Math.PI * 2);
            ctx.fill();
        } else if (type === "mountain") {
            ctx.lineWidth = 6;
            ctx.fillStyle = "#ffdc73";
            ctx.beginPath();
            ctx.arc(240, 180, 48, 0, Math.PI * 2);
            ctx.fill();
            ctx.stroke();

            // Two clean triangle peaks and one circular sun form a simple landscape.
            ctx.beginPath();
            ctx.moveTo(170, 550);
            ctx.lineTo(390, 245);
            ctx.lineTo(610, 550);
            ctx.closePath();
            ctx.fillStyle = "#b7d5ac";
            ctx.fill();
            ctx.stroke();
            ctx.beginPath();
            ctx.moveTo(420, 550);
            ctx.lineTo(650, 160);
            ctx.lineTo(880, 550);
            ctx.closePath();
            ctx.fillStyle = "#91bb99";
            ctx.fill();
            ctx.stroke();
        }

        ctx.restore();
        referenceContext.clearRect(0, 0, referenceCanvas.width, referenceCanvas.height);
        referenceContext.drawImage(canvas, 0, 0);
        referencePanel.hidden = onMainCanvas || type === "blank";
        if (!onMainCanvas) resetCanvas();
        saveHistory();
        say(
            pattern
                ? `${patterns.find(item => item.key === pattern)?.label || pattern} design applied to your ${labels[type] || "artwork"} reference!`
                : type === "blank"
                ? "Blank canvas ready. Make it your own!"
                : onMainCanvas
                ? "Your design is centered on the canvas. Open Tutorial to watch the steps and see the materials."
                : "Reference added in the top-left corner. Use the open canvas to draw your own version."
        );
    }

    // Fill only the connected, enclosed area selected by the artist.
    function fillDrawingPattern(point) {
        const width = canvas.width;
        const height = canvas.height;
        const x = Math.floor(point.x);
        const y = Math.floor(point.y);
        if (x < 0 || y < 0 || x >= width || y >= height) return;
        const image = ctx.getImageData(0, 0, width, height);
        const pixels = image.data;
        const seed = y * width + x;
        const offset = seed * 4;
        const target = Array.from(pixels.slice(offset, offset + 4));
        const visited = new Uint8Array(width * height);
        const region = new Int32Array(width * height);
        let count = 1;
        let touchesEdge = false;
        region[0] = seed;
        visited[seed] = 1;
        const visit = index => {
            if (visited[index]) return;
            visited[index] = 1;
            const i = index * 4;
            if (target.some((value, channel) => Math.abs(pixels[i + channel] - value) > 36)) return;
            region[count++] = index;
        };
        for (let head = 0; head < count; head++) {
            const index = region[head];
            const column = index % width;
            if (column === 0 || column === width - 1 || index < width || index >= width * (height - 1)) {
                touchesEdge = true;
                break;
            }
            visit(index - 1);
            visit(index + 1);
            visit(index - width);
            visit(index + width);
        }
        if (touchesEdge || count < 4) {
            selectMode("draw");
            say("Pattern could not fill this area. Draw is ready: close any gaps in your outline, then choose a pattern and click inside it.");
            return;
        }
        const layer = document.createElement("canvas");
        layer.width = width;
        layer.height = height;
        const patternContext = layer.getContext("2d");
        const tile = getPatternTile(patterns.find(item => item.key === selectedPattern));
        let left = width, top = height, right = 0, bottom = 0;
        for (let i = 0; i < count; i++) {
            const column = region[i] % width;
            const row = Math.floor(region[i] / width);
            left = Math.min(left, column);
            top = Math.min(top, row);
            right = Math.max(right, column);
            bottom = Math.max(bottom, row);
        }
        const spacing = Math.max(12, Math.min(48, Math.min(right - left + 1, bottom - top + 1) / 3));
        const repeat = patternContext.createPattern(tile, "repeat");
        repeat.setTransform(new DOMMatrix().translate(left, top).scale(spacing / tile.width));
        patternContext.fillStyle = repeat;
        patternContext.fillRect(left, top, right - left + 1, bottom - top + 1);
        const patternPixels = patternContext.getImageData(0, 0, width, height).data;
        // Match the existing history convention so one Undo restores this exact drawing.
        saveHistory();
        for (let i = 0; i < count; i++) {
            const pixel = region[i] * 4;
            pixels.set(patternPixels.subarray(pixel, pixel + 4), pixel);
        }
        ctx.putImageData(image, 0, 0);
        saveHistory();
        selectMode("draw");
        say(`${patterns.find(item => item.key === selectedPattern).label} added! Draw is ready again. To fill another area, choose a pattern again.`);
    }

    function drawPattern(type, ctx = canvas.getContext("2d"), record = true) {
        const pattern = patterns.find(item => item.key === type);
        if (!pattern) {
            say("Choose a pattern before applying it.");
            return;
        }

        ctx.save();
        ctx.strokeStyle = color;
        ctx.fillStyle = color;
        ctx.lineWidth = 5;
        ctx.lineJoin = "round";

        if (pattern.style === "diamonds") {
            const size = 70;

            for (let row = 0; row < 7; row++) {
                for (let column = 0; column < 10; column++) {
                    const x = column * size + (row % 2) * (size / 2);
                    const y = row * size;

                    ctx.beginPath();
                    ctx.moveTo(x, y - size / 2);
                    ctx.lineTo(x + size / 2, y);
                    ctx.lineTo(x, y + size / 2);
                    ctx.lineTo(x - size / 2, y);
                    ctx.closePath();
                    ctx.stroke();
                }
            }
        } else if (pattern.style === "waves" || pattern.style === "stripes") {
            for (let row = 0; row < 9; row++) {
                const y = 45 + row * 80;

                ctx.beginPath();
                for (let x = 0; x <= canvas.width; x += 8) {
                    const waveY = pattern.style === "waves"
                        ? y + Math.sin((x / 100) * Math.PI) * 22
                        : y;
                    if (x === 0) ctx.moveTo(x, waveY);
                    else ctx.lineTo(x, waveY);
                }
                ctx.stroke();
            }
        } else if (pattern.style === "sunbursts" || pattern.style === "stars") {
            for (let row = 0; row < 5; row++) {
                for (let column = 0; column < 7; column++) {
                    const x = 75 + column * 145;
                    const y = 70 + row * 145;
                    const radius = 23;

                    if (pattern.style === "stars") {
                        drawStar(x, y, radius, radius / 2, 5, ctx);
                    } else {
                        ctx.beginPath();
                        ctx.arc(x, y, radius / 3, 0, Math.PI * 2);
                        ctx.fill();

                        for (let ray = 0; ray < 8; ray++) {
                            const angle = (Math.PI * 2 * ray) / 8;
                            ctx.beginPath();
                            ctx.moveTo(
                                x + Math.cos(angle) * radius * 0.65,
                                y + Math.sin(angle) * radius * 0.65
                            );
                            ctx.lineTo(
                                x + Math.cos(angle) * radius,
                                y + Math.sin(angle) * radius
                            );
                            ctx.stroke();
                        }
                    }
                }
            }
        } else if (pattern.style === "florals" || pattern.style === "hearts") {
            for (let row = 0; row < 5; row++) {
                for (let column = 0; column < 7; column++) {
                    const x = 75 + column * 145;
                    const y = 70 + row * 145;

                    if (pattern.style === "hearts") {
                        drawHeart(x, y, 35, ctx);
                        continue;
                    }

                    for (let petal = 0; petal < 6; petal++) {
                        const angle = (Math.PI * 2 * petal) / 6;
                        ctx.beginPath();
                        ctx.ellipse(
                            x + Math.cos(angle) * 18,
                            y + Math.sin(angle) * 18,
                            12,
                            20,
                            angle,
                            0,
                            Math.PI * 2
                        );
                        ctx.stroke();
                    }

                    ctx.beginPath();
                    ctx.arc(x, y, 5, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else if (pattern.style === "dots") {
            for (let row = 0; row < 12; row++) {
                for (let column = 0; column < 16; column++) {
                    ctx.beginPath();
                    ctx.arc(30 + column * 62, 30 + row * 58, 8, 0, Math.PI * 2);
                    ctx.fill();
                }
            }
        } else if (pattern.style === "crossweave" || pattern.style === "checker") {
            const cellSize = 70;
            for (let row = 0; row < Math.ceil(canvas.height / cellSize); row++) {
                for (let column = 0; column < Math.ceil(canvas.width / cellSize); column++) {
                    const x = column * cellSize;
                    const y = row * cellSize;
                    if (pattern.style === "checker") {
                        if ((row + column) % 2 === 0) {
                            ctx.fillRect(x, y, cellSize, cellSize);
                        }
                    } else {
                        ctx.strokeRect(x, y, cellSize, cellSize);
                        ctx.beginPath();
                        ctx.moveTo(x, y);
                        ctx.lineTo(x + cellSize, y + cellSize);
                        ctx.moveTo(x + cellSize, y);
                        ctx.lineTo(x, y + cellSize);
                        ctx.stroke();
                    }
                }
            }
        }

        ctx.restore();
        if (record) {
            saveHistory();
            say(`${pattern.label} pattern added! Keep creating and make it your own.`);
        }
    }

    resetCanvas();
    saveHistory();

    colorPicker.addEventListener("input", () => {
        color = colorPicker.value;
    });

    document.querySelectorAll(".swatch").forEach(button => {
        button.addEventListener("click", () => {
            color = button.dataset.color;
            colorPicker.value = color;
        });
    });

    brushSize.addEventListener("input", () => {
        brushSizeValue.textContent = brushSize.value;
    });

    document.getElementById("applyTemplate").addEventListener("click", () => {
        drawTemplate(templateSelect.value);
    });

    templateGallery.addEventListener("click", event => {
        const button = event.target.closest("[data-template]");
        if (!button) return;

        templateSelect.value = button.dataset.template;
        templateGallery.querySelectorAll("[data-template]").forEach(card => {
            const isSelected = card === button;
            card.classList.toggle("selected", isSelected);
            card.setAttribute("aria-pressed", String(isSelected));
        });
        drawTemplate(templateSelect.value);
    });

    templateSelect.addEventListener("change", () => {
        maskReferenceOptions.hidden = selectedLab !== "festival" || templateSelect.value !== "mask";
        templateGallery.querySelectorAll("[data-template]").forEach(card => {
            const isSelected = card.dataset.template === templateSelect.value;
            card.classList.toggle("selected", isSelected);
            card.setAttribute("aria-pressed", String(isSelected));
        });
    });

    patternGallery.addEventListener("click", event => {
        const button = event.target.closest("[data-pattern]");
        if (!button) return;

        selectedPattern = button.dataset.pattern;
        patternGallery.querySelectorAll("[data-pattern]").forEach(card => {
            const isSelected = card === button;
            card.classList.toggle("selected", isSelected);
            card.setAttribute("aria-pressed", String(isSelected));
        });
        selectMode("pattern-fill");
        say(`${button.textContent.trim()} selected. Click inside a closed area of your drawing. Choose Draw to cancel.`);
    });

    document.getElementById("applyPatternBtn").addEventListener("click", () => {
        selectMode("draw");
        saveHistory();
        drawPattern(selectedPattern);
    });

    document.getElementById("drawMode").addEventListener("click", () => {
        selectMode("draw");

        say("Draw mode selected. Drag across the canvas to draw.");
    });

    [
        ["addCircle", "circle"],
        ["addStar", "star"],
        ["addHeart", "heart"],
        ["addFlower", "flower"],
        ["addDiamond", "diamond"]
    ].forEach(([id, shape]) => {
        document.getElementById(id).addEventListener("click", () => {
            selectMode(shape);

            say("Click the canvas to place your " + shape + ".");
        });
    });

    let keyboardPoint = {x: canvas.width / 2, y: canvas.height / 2};
    canvas.tabIndex = 0;
    canvas.setAttribute("aria-label", "Drawing canvas");
    canvas.setAttribute("aria-describedby", "canvasKeyboardHelp");
    const keyboardHelp = document.createElement("p");
    keyboardHelp.id = "canvasKeyboardHelp";
    keyboardHelp.className = "canvas-keyboard-help";
    keyboardHelp.textContent = "Keyboard: arrows move the cursor; Shift + arrows draw; Enter uses the selected tool; Ctrl/Cmd + Z undoes. Escape returns to Draw.";
    canvas.parentElement.insertAdjacentElement("afterend", keyboardHelp);
    const keyboardCursor = document.createElement("span");
    keyboardCursor.className = "canvas-keyboard-cursor";
    keyboardCursor.setAttribute("aria-hidden", "true");
    keyboardCursor.hidden = true;
    canvas.parentElement.append(keyboardCursor);
    const placeKeyboardCursor = () => {
        keyboardCursor.style.left = `${keyboardPoint.x / canvas.width * 100}%`;
        keyboardCursor.style.top = `${keyboardPoint.y / canvas.height * 100}%`;
    };
    canvas.addEventListener("focus", () => {keyboardCursor.hidden = false;placeKeyboardCursor();});
    canvas.addEventListener("blur", () => {keyboardCursor.hidden = true;});
    canvas.addEventListener("keydown", event => {
        const moves = {ArrowLeft:[-10,0],ArrowRight:[10,0],ArrowUp:[0,-10],ArrowDown:[0,10]};
        if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "z") {
            event.preventDefault();document.getElementById("undoButton").click();return;
        }
        if (event.key === "Escape") {selectMode("draw");return;}
        if (moves[event.key]) {
            event.preventDefault();
            const start = {...keyboardPoint};
            keyboardPoint.x = Math.max(1,Math.min(canvas.width-2,keyboardPoint.x+moves[event.key][0]));
            keyboardPoint.y = Math.max(1,Math.min(canvas.height-2,keyboardPoint.y+moves[event.key][1]));
            if(event.shiftKey){saveHistory();drawLine(start,keyboardPoint);saveHistory();}
            placeKeyboardCursor();say(`Drawing cursor: ${keyboardPoint.x}, ${keyboardPoint.y}.`);
        } else if(event.key === "Enter") {
            event.preventDefault();
            if(mode === "pattern-fill") fillDrawingPattern(keyboardPoint);
            else {saveHistory();if(mode === "draw")drawLine(keyboardPoint,{x:keyboardPoint.x+.1,y:keyboardPoint.y+.1});else drawShape(mode,keyboardPoint.x,keyboardPoint.y);saveHistory();}
        }
    });

    canvas.addEventListener("pointerdown", event => {
        event.preventDefault();

        const point = pointFromEvent(event);

        if (mode === "pattern-fill") {
            fillDrawingPattern(point);
            return;
        }

        if (mode !== "draw") {
            saveHistory();
            drawShape(mode, point.x, point.y);
            return;
        }

        drawing = true;
        lastPoint = point;

        saveHistory();
        canvas.setPointerCapture(event.pointerId);

        drawLine(point, {
            x: point.x + 0.1,
            y: point.y + 0.1
        });
    });

    canvas.addEventListener("pointermove", event => {
        if (!drawing) return;

        const point = pointFromEvent(event);

        drawLine(lastPoint, point);
        lastPoint = point;
    });

    function stopDrawing() {
        drawing = false;
        lastPoint = null;
    }

    canvas.addEventListener("pointerup", stopDrawing);
    canvas.addEventListener("pointercancel", stopDrawing);

    canvas.addEventListener("pointerleave", event => {
        if (event.buttons === 0) {
            stopDrawing();
        }
    });

    document.getElementById("undoButton").addEventListener("click", () => {
        if (history.length <= 1) {
            say("There's nothing more to undo.");
            return;
        }

        history.pop();
        ctx.putImageData(history[history.length - 1], 0, 0);

        say("Last action undone.");
    });

    document.getElementById("clearButton").addEventListener("click", () => {
        selectMode("draw");
        resetCanvas();
        saveHistory();
        say("Canvas cleared. Start a fresh design!");
    });

    document.getElementById("downloadButton").addEventListener("click", () => {
        const link = document.createElement("a");

        link.download = "likha-" + selectedLab + "-artwork.png";
        link.href = canvas.toDataURL("image/png");
        link.click();

        say("Your artwork image has been downloaded!");
    });

    drawTemplate(templateSelect.value);
})();

// ==========================================
// LIKHA STUDIO — SAVE ARTWORK TO MY GALLERY
// ==========================================

(() => {
    const canvas = document.getElementById("artCanvas");
    const saveButton = document.getElementById("saveArtworkBtn");
    const modal = document.getElementById("artworkDetailsModal");
    const form = document.getElementById("artworkDetailsForm");
    const cancelButton = document.getElementById("cancelSaveBtn");

    const STORAGE_KEY = "likhaArtworks";

    if (!canvas || !saveButton || !modal || !form || !cancelButton) {
        console.error(
            "LIKHA Save Artwork: Check the canvas, button, form, and modal IDs in studio.html."
        );
        return;
    }

    function getArtworks() {
        try {
            const saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || "[]");
            return Array.isArray(saved) ? saved : [];
        } catch (error) {
            console.error("Could not read saved artworks:", error);
            return [];
        }
    }

    function openForm() {
        modal.hidden = false;
        document.getElementById("artworkTitle").focus();
    }

    function closeForm() {
        modal.hidden = true;
    }

    saveButton.addEventListener("click", openForm);
    cancelButton.addEventListener("click", closeForm);

    modal.addEventListener("click", event => {
        if (event.target === modal) {
            closeForm();
        }
    });

    form.addEventListener("submit", event => {
        event.preventDefault();

        const title = document.getElementById("artworkTitle").value.trim();

        if (!title) {
            alert("Please enter an artwork title.");
            return;
        }

        const requestedLab = new URLSearchParams(location.search).get("lab");
        const lab = (["fashion", "festival", "craft", "art"].includes(requestedLab)
            ? requestedLab : localStorage.getItem("selectedLab") || "art").toLowerCase();

        let activeChallenge = null;
        try {
            activeChallenge = JSON.parse(
                localStorage.getItem("likhaActiveChallenge") || "null"
            );
        } catch (error) {
            console.error("Could not load active creative challenge:", error);
        }

        const concepts = {
            subject: document.getElementById("artworkSubject").value.trim(),
            theme: document.getElementById("artworkTheme").value.trim(),
            form: document.getElementById("artworkForm").value.trim(),
            style: document.getElementById("artworkStyle").value.trim(),
            symbolism: document.getElementById("artworkSymbolism").value.trim(),
            medium: document.getElementById("artworkMedium").value.trim()
        };

        try {
            const imageData = canvas.toDataURL("image/png");
            const artworks = getArtworks();

            const artwork = {
                id: (
                    typeof crypto !== "undefined" &&
                    typeof crypto.randomUUID === "function"
                ) ? crypto.randomUUID() : `${Date.now()}-${Math.random()}`,
                title,
                lab,
                concepts,
                imageData,
                dateSaved: new Date().toISOString(),
                challengeId: activeChallenge?.id || null,
                challengeTitle: activeChallenge?.title || null
            };

            // Check whether this is a new artwork or an existing one.
            const existingIndex = artworks.findIndex(
                item => item.id === artwork.id
            );

            if (existingIndex !== -1) {
                // Update existing artwork without awarding another point.
                artworks[existingIndex] = artwork;
            } else {
                artworks.push(artwork);
            }

            // Save artwork to browser storage.
            localStorage.setItem(
                STORAGE_KEY,
                JSON.stringify(artworks)
            );

            // Artwork IDs are reconciled into the same progress record used by
            // the dashboard and pet page. Reopening a page cannot award duplicates.
            LikhaPetProgress.sync();

            alert("Your artwork has been saved to My LIKHA Gallery! 🎨");

            modal.hidden = true;
            form.reset();
            window.location.href = "gallery.html";
        } catch (error) {
            console.error("Could not save artwork:", error);
            alert(
                "Your artwork could not be saved. The image may be too large for browser storage. Try creating a smaller artwork or clearing some saved items."
            );
        }
    });
})();
