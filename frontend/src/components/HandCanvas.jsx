import React, { useRef, useEffect } from 'react';

const HandCanvas = ({ trackingData }) => {
    const canvasRef = useRef(null);

    useEffect(() => {
        const canvas = canvasRef.current;
        if (!canvas || !trackingData) return;

        const ctx = canvas.getContext('2d');
        const { frame, hand_detected, pointer } = trackingData;

        // Clear canvas
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        // Draw background video frame if available
        if (frame) {
            const img = new Image();
            img.onload = () => {
                ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

                // Draw pointer if detected
                if (pointer) {
                    const [x, y] = pointer;
                    ctx.beginPath();
                    ctx.arc(x * canvas.width, y * canvas.height, 10, 0, Math.PI * 2);
                    ctx.fillStyle = trackingData.gestures?.pinch?.is_pinching ? '#ff4b2b' : '#00f2fe';
                    ctx.fill();
                    ctx.strokeStyle = 'white';
                    ctx.lineWidth = 2;
                    ctx.stroke();
                }
            };
            img.src = `data:image/jpeg;base64,${frame}`;
        }
    }, [trackingData]);

    return (
        <div className="canvas-container">
            <canvas
                ref={canvasRef}
                width={640}
                height={480}
                style={{
                    width: '100%',
                    maxWidth: '640px',
                    borderRadius: '12px',
                    boxShadow: '0 8px 32px rgba(0,0,0,0.3)',
                    background: '#1a1a1a'
                }}
            />
        </div>
    );
};

export default HandCanvas;
