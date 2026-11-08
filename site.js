// Keep images usable when a browser or intermediary cannot load the WebP version.
(() => {
    function useOriginalImage(image) {
        if (!(image instanceof HTMLImageElement) || !image.getAttribute("src")) return;
        const url = new URL(image.src, document.baseURI);
        if (url.origin !== location.origin || !url.pathname.endsWith(".webp")) return;
        const isJpeg = /\/assets\/labs\//.test(url.pathname) || /pasted-image-[13456]\.webp$/.test(url.pathname);
        url.pathname = url.pathname.replace(/\.webp$/, isJpeg ? ".jpg" : ".png");
        image.src = url.href;
    }

    document.addEventListener("error", event => useOriginalImage(event.target), true);
    document.querySelectorAll("img").forEach(image => {
        if (image.complete && !image.naturalWidth && image.getAttribute("src")) useOriginalImage(image);
    });
})();
