"""
Hand Gesture Keyboard - FastAPI 백엔드 서버
WebSocket을 통한 실시간 손 추적 데이터 전송
"""
import asyncio
import base64
import json
import cv2
import numpy as np
from fastapi import FastAPI, WebSocket, WebSocketDisconnect
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import HTMLResponse
from contextlib import asynccontextmanager

from hand_tracker import HandTracker, WebcamCapture
from gesture_recognizer import GestureRecognizer


# 전역 변수
tracker: HandTracker = None
gesture_recognizer: GestureRecognizer = None
webcam: WebcamCapture = None


@asynccontextmanager
async def lifespan(app: FastAPI):
    """앱 시작/종료 시 리소스 관리"""
    global tracker, gesture_recognizer, webcam
    
    print("🖐️ Hand Gesture Keyboard 서버 시작...")
    tracker = HandTracker(ema_alpha=0.3)
    gesture_recognizer = GestureRecognizer()
    
    try:
        webcam = WebcamCapture(camera_id=0)
        print("✅ 웹캠 연결 성공")
    except RuntimeError as e:
        print(f"⚠️ 웹캠 연결 실패: {e}")
        webcam = None
    
    yield
    
    # 종료 시 리소스 해제
    if webcam:
        webcam.release()
    if tracker:
        tracker.release()
    print("👋 서버 종료")


app = FastAPI(
    title="Hand Gesture Keyboard API",
    description="비접촉 제스처 기반 입력 시스템",
    version="1.0.0",
    lifespan=lifespan
)

# CORS 설정
app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.get("/")
async def root():
    """API 상태 확인"""
    return {
        "status": "running",
        "message": "Hand Gesture Keyboard API",
        "webcam_connected": webcam is not None
    }


@app.get("/health")
async def health_check():
    """헬스 체크"""
    return {"status": "healthy"}


@app.websocket("/ws/hand-tracking")
async def websocket_hand_tracking(websocket: WebSocket):
    """
    실시간 손 추적 WebSocket 엔드포인트
    
    클라이언트로 전송되는 데이터:
    {
        "type": "tracking",
        "pointer": [x, y],
        "gestures": {
            "pinch": {"is_pinching": bool, "pinch_triggered": bool, ...},
            "fist": {"is_fist": bool, "fist_triggered": bool},
            "dwell": {"dwell_progress": float, "dwell_triggered": bool}
        },
        "hand_detected": bool,
        "frame": "base64_encoded_jpeg"  # 선택적
    }
    """
    await websocket.accept()
    print("🔌 클라이언트 연결됨")
    
    send_video = True  # 비디오 프레임 전송 여부
    
    try:
        while True:
            # 클라이언트 메시지 확인 (비차단)
            try:
                message = await asyncio.wait_for(
                    websocket.receive_text(),
                    timeout=0.001
                )
                data = json.loads(message)
                
                if data.get("type") == "config":
                    send_video = data.get("send_video", True)
                elif data.get("type") == "reset_calibration":
                    if tracker:
                        tracker.reset_calibration()
                        print("📍 캘리브레이션 초기화")
                elif data.get("type") == "calibrate":
                    if tracker and "target" in data:
                        target = data["target"]
                        finger_idx = data.get("finger", 8)
                        # 현재 랜드마크가 있을 때만 캘리브레이션 수행
                        success, frame = webcam.read()
                        if success:
                            hands_data, _ = tracker.process_frame(frame)
                            if hands_data:
                                # 첫 번째 감지된 손을 기준으로 캘리브레이션
                                tracker.calibrate(hands_data[0]['landmarks'], target, finger_idx)
                                print(f"📍 캘리브레이션 완료: Target {target}")
                        
            except asyncio.TimeoutError:
                pass
            except json.JSONDecodeError:
                pass
            
            if webcam is None:
                await websocket.send_json({
                    "type": "error",
                    "message": "웹캠이 연결되지 않았습니다"
                })
                await asyncio.sleep(1)
                continue
            
            # 프레임 캡처
            success, frame = webcam.read()
            if not success:
                await asyncio.sleep(0.01)
                continue
            
            # 좌우 반전 (거울 모드)
            frame = cv2.flip(frame, 1)
            
            # 손 추적
            # 1. 손 추적 (이제 리스트를 반환함)
            hands_data, annotated_frame = tracker.process_frame(frame)
            
            # 2. 제스처 인식
            gesture_results = gesture_recognizer.recognize(hands_data)
            
            # 결과 전송 객체 구성
            response = {
                "type": "tracking",
                "hands": gesture_results, 
                "hand_detected": len(hands_data) > 0
            }
            
            # 비디오 프레임 전송 (선택적)
            if send_video:
                _, buffer = cv2.imencode('.jpg', annotated_frame, [
                    cv2.IMWRITE_JPEG_QUALITY, 50
                ])
                response["video_frame"] = base64.b64encode(buffer).decode('utf-8')
            
            await websocket.send_json(response)
            
            # 프레임 레이트 제한 (~30fps)
            await asyncio.sleep(0.033)
            
    except WebSocketDisconnect:
        print("🔌 클라이언트 연결 해제")
    except Exception as e:
        print(f"❌ WebSocket 오류: {e}")
        await websocket.close()


@app.websocket("/ws/frame-input")
async def websocket_frame_input(websocket: WebSocket):
    """
    클라이언트에서 프레임을 받아 처리하는 WebSocket 엔드포인트
    (프론트엔드에서 웹캠 접근 시 사용)
    
    클라이언트로부터 받는 데이터:
    {
        "type": "frame",
        "data": "base64_encoded_jpeg"
    }
    """
    await websocket.accept()
    print("🔌 프레임 입력 클라이언트 연결됨")
    
    try:
        while True:
            message = await websocket.receive_text()
            data = json.loads(message)
            
            if data.get("type") == "frame" and "data" in data:
                # Base64 디코딩
                img_bytes = base64.b64decode(data["data"])
                nparr = np.frombuffer(img_bytes, np.uint8)
                frame = cv2.imdecode(nparr, cv2.IMREAD_COLOR)
                
                if frame is None:
                    continue
                
                # 손 추적
                landmarks, _ = tracker.process_frame(frame)
                
                response = {
                    "type": "tracking",
                    "hand_detected": landmarks is not None
                }
                
                if landmarks is not None:
                    gestures = gesture_recognizer.recognize(landmarks)
                    response["pointer"] = list(gestures["pointer"])
                    response["gestures"] = {
                        "pinch": gestures["pinch"],
                        "fist": gestures["fist"],
                        "dwell": gestures["dwell"]
                    }
                
                await websocket.send_json(response)
                
    except WebSocketDisconnect:
        print("🔌 프레임 입력 클라이언트 연결 해제")
    except Exception as e:
        print(f"❌ WebSocket 오류: {e}")


if __name__ == "__main__":
    import uvicorn
    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=8000,
        reload=True
    )
