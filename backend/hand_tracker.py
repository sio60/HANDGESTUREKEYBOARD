"""
Hand Tracker
MediaPipe Hands를 활용한 손 랜드마크 추적 모듈
"""
import cv2
import numpy as np
import mediapipe as mp
from typing import Optional, Tuple, List
from ema_filter import MultiPointEMAFilter


import cv2
import numpy as np
import mediapipe as mp
from mediapipe.tasks import python
from mediapipe.tasks.python import vision
from typing import Optional, Tuple, List
import os
from ema_filter import MultiPointEMAFilter


class HandTracker:
    """
    MediaPipe Tasks Hand Landmarker 기반 손 추적기
    21개의 손 관절 랜드마크 추적 및 F/J 홈키 기반 캘리브레이션 지원
    """
    
    def __init__(
        self,
        model_path: str = "backend/hand_landmarker.task",
        max_num_hands: int = 2,
        min_detection_confidence: float = 0.7,
        min_presence_confidence: float = 0.5,
        min_tracking_confidence: float = 0.5,
        ema_alpha: float = 0.3
    ):
        """
        Args:
            model_path: .task 모델 파일 경로
            max_num_hands: 추적할 최대 손 개수
            min_detection_confidence: 손 감지 최소 신뢰도
            ema_alpha: EMA 필터 평활 계수
        """
        # 절대 경로 처리
        if not os.path.isabs(model_path):
            base_dir = os.path.dirname(os.path.abspath(__file__))
            model_path = os.path.join(base_dir, os.path.basename(model_path))

        base_options = python.BaseOptions(model_asset_path=model_path)
        options = vision.HandLandmarkerOptions(
            base_options=base_options,
            running_mode=vision.RunningMode.IMAGE,
            num_hands=max_num_hands,
            min_hand_detection_confidence=min_detection_confidence,
            min_hand_presence_confidence=min_presence_confidence,
            min_tracking_confidence=min_tracking_confidence
        )
        self.detector = vision.HandLandmarker.create_from_options(options)
        
        # EMA 필터 (손마다 별도로 관리: 최대 2개)
        self.filters = [MultiPointEMAFilter(num_points=21, alpha=ema_alpha) for _ in range(max_num_hands)]
        self.max_num_hands = max_num_hands
        
        # 캘리브레이션 데이터 (Anchor 포인트: F/J 키)
        self.calibration_offset = np.array([0.0, 0.0])
        self.is_calibrated = False
        
        # 시각화용 mp utils
        self.mp_hands = mp.solutions.hands
        self.mp_drawing = mp.solutions.drawing_utils
        self.mp_drawing_styles = mp.solutions.drawing_styles

    def process_frame(self, frame: np.ndarray) -> Tuple[List[dict], np.ndarray]:
        """
        프레임에서 손 랜드마크 추출 (멀티 핸드 지원)
        
        Returns:
            (hands_data, annotated_frame)
            - hands_data: [{'landmarks': np.ndarray, 'label': str}, ...]
            - annotated_frame: 랜드마크가 그려진 프레임
        """
        # BGR -> RGB 변환 (MediaPipe Tasks 이미지 객체 생성)
        rgb_frame = cv2.cvtColor(frame, cv2.COLOR_BGR2RGB)
        mp_image = mp.Image(image_format=mp.ImageFormat.SRGB, data=rgb_frame)
        
        # MediaPipe 처리
        result = self.detector.detect(mp_image)
        
        annotated_frame = frame.copy()
        hands_data = []
        
        if result.hand_landmarks:
            for i, (hand_landmarks, handedness) in enumerate(zip(result.hand_landmarks, result.handedness)):
                if i >= self.max_num_hands:
                    break
                
                # 첫 번째 손의 랜드마크를 numpy 배열로 변환
                landmarks = np.array([
                    [lm.x, lm.y, lm.z] for lm in hand_landmarks
                ])
                
                # EMA 필터 적용
                # 단순 인덱스 기반으로 필터를 할당하면 손이 잠깐 사라졌다 나타날 때 순서가 바뀔 수 있음
                # 하지만 일단 간단하게 인덱스 기반으로 처리
                landmarks = self.filters[i].update(landmarks)
                
                # 캘리브레이션 오프셋 적용
                if self.is_calibrated:
                    landmarks[:, :2] += self.calibration_offset
                
                # 정보 저장 (10손가락 지원)
                label = handedness[0].category_name # 'Left' or 'Right'
                hands_data.append({
                    'landmarks': landmarks,
                    'label': label,
                    'fingers': self.get_all_fingertips(landmarks)
                })
                
                # 시각화 (legacy drawing utils 사용 가능하도록 변환)
                self._draw_landmarks(annotated_frame, hand_landmarks)
        
        # 감지되지 않은 손의 필터 리셋
        for i in range(len(hands_data), self.max_num_hands):
            self.filters[i].reset()
        
        return hands_data, annotated_frame

    def _draw_landmarks(self, frame, hand_landmarks):
        """랜드마크 시각화 헬퍼 (Legacy 스타일 유지)"""
        # MediaPipe landmarker result를 legacy landmark_list 포맷으로 변환하지 않고 
        # 직접 그리기 위해 내부 구조와 유사하게 mock 객체 활용 가능
        # 여기서는 더 간단하게 opencv로 직접 그리거나 legacy class로 래핑
        from mediapipe.framework.formats import landmark_pb2
        hand_landmarks_proto = landmark_pb2.NormalizedLandmarkList()
        hand_landmarks_proto.landmark.extend([
            landmark_pb2.NormalizedLandmark(x=lm.x, y=lm.y, z=lm.z) for lm in hand_landmarks
        ])
        
        self.mp_drawing.draw_landmarks(
            frame,
            hand_landmarks_proto,
            self.mp_hands.HAND_CONNECTIONS,
            self.mp_drawing_styles.get_default_hand_landmarks_style(),
            self.mp_drawing_styles.get_default_hand_connections_style()
        )

    def calibrate(self, landmarks: np.ndarray, target_position: Tuple[float, float], finger_idx: int = 8):
        """
        F/J 키 캘리브레이션: 특정 손가락 위치를 목표 좌표(Home)로 설정
        
        Args:
            landmarks: 현재 손 랜드마크
            target_position: 목표 위치 (예: 화면상의 F키 또는 J키 위치)
            finger_idx: 기준이 될 손가락 (기본값: 검지 끝=8)
        """
        current_position = landmarks[finger_idx, :2]
        self.calibration_offset = np.array(target_position) - current_position
        self.is_calibrated = True
    
    def reset_calibration(self):
        """캘리브레이션 초기화"""
        self.calibration_offset = np.array([0.0, 0.0])
        self.is_calibrated = False

    def release(self):
        """리소스 해제"""
        self.detector.close()
    
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
            
            hands_data, annotated_frame = tracker.process_frame(frame)
            
            if hands_data:
                landmarks = hands_data[0]['landmarks']
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
