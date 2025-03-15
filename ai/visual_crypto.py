import numpy as np
import cv2
from PIL import Image
import tensorflow as tf
from typing import Tuple, List
import hashlib

class VisualCryptography:
    def __init__(self, image_size: Tuple[int, int] = (256, 256)):
        self.image_size = image_size
        self._init_ai_model()

    def _init_ai_model(self):
        """Initialize the AI model for image enhancement and reconstruction"""
        self.model = tf.keras.Sequential([
            tf.keras.layers.Input(shape=(*self.image_size, 1)),
            tf.keras.layers.Conv2D(32, (3, 3), activation='relu', padding='same'),
            tf.keras.layers.Conv2D(64, (3, 3), activation='relu', padding='same'),
            tf.keras.layers.Conv2D(1, (3, 3), activation='sigmoid', padding='same')
        ])
        self.model.compile(optimizer='adam', loss='binary_crossentropy')

    def preprocess_image(self, image_path: str) -> np.ndarray:
        """Preprocess the input image for encryption"""
        img = cv2.imread(image_path, cv2.IMREAD_GRAYSCALE)
        img = cv2.resize(img, self.image_size)
        return img / 255.0

    def generate_shares(self, image: np.ndarray, n_shares: int = 2) -> List[np.ndarray]:
        """Generate n visual cryptographic shares"""
        shares = []
        # Generate n-1 random shares
        for _ in range(n_shares - 1):
            share = np.random.randint(0, 2, image.shape, dtype=np.uint8)
            shares.append(share)
        
        # Generate the final share using XOR
        final_share = image.astype(np.uint8)
        for share in shares:
            final_share = cv2.bitwise_xor(final_share, share)
        shares.append(final_share)
        
        return shares

    def reconstruct_image(self, shares: List[np.ndarray]) -> np.ndarray:
        """Reconstruct the original image from shares using AI enhancement"""
        # Basic reconstruction using XOR
        reconstructed = shares[0].copy()
        for share in shares[1:]:
            reconstructed = cv2.bitwise_xor(reconstructed, share)
        
        # AI enhancement
        enhanced = self.model.predict(
            reconstructed.reshape(1, *self.image_size, 1)
        )
        return enhanced.reshape(*self.image_size)

    def verify_integrity(self, original: np.ndarray, reconstructed: np.ndarray) -> bool:
        """Verify the integrity of the reconstructed image"""
        original_hash = hashlib.sha256(original.tobytes()).hexdigest()
        reconstructed_hash = hashlib.sha256(reconstructed.tobytes()).hexdigest()
        return original_hash == reconstructed_hash

    def save_share(self, share: np.ndarray, path: str):
        """Save a share to disk"""
        cv2.imwrite(path, (share * 255).astype(np.uint8))

    def load_share(self, path: str) -> np.ndarray:
        """Load a share from disk"""
        return cv2.imread(path, cv2.IMREAD_GRAYSCALE) / 255.0

    def train_ai_model(self, training_data: List[np.ndarray], epochs: int = 10):
        """Train the AI model for better reconstruction"""
        x_train = np.array(training_data)
        self.model.fit(x_train, x_train, epochs=epochs, batch_size=32)

# Example usage
if __name__ == "__main__":
    vc = VisualCryptography()
    
    # Process an image
    image = vc.preprocess_image("transaction_image.png")
    
    # Generate shares
    shares = vc.generate_shares(image, n_shares=3)
    
    # Save shares
    for i, share in enumerate(shares):
        vc.save_share(share, f"share_{i}.png")
    
    # Reconstruct image
    loaded_shares = [vc.load_share(f"share_{i}.png") for i in range(3)]
    reconstructed = vc.reconstruct_image(loaded_shares)
    
    # Verify integrity
    is_valid = vc.verify_integrity(image, reconstructed)
    print(f"Image integrity verified: {is_valid}") 