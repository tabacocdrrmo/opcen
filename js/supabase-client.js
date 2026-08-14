const { createClient } = supabase;
const supabaseClient = createClient(
    "https://lwlpftfaxtvhdvmxcvtm.supabase.co",
    "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6Imx3bHBmdGZheHR2aGR2bXhjdnRtIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODM0Nzk5NzksImV4cCI6MjA5OTA1NTk3OX0.gAv_Yh3n-y6KlWq1kpa5XFojrQfqRDQnutv1t8IwU1U"
);

function readFileAsDataUrl(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.onerror = () => reject(new Error("Failed to read the image file."));
        reader.readAsDataURL(file);
    });
}

function loadImage(src) {
    return new Promise((resolve, reject) => {
        const img = new Image();
        img.onload = () => resolve(img);
        img.onerror = () => reject(new Error("The selected file is not a valid image."));
        img.src = src;
    });
}

// Downsizes and re-encodes a profile photo to a small JPEG before upload so the
// object never exceeds Supabase Storage's max allowed size, regardless of the
// original file's dimensions or format. Returns { blob } on success or { error }.
async function prepareProfileImage(file) {
    if (!file || !String(file.type || "").startsWith("image/")) {
        return { error: "Please select an image file." };
    }
    try {
        const dataUrl = await readFileAsDataUrl(file);
        const img = await loadImage(dataUrl);
        const MAX = 800;
        let { width, height } = img;
        if (width > MAX || height > MAX) {
            const scale = MAX / Math.max(width, height);
            width = Math.round(width * scale);
            height = Math.round(height * scale);
        }
        const canvas = document.createElement("canvas");
        canvas.width = width;
        canvas.height = height;
        canvas.getContext("2d").drawImage(img, 0, 0, width, height);
        const blob = await new Promise((resolve, reject) => {
            canvas.toBlob(resolve, "image/jpeg", 0.85);
            setTimeout(() => resolve(null), 8000);
        });
        if (!blob) return { error: "Image processing failed." };
        return { blob };
    } catch (err) {
        return { error: err.message || "Failed to process the image." };
    }
}
