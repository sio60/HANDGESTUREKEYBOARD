"""
EMA Filter (Exponential Moving Average)
포인터 떨림 방지를 위한 지수 이동 평균 필터
"""
import numpy as np


class EMAFilter:
    """
    지수 이동 평균 필터
    공식: EMA_t = α * x_t + (1 - α) * EMA_{t-1}
    α가 작을수록 더 부드러운 움직임 (0.1 ~ 0.3 권장)
    """
    
    def __init__(self, alpha: float = 0.2):
        """
        Args:
            alpha: 평활 계수 (0 < alpha < 1)
                   - 작을수록 부드러움 (지연 증가)
                   - 클수록 민감함 (떨림 증가)
        """
        self.alpha = alpha
        self.ema_x = None
        self.ema_y = None
    
    def update(self, x: float, y: float) -> tuple[float, float]:
        """
        새로운 좌표로 EMA 업데이트
        
        Args:
            x: 새로운 x 좌표
            y: 새로운 y 좌표
            
        Returns:
            필터링된 (x, y) 좌표
        """
        if self.ema_x is None:
            # 첫 번째 값은 그대로 사용
            self.ema_x = x
            self.ema_y = y
        else:
            self.ema_x = self.alpha * x + (1 - self.alpha) * self.ema_x
            self.ema_y = self.alpha * y + (1 - self.alpha) * self.ema_y
        
        return self.ema_x, self.ema_y
    
    def reset(self):
        """필터 상태 초기화"""
        self.ema_x = None
        self.ema_y = None
    
    def get_current(self) -> tuple[float, float] | None:
        """현재 EMA 값 반환"""
        if self.ema_x is None:
            return None
        return self.ema_x, self.ema_y


class MultiPointEMAFilter:
    """
    여러 포인트(21개 랜드마크)를 위한 EMA 필터
    """
    
    def __init__(self, num_points: int = 21, alpha: float = 0.2):
        self.num_points = num_points
        self.alpha = alpha
        self.ema_values = None
    
    def update(self, landmarks: np.ndarray) -> np.ndarray:
        """
        랜드마크 배열 업데이트
        
        Args:
            landmarks: shape (21, 3) 배열 (x, y, z)
            
        Returns:
            필터링된 랜드마크 배열
        """
        if self.ema_values is None:
            self.ema_values = landmarks.copy()
        else:
            self.ema_values = self.alpha * landmarks + (1 - self.alpha) * self.ema_values
        
        return self.ema_values
    
    def reset(self):
        """필터 상태 초기화"""
        self.ema_values = None
