import React, { useRef, useEffect } from 'react';

const HandCanvas = ({ trackingData }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !trackingData) return;

        const ctx = canvas.getContext('2d');
        const { video_frame, hands } = trackingData;

        // Draw background video frame if available
        if (video_frame) {
            const img = new Image();
            img.onload = () => {
                ctx.clearRect(0, 0, canvas.width, canvas.height);
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Draw fingers for multiple hands
                if (hands && hands.length > 0) {
                    hands.forEach(hand => {
                        const { label, fingers } = hand;

                        // Hand-specific color
                        const handColor = label === 'Left' ? '#ff4757' : '#2ed573';

                        Object.entries(fingers).forEach(([f_name, f_data]) => {
                            const { pointer, pinch, dwell } = f_data;
                            const [x, y] = pointer;
                            const px = x * canvas.width;
                            const py = y * canvas.height;
                            const pinching = pinch?.is_pinching;
                            const dwelling = (dwell?.dwell_progress || 0) > 0;

                            // Glow Effect
                            ctx.shadowBlur = pinching ? 20 : (dwelling ? 15 : 5);
                            ctx.shadowColor = pinching ? '#ff4b2b' : handColor;

                            // Outer Ring
                            ctx.beginPath();
                            ctx.arc(px, py, pinching ? 8 : 12, 0, Math.PI * 2);
                            ctx.strokeStyle = pinching ? '#ff4b2b' : handColor;
                            ctx.lineWidth = dwelling ? 4 : 2;
                            ctx.stroke();

                            // Inner Dot
                            ctx.beginPath();
                            ctx.arc(px, py, 3, 0, Math.PI * 2);
                            ctx.fillStyle = 'white';
                            ctx.fill();

                            // Finger Label
                            ctx.shadowBlur = 0;
                            ctx.fillStyle = 'white';
                            ctx.font = '8px Inter, sans-serif';
                            ctx.fillText(f_name, px + 12, py + 4);
                        });
                    });
                }
            };
            img.src = `data:image/jpeg;base64,${video_frame}`;
        }
    }, [trackingData]);

    return (
        <div className="canvas-wrapper">
            <canvas
                ref={canvasRef}
                width={640}
                height={480}
                className="hand-canvas"
            />
            <style dangerouslySetInnerHTML={{
                __html: `
                .canvas-wrapper {
                    width: 100%;
                    height: 100%;
                    display: flex;
                    align-items: center;
                    justify-content: center;
                    background: #000;
                }
                .hand-canvas {
                    width: 100%;
                    height: 100%;
                    object-fit: cover;
                    filter: brightness(1.1) contrast(1.1);
                }
                `
            }} />
        </div>
    );
};

export default HandCanvas;
