"""
Hand Tracker
MediaPipe Hands를 활용한 손 랜드마크 추적 모듈
"""
import cv2
import numpy as np
import mediapipe as mp
from typing import Optional, Tuple, List
from ema_filter import MultiPointEMAFilter


class HandTracker:
    """
    MediaPipe Hands 기반 손 추적기
    21개의 손 관절 랜드마크를 실시간 추적
    """
    
    def __init__(
        self,
        max_num_hands: int = 1,
        min_detection_confidence: float = 0.7,
        min_tracking_confidence: float = 0.5,
        ema_alpha: float = 0.3
    ):
        """
        Args:
            max_num_hands: 추적할 최대 손 개수
            min_detection_confidence: 손 감지 최소 신뢰도
            min_tracking_confidence: 손 추적 최소 신뢰도
            ema_alpha: EMA 필터 평활 계수
        """
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles
        
        self.hands = self.mp_hands.Hands(
            static_image_mode=False,
            max_num_hands=max_num_hands,
            min_detection_confidence=min_detection_confidence,
            min_tracking_confidence=min_tracking_confidence
        )
        
        # EMA 필터 (포인터 떨림 방지)
        self.ema_filter = MultiPointEMAFilter(num_points=21, alpha=ema_alpha)
        
        # 캘리브레이션 데이터
        self.calibration_offset = np.array([0.0, 0.0])
        self.is_calibrated = False
    
    def process_frame(self, frame: np.ndarray) -> Tuple[Optional[np.ndarray], np.ndarray]:
        """
        프레임에서 손 랜드마크 추출
        
        Args:
            frame: BGR 이미지 (OpenCV 형식)
            
        Returns:
            (landmarks, annotated_frame)
            - landmarks: shape (21, 3) 또는 None (손 미감지)
            - annotated_frame: 랜드마크가 그려진 프레임
        """
        # BGR -> RGB 변환
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        rgb_frame.flags.writeable = False
        
        # MediaPipe 처리
        results = self.hands.process(rgb_frame)
        
        rgb_frame.flags.writeable = True
        annotated_frame = cv2.cvtColor(rgb_frame, cv2.COLOR_RGB2BGR)
        
        landmarks = None
        
        if results.multi_hand_landmarks:
            hand_landmarks = results.multi_hand_landmarks[0]
            
            # 랜드마크를 numpy 배열로 변환
            landmarks = np.array([
                [lm.x, lm.y, lm.z] for lm in hand_landmarks.landmark
            ])
            
            # EMA 필터 적용
            landmarks = self.ema_filter.update(landmarks)
            
            # 캘리브레이션 오프셋 적용
            if self.is_calibrated:
                landmarks[:, :2] += self.calibration_offset
            
            # 랜드마크 시각화
            self.mp_drawing.draw_landmarks(
                annotated_frame,
                hand_landmarks,
                self.mp_hands.HAND_CONNECTIONS,
                self.mp_drawing_styles.get_default_hand_landmarks_style(),
                self.mp_drawing_styles.get_default_hand_connections_style()
            )
        else:
            # 손이 감지되지 않으면 EMA 필터 리셋
            self.ema_filter.reset()
        
        return landmarks, annotated_frame
    
    def calibrate(self, landmarks: np.ndarray, target_position: Tuple[float, float]):
        """
        자동 캘리브레이션: 현재 손 위치를 기준점으로 설정
        
        Args:
            landmarks: 현재 손 랜드마크
            target_position: 목표 위치 (예: 키보드 홈키 위치)
        """
        # 검지 끝(INDEX_TIP = 8)을 기준으로 캘리브레이션
        current_position = landmarks[8, :2]
        self.calibration_offset = np.array(target_position) - current_position
        self.is_calibrated = True
    
    def reset_calibration(self):
        """캘리브레이션 초기화"""
        self.calibration_offset = np.array([0.0, 0.0])
        self.is_calibrated = False
    
    def get_index_finger_tip(self, landmarks: np.ndarray) -> Tuple[float, float]:
        """검지 끝 좌표 반환"""
        return tuple(landmarks[8, :2])
    
    def get_all_fingertips(self, landmarks: np.ndarray) -> dict:
        """모든 손가락 끝 좌표 반환"""
        return {
            'thumb': tuple(landmarks[4, :2]),
            'index': tuple(landmarks[8, :2]),
            'middle': tuple(landmarks[12, :2]),
            'ring': tuple(landmarks[16, :2]),
            'pinky': tuple(landmarks[20, :2])
        }
    
    def release(self):
        """리소스 해제"""
        self.hands.close()


class WebcamCapture:
    """웹캠 캡처 유틸리티"""
    
    def __init__(self, camera_id: int = 0, width: int = 640, height: int = 480):
        self.cap = cv2.VideoCapture(camera_id)
        self.cap.set(cv2.CAP_PROP_FRAME_WIDTH, width)
        self.cap.set(cv2.CAP_PROP_FRAME_HEIGHT, height)
        
        if not self.cap.isOpened():
            raise RuntimeError("웹캠을 열 수 없습니다")
    
    def read(self) -> Tuple[bool, Optional[np.ndarray]]:
        """프레임 읽기"""
        return self.cap.read()
    
    def release(self):
        """웹캠 해제"""
        self.cap.release()


if __name__ == "__main__":
    # 테스트 코드
    tracker = HandTracker()
    webcam = WebcamCapture()
    
    print("손을 웹캠에 보이게 해주세요. 'q'를 누르면 종료됩니다.")
    
    try:
        while True:
            success, frame = webcam.read()
            if not success:
                continue
            
            # 좌우 반전 (거울 모드)
            frame = cv2.flip(frame, 1)
            
            landmarks, annotated_frame = tracker.process_frame(frame)
            
            if landmarks is not None:
                index_tip = tracker.get_index_finger_tip(landmarks)
                cv2.putText(
                    annotated_frame,
                    f"Index: ({index_tip[0]:.2f}, {index_tip[1]:.2f})",
                    (10, 30),
                    cv2.FONT_HERSHEY_SIMPLEX,
                    0.7,
                    (0, 255, 0),
                    2
                )
            
            cv2.imshow("Hand Tracking", annotated_frame)
            
            if cv2.waitKey(1) & 0xFF == ord('q'):
                break
    finally:
        webcam.release()
        tracker.release()
        cv2.destroyAllWindows()
