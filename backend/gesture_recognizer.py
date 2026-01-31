"""
Gesture Recognizer
손 제스처 인식 알고리즘
"""
import numpy as np
from typing import Optional
import time


class GestureRecognizer:
    """
    손 제스처 인식기
    - 핀치(Pinch): 엄지-검지 거리 기반 클릭
    - 주먹(Fist): 모든 손가락 접힘 감지
    - Dwell Time: 체류 시간 기반 입력
    """
    
    # MediaPipe 손 랜드마크 인덱스
    WRIST = 0
    THUMB_TIP = 4
    INDEX_TIP = 8
    MIDDLE_TIP = 12
    RING_TIP = 16
    PINKY_TIP = 20
    
    # 손가락 MCP(중수지절) 관절 인덱스
    INDEX_MCP = 5
    MIDDLE_MCP = 9
    RING_MCP = 13
    PINKY_MCP = 17
    
    def __init__(
        self,
        pinch_threshold: float = 0.05,  # 정규화된 거리 (0~1)
        pinch_hold_time: float = 0.1,   # 핀치 유지 시간 (초)
        fist_threshold: float = 0.08,   # 주먹 임계값
        fist_hold_time: float = 0.5,    # 주먹 유지 시간 (초)
        dwell_time: float = 1.0,        # 체류 시간 (초)
        dwell_radius: float = 0.03,     # 체류 반경
    ):
        self.pinch_threshold = pinch_threshold
        self.pinch_hold_time = pinch_hold_time
        self.fist_threshold = fist_threshold
        self.fist_hold_time = fist_hold_time
        self.dwell_time = dwell_time
        self.dwell_radius = dwell_radius
        
        # 상태 추적
        self.pinch_start_time: Optional[float] = None
        self.fist_start_time: Optional[float] = None
        self.dwell_start_time: Optional[float] = None
        self.dwell_position: Optional[tuple] = None
        
        # 이전 상태
        self.was_pinching = False
        self.was_fist = False
    
    def _calculate_distance(self, p1: np.ndarray, p2: np.ndarray) -> float:
        """두 점 사이의 유클리드 거리 계산"""
        return np.linalg.norm(p1 - p2)
    
    def _is_finger_folded(self, landmarks: np.ndarray, tip_idx: int, mcp_idx: int) -> bool:
        """손가락이 접혀있는지 확인"""
        tip = landmarks[tip_idx]
        mcp = landmarks[mcp_idx]
        wrist = landmarks[self.WRIST]
        
        # 손가락 끝이 MCP보다 손목에 가까우면 접힌 것으로 판단
        tip_to_wrist = self._calculate_distance(tip, wrist)
        mcp_to_wrist = self._calculate_distance(mcp, wrist)
        
        return tip_to_wrist < mcp_to_wrist * 1.1
    
    def detect_pinch(self, landmarks: np.ndarray) -> dict:
        """
        핀치 제스처 감지
        
        Args:
            landmarks: shape (21, 3) 손 랜드마크 배열
            
        Returns:
            {
                'is_pinching': bool,
                'pinch_triggered': bool,  # 핀치가 처음 발동된 순간
                'distance': float,
                'position': (x, y)  # 핀치 위치 (클릭 시 고정)
            }
        """
        thumb_tip = landmarks[self.THUMB_TIP]
        index_tip = landmarks[self.INDEX_TIP]
        
        distance = self._calculate_distance(thumb_tip[:2], index_tip[:2])
        is_pinching = distance < self.pinch_threshold
        
        # 핀치 위치는 엄지와 검지의 중간점
        pinch_position = (thumb_tip[:2] + index_tip[:2]) / 2
        
        pinch_triggered = False
        current_time = time.time()
        
        if is_pinching:
            if self.pinch_start_time is None:
                self.pinch_start_time = current_time
            elif current_time - self.pinch_start_time >= self.pinch_hold_time:
                if not self.was_pinching:
                    pinch_triggered = True
                    self.was_pinching = True
        else:
            self.pinch_start_time = None
            self.was_pinching = False
        
        return {
            'is_pinching': is_pinching,
            'pinch_triggered': pinch_triggered,
            'distance': distance,
            'position': tuple(pinch_position)
        }
    
    def detect_fist(self, landmarks: np.ndarray) -> dict:
        """
        주먹 제스처 감지 (All Clear)
        
        Returns:
            {
                'is_fist': bool,
                'fist_triggered': bool  # 주먹이 처음 발동된 순간
            }
        """
        # 모든 손가락이 접혀있는지 확인
        fingers_folded = [
            self._is_finger_folded(landmarks, self.INDEX_TIP, self.INDEX_MCP),
            self._is_finger_folded(landmarks, self.MIDDLE_TIP, self.MIDDLE_MCP),
            self._is_finger_folded(landmarks, self.RING_TIP, self.RING_MCP),
            self._is_finger_folded(landmarks, self.PINKY_TIP, self.PINKY_MCP),
        ]
        
        is_fist = all(fingers_folded)
        fist_triggered = False
        current_time = time.time()
        
        if is_fist:
            if self.fist_start_time is None:
                self.fist_start_time = current_time
            elif current_time - self.fist_start_time >= self.fist_hold_time:
                if not self.was_fist:
                    fist_triggered = True
                    self.was_fist = True
        else:
            self.fist_start_time = None
            self.was_fist = False
        
        return {
            'is_fist': is_fist,
            'fist_triggered': fist_triggered
        }
    
    def detect_dwell(self, landmarks: np.ndarray) -> dict:
        """
        체류 시간 기반 입력 감지
        
        Returns:
            {
                'dwell_progress': float,  # 0.0 ~ 1.0
                'dwell_triggered': bool
            }
        """
        index_tip = landmarks[self.INDEX_TIP][:2]
        current_time = time.time()
        
        if self.dwell_position is None:
            self.dwell_position = tuple(index_tip)
            self.dwell_start_time = current_time
            return {'dwell_progress': 0.0, 'dwell_triggered': False}
        
        # 이동 거리 확인
        distance = self._calculate_distance(
            np.array(self.dwell_position),
            index_tip
        )
        
        if distance > self.dwell_radius:
            # 위치가 변경됨 - 리셋
            self.dwell_position = tuple(index_tip)
            self.dwell_start_time = current_time
            return {'dwell_progress': 0.0, 'dwell_triggered': False}
        
        # 체류 시간 계산
        elapsed = current_time - self.dwell_start_time
        progress = min(elapsed / self.dwell_time, 1.0)
        
        dwell_triggered = False
        if progress >= 1.0:
            dwell_triggered = True
            self.dwell_start_time = current_time  # 리셋하여 연속 트리거 방지
        
        return {
            'dwell_progress': progress,
            'dwell_triggered': dwell_triggered
        }
    
    def get_pointer_position(self, landmarks: np.ndarray) -> tuple:
        """
        검지 끝 위치 반환 (포인터 위치)
        """
        return tuple(landmarks[self.INDEX_TIP][:2])
    
    def recognize(self, landmarks: np.ndarray) -> dict:
        """
        모든 제스처 인식 통합
        
        Returns:
            {
                'pointer': (x, y),
                'pinch': {...},
                'fist': {...},
                'dwell': {...}
            }
        """
        return {
            'pointer': self.get_pointer_position(landmarks),
            'pinch': self.detect_pinch(landmarks),
            'fist': self.detect_fist(landmarks),
            'dwell': self.detect_dwell(landmarks)
        }
    
    def reset(self):
        """모든 상태 초기화"""
        self.pinch_start_time = None
        self.fist_start_time = None
        self.dwell_start_time = None
        self.dwell_position = None
        self.was_pinching = False
        self.was_fist = False
