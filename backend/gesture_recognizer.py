"""
Gesture Recognizer
손 제스처 인식 알고리즘
"""
import numpy as np
from typing import Optional, List
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
        pinch_threshold: float = 0.05,
        pinch_hold_time: float = 0.1,
        fist_threshold: float = 0.08,
        fist_hold_time: float = 0.5,
        dwell_time: float = 0.8,        # 체류 시간 약간 단축
        dwell_radius: float = 0.03,
    ):
        self.pinch_threshold = pinch_threshold
        self.pinch_hold_time = pinch_hold_time
        self.fist_threshold = fist_threshold
        self.fist_hold_time = fist_hold_time
        self.dwell_time = dwell_time
        self.dwell_radius = dwell_radius
        
        # 양손 독립적 상태 추적
        self.states = {
            'Left': self._init_hand_state(),
            'Right': self._init_hand_state()
        }
    
    def _init_hand_state(self) -> dict:
        """손 하나에 대한 상태 초기화"""
        return {
            'fingers': {
                'thumb': self._init_finger_state(),
                'index': self._init_finger_state(),
                'middle': self._init_finger_state(),
                'ring': self._init_finger_state(),
                'pinky': self._init_finger_state(),
            },
            'fist_start_time': None,
            'was_fist': False
        }
    
    def _init_finger_state(self) -> dict:
        """손가락 하나에 대한 상태 초기화"""
        return {
            'dwell_start_time': None,
            'dwell_position': None,
            'pinch_start_time': None,
            'was_pinching': False
        }
    
    def _calculate_distance(self, p1: np.ndarray, p2: np.ndarray) -> float:
        """두 점 사이의 유클리드 거리 계산"""
        return np.linalg.norm(p1 - p2)
    
    def _is_finger_folded(self, landmarks: np.ndarray, tip_idx: int, mcp_idx: int) -> bool:
        """손가락이 접혀있는지 확인"""
        tip = landmarks[tip_idx]
        mcp = landmarks[mcp_idx]
        wrist = landmarks[self.WRIST]
        
        tip_to_wrist = self._calculate_distance(tip, wrist)
        mcp_to_wrist = self._calculate_distance(mcp, wrist)
        
        return tip_to_wrist < mcp_to_wrist * 1.1
    
    def detect_pinch(self, landmarks: np.ndarray, label: str, finger_name: str, tip_idx: int) -> dict:
        """핀치 제스처 감지 (엄지 vs 특정 손가락)"""
        if finger_name == 'thumb':
            return {'is_pinching': False, 'pinch_triggered': False}
            
        state = self.states[label]['fingers'][finger_name]
        thumb_tip = landmarks[self.THUMB_TIP]
        finger_tip = landmarks[tip_idx]
        
        distance = float(self._calculate_distance(thumb_tip[:2], finger_tip[:2]))
        is_pinching = bool(distance < self.pinch_threshold)
        
        pinch_triggered = False
        current_time = time.time()
        
        if is_pinching:
            if state['pinch_start_time'] is None:
                state['pinch_start_time'] = current_time
            elif current_time - state['pinch_start_time'] >= self.pinch_hold_time:
                if not state['was_pinching']:
                    pinch_triggered = True
                    state['was_pinching'] = True
        else:
            state['pinch_start_time'] = None
            state['was_pinching'] = False
            
        return {
            'is_pinching': is_pinching,
            'pinch_triggered': pinch_triggered,
            'distance': distance
        }

    def detect_fist(self, landmarks: np.ndarray, label: str) -> dict:
        """주먹 제스처 감지 (All Clear)"""
        state = self.states[label]
        
        fingers_folded = [
            self._is_finger_folded(landmarks, self.INDEX_TIP, self.INDEX_MCP),
            self._is_finger_folded(landmarks, self.MIDDLE_TIP, self.MIDDLE_MCP),
            self._is_finger_folded(landmarks, self.RING_TIP, self.RING_MCP),
            self._is_finger_folded(landmarks, self.PINKY_TIP, self.PINKY_MCP),
        ]
        
        is_fist = bool(all(fingers_folded))
        fist_triggered = False
        current_time = time.time()
        
        if is_fist:
            if state['fist_start_time'] is None:
                state['fist_start_time'] = current_time
            elif current_time - state['fist_start_time'] >= self.fist_hold_time:
                if not state['was_fist']:
                    fist_triggered = True
                    state['was_fist'] = True
        else:
            state['fist_start_time'] = None
            state['was_fist'] = False
        
        return {
            'is_fist': is_fist,
            'fist_triggered': fist_triggered
        }
    
    def detect_dwell(self, tip_pos: np.ndarray, label: str, finger_name: str) -> dict:
        """체류 시간 기반 입력 감지 (손가락별)"""
        state = self.states[label]['fingers'][finger_name]
        current_time = time.time()
        
        if state['dwell_position'] is None:
            state['dwell_position'] = (float(tip_pos[0]), float(tip_pos[1]))
            state['dwell_start_time'] = current_time
            return {'dwell_progress': 0.0, 'dwell_triggered': False}
        
        distance = self._calculate_distance(
            np.array(state['dwell_position']),
            tip_pos[:2]
        )
        
        if distance > self.dwell_radius:
            state['dwell_position'] = (float(tip_pos[0]), float(tip_pos[1]))
            state['dwell_start_time'] = current_time
            return {'dwell_progress': 0.0, 'dwell_triggered': False}
        
        elapsed = current_time - state['dwell_start_time']
        progress = float(min(elapsed / self.dwell_time, 1.0))
        
        dwell_triggered = False
        if progress >= 1.0:
            dwell_triggered = True
            state['dwell_start_time'] = current_time
        
        return {
            'dwell_progress': progress,
            'dwell_triggered': dwell_triggered
        }

    def recognize(self, hands_data: List[dict]) -> List[dict]:
        """모든 손과 손가락의 인식 통합"""
        results = []
        detected_labels = [hand['label'] for hand in hands_data]
        
        # 감지되지 않은 손 리셋
        for label in self.states:
            if label not in detected_labels:
                self.states[label] = self._init_hand_state()

        finger_map = {
            'thumb': self.THUMB_TIP,
            'index': self.INDEX_TIP,
            'middle': self.MIDDLE_TIP,
            'ring': self.RING_TIP,
            'pinky': self.PINKY_TIP
        }

        for hand in hands_data:
            landmarks = hand['landmarks']
            label = hand['label']
            
            finger_results = {}
            for f_name, tip_idx in finger_map.items():
                tip_pos = landmarks[tip_idx]
                finger_results[f_name] = {
                    'pointer': (float(tip_pos[0]), float(tip_pos[1])),
                    'dwell': self.detect_dwell(tip_pos, label, f_name),
                    'pinch': self.detect_pinch(landmarks, label, f_name, tip_idx)
                }
            
            results.append({
                'label': label,
                'fingers': finger_results,
                'fist': self.detect_fist(landmarks, label)
            })
            
        return results
    
    def reset(self):
        """모든 상태 초기화"""
        for label in self.states:
            self.states[label] = self._init_hand_state()
